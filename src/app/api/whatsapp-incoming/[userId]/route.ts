import { NextRequest, NextResponse } from "next/server";
import { handleBotMessage, handleOwnerOutbound } from "@/lib/whatsapp-bot";

// Extrai o telefone real (só dígitos) da chave do evento. Em @s.whatsapp.net
// é o próprio remoteJid; em modo @lid o número verdadeiro vem em senderPn /
// remoteJidAlt / participantAlt. Pega o primeiro campo que seja um JID de
// telefone de verdade (@s.whatsapp.net) — ignora os ids opacos @lid.
function extractRealPhone(key: Record<string, unknown>): string | null {
  const candidates = [key.remoteJid, key.remoteJidAlt, key.senderPn, key.participantAlt, key.participant];
  for (const c of candidates) {
    if (typeof c === "string" && c.endsWith("@s.whatsapp.net")) {
      const digits = c.replace("@s.whatsapp.net", "").replace(/\D/g, "");
      if (digits) return digits;
    }
  }
  return null;
}

// SQL necessário no Supabase (rodar uma vez):
// CREATE TABLE IF NOT EXISTS public.bot_conversations (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
//   phone text NOT NULL,
//   state text NOT NULL DEFAULT 'idle',
//   last_message_at timestamptz DEFAULT now(),
//   fallback_count int DEFAULT 0,
//   current_flow text DEFAULT 'main',
//   last_outbound_at timestamptz,
//   human_owner_engaged boolean NOT NULL DEFAULT false,
//   UNIQUE(profile_id, phone)
// );
// ALTER TABLE public.bot_conversations ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "bot_conv_service" ON public.bot_conversations
//   USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
//
// ALTER TABLE public.profiles
//   ADD COLUMN IF NOT EXISTS bot_enabled boolean NOT NULL DEFAULT false,
//   ADD COLUMN IF NOT EXISTS bot_flows jsonb DEFAULT '[]',
//   ADD COLUMN IF NOT EXISTS bot_fallback_message text,
//   ADD COLUMN IF NOT EXISTS bot_fallback_max_tries int DEFAULT 2,
//   ADD COLUMN IF NOT EXISTS bot_typing_delay_ms int DEFAULT 1200,
//   ADD COLUMN IF NOT EXISTS bot_session_timeout_min int DEFAULT 30,
//   ADD COLUMN IF NOT EXISTS bot_business_hours_enabled boolean DEFAULT false,
//   ADD COLUMN IF NOT EXISTS bot_hours_start int DEFAULT 8,
//   ADD COLUMN IF NOT EXISTS bot_hours_end int DEFAULT 18,
//   ADD COLUMN IF NOT EXISTS bot_business_days text[] DEFAULT ARRAY['seg','ter','qua','qui','sex'],
//   ADD COLUMN IF NOT EXISTS bot_away_message text,
//   ADD COLUMN IF NOT EXISTS bot_human_message text,
//   ADD COLUMN IF NOT EXISTS bot_notify_phone text,
//   ADD COLUMN IF NOT EXISTS bot_trigger_mode text DEFAULT 'keywords',
//   ADD COLUMN IF NOT EXISTS bot_trigger_keywords text[] DEFAULT ARRAY['oi','olá','ola','hi','menu'],
//   ADD COLUMN IF NOT EXISTS bot_trigger_new_conv_hours int DEFAULT 24,
//   ADD COLUMN IF NOT EXISTS bot_human_timeout_hours int DEFAULT 24;

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;
  if (!userId) {
    return NextResponse.json({ error: "userId ausente" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  // Log mínimo — evita gravar telefone/texto do cliente nos logs
  const event = ((body.event as string) || "").toLowerCase();
  console.log("[bot-incoming] evento recebido:", event);

  // Aceita tanto "messages.upsert" (Evolution v2) quanto "MESSAGES_UPSERT" (algumas versões)
  if (event !== "messages.upsert") {
    return NextResponse.json({ ok: true, skipped: "notMessage", event });
  }

  const data = (body.data as Record<string, unknown>) || {};
  const key = (data.key as Record<string, unknown>) || {};
  const remoteJid = (key.remoteJid as string) || "";

  // Rejeita o que NÃO é conversa 1-a-1: grupos (@g.us), comunidades,
  // newsletters (@newsletter) e status/broadcast. NÃO rejeita @lid — esse é
  // o novo endereçamento individual do WhatsApp (privacidade), e é justamente
  // nele que vêm as respostas manuais do profissional (fromMe). Rejeitar @lid
  // fazia o bot nunca saber que o humano entrou e continuar respondendo.
  if (/@g\.us$|@newsletter$|@broadcast$|status@/i.test(remoteJid)) {
    console.log("[bot-incoming] ignorado — não é conversa individual:", remoteJid);
    return NextResponse.json({ ok: true, skipped: "notIndividualChat", remoteJid });
  }

  // Resolve o telefone REAL: em modo @lid o remoteJid é um id opaco, e o
  // número verdadeiro (@s.whatsapp.net) vem num campo auxiliar. Procura em
  // todos os candidatos e pega o primeiro que seja um telefone de verdade —
  // assim o mesmo contato converge na mesma chave em bot_conversations,
  // venha a mensagem como @s.whatsapp.net ou como @lid.
  const phone = extractRealPhone(key);
  if (!phone) {
    console.log("[bot-incoming] sem telefone resolvível:", { remoteJid, keys: Object.keys(key) });
    return NextResponse.json({ ok: true, skipped: "noPhone", remoteJid });
  }

  // Mensagens com fromMe=true são as que SAEM do número do profissional —
  // tanto os envios automáticos nossos (bot/cron/cobrança) quanto uma
  // resposta manual que ele mesmo digitou no celular. handleOwnerOutbound
  // usa o timestamp do último envio nosso para diferenciar os dois casos:
  // se não foi eco de um envio recente, é atendimento humano manual e o bot
  // deve pausar para essa conversa (ver caso de uso: profissional responde
  // um cliente pelo WhatsApp e o bot, sem saber disso, insiste com o menu).
  if (key.fromMe === true || key.fromMe === "true") {
    try {
      await handleOwnerOutbound(userId, phone);
    } catch (e) {
      console.error("[bot-incoming] erro ao processar fromMe:", e);
    }
    return NextResponse.json({ ok: true, skipped: "fromMe" });
  }

  // Extrai texto — tenta vários formatos da Evolution API
  const message = (data.message as Record<string, unknown>) || {};
  const text =
    (message.conversation as string) ||
    ((message.extendedTextMessage as Record<string, unknown>)?.text as string) ||
    ((message.buttonsResponseMessage as Record<string, unknown>)?.selectedDisplayText as string) ||
    ((message.listResponseMessage as Record<string, unknown>)?.title as string) ||
    ((message.templateButtonReplyMessage as Record<string, unknown>)?.selectedDisplayText as string) ||
    "";

  if (!text.trim()) {
    console.log("[bot-incoming] sem texto extraível", { messageType: data.messageType, keys: Object.keys(message) });
    return NextResponse.json({ ok: true, skipped: "noText" });
  }

  console.log("[bot-incoming] processando mensagem", { userId });

  try {
    await handleBotMessage(userId, phone, text);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[bot-incoming] ERRO handleBotMessage:", e);
    return NextResponse.json({ error: "Erro ao processar mensagem" }, { status: 500 });
  }
}
