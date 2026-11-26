import { NextRequest, NextResponse } from "next/server";
import { handleBotMessage, handleOwnerOutbound } from "@/lib/whatsapp-bot";

function phoneFromJid(v: unknown): string | null {
  if (typeof v === "string" && v.endsWith("@s.whatsapp.net")) {
    const digits = v.replace("@s.whatsapp.net", "").replace(/\D/g, "");
    return digits || null;
  }
  return null;
}

// Extrai o telefone real (só dígitos) do PARCEIRO da conversa (o cliente).
//
// Crítico para fromMe (resposta manual do dono): o campo `senderPn` é o número
// de QUEM ENVIOU — numa fromMe isso é o DONO, não o cliente. Se usássemos
// senderPn como chave, a pausa "humano assumiu" seria gravada na conversa do
// próprio dono e o bot continuaria respondendo o cliente. Por isso:
//   • o parceiro da conversa é sempre o remoteJid (e variantes @lid → *Alt);
//   • em mensagens recebidas (inbound) o remetente É o cliente, então senderPn
//     vale como reserva;
//   • em fromMe, qualquer telefone que NÃO seja o do remetente (dono) serve —
//     varre a chave inteira para achar o número do cliente, seja qual for o
//     nome do campo que a Evolution usar.
function extractRealPhone(key: Record<string, unknown>, fromMe: boolean): string | null {
  const senderPhone = phoneFromJid(key.senderPn); // em fromMe = o dono
  // 1) Preferência absoluta: o parceiro da conversa.
  for (const f of [key.remoteJid, key.remoteJidAlt, (key as Record<string, unknown>).remoteJidAlternate, (key as Record<string, unknown>).chatId]) {
    const p = phoneFromJid(f);
    if (p && (!fromMe || p !== senderPhone)) return p;
  }
  if (!fromMe) {
    // 2) Inbound: o remetente é o cliente.
    for (const f of [key.senderPn, key.participantAlt, key.participant]) {
      const p = phoneFromJid(f);
      if (p) return p;
    }
  } else {
    // 3) fromMe: qualquer campo com telefone real que não seja o do dono.
    for (const v of Object.values(key)) {
      const p = phoneFromJid(v);
      if (p && p !== senderPhone) return p;
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

  const fromMe = key.fromMe === true || key.fromMe === "true";

  // Resolve o telefone REAL do CLIENTE (parceiro da conversa). Em fromMe isso
  // NÃO pode ser o senderPn (que é o dono) — ver extractRealPhone.
  const phone = extractRealPhone(key, fromMe);
  if (!phone) {
    // Diagnóstico sem vazar números: mostra só os NOMES dos campos e o tipo de
    // JID de cada um (@lid / telefone / outro), para ajustar caso a Evolution
    // use um nome de campo diferente para o número do cliente em fromMe.
    const shape: Record<string, string> = {};
    for (const [k, v] of Object.entries(key)) {
      if (typeof v === "string") shape[k] = v.endsWith("@s.whatsapp.net") ? "phone" : v.endsWith("@lid") ? "lid" : v.includes("@") ? "other-jid" : "scalar";
      else shape[k] = typeof v;
    }
    console.log("[bot-incoming] sem telefone resolvível:", { fromMe, shape });
    return NextResponse.json({ ok: true, skipped: "noPhone" });
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

  // Mensagens com fromMe=true SAEM do número do profissional — tanto os envios
  // automáticos nossos (bot/cron/cobrança) quanto uma resposta que ele digitou
  // no celular. handleOwnerOutbound diferencia os dois comparando o TEXTO: se
  // bate com algo que o bot enviou há pouco, é eco (ignora); se é diferente, é
  // resposta manual → o bot pausa para essa conversa.
  if (fromMe) {
    try {
      await handleOwnerOutbound(userId, phone, text);
    } catch (e) {
      console.error("[bot-incoming] erro ao processar fromMe:", e);
    }
    return NextResponse.json({ ok: true, skipped: "fromMe" });
  }

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
