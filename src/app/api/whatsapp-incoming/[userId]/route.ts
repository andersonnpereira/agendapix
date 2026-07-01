import { NextRequest, NextResponse } from "next/server";
import { handleBotMessage } from "@/lib/whatsapp-bot";

// SQL necessário no Supabase (rodar uma vez):
// CREATE TABLE IF NOT EXISTS public.bot_conversations (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
//   phone text NOT NULL,
//   state text NOT NULL DEFAULT 'idle',
//   last_message_at timestamptz DEFAULT now(),
//   fallback_count int DEFAULT 0,
//   current_flow text DEFAULT 'main',
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
  ADD COLUMN IF NOT EXISTS bot_human_timeout_hours int DEFAULT 24;

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

  // Log completo para debug (Vercel Functions → Logs)
  const event = ((body.event as string) || "").toLowerCase();
  console.log("[bot-incoming]", JSON.stringify({ userId, event, body: JSON.stringify(body).slice(0, 500) }));

  // Aceita tanto "messages.upsert" (Evolution v2) quanto "MESSAGES_UPSERT" (algumas versões)
  if (event !== "messages.upsert") {
    return NextResponse.json({ ok: true, skipped: "notMessage", event });
  }

  const data = (body.data as Record<string, unknown>) || {};
  const key = (data.key as Record<string, unknown>) || {};

  // Ignora mensagens enviadas pelo próprio bot (aceita boolean true ou string "true")
  if (key.fromMe === true || key.fromMe === "true") {
    return NextResponse.json({ ok: true, skipped: "fromMe" });
  }

  const remoteJid = (key.remoteJid as string) || "";

  // Ignora grupos
  if (remoteJid.includes("@g.us")) {
    return NextResponse.json({ ok: true, skipped: "group" });
  }

  const phone = remoteJid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
  if (!phone) {
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

  if (!text.trim()) {
    console.log("[bot-incoming] sem texto extraível", { messageType: data.messageType, keys: Object.keys(message) });
    return NextResponse.json({ ok: true, skipped: "noText" });
  }

  console.log("[bot-incoming] processando", { userId, phone, text: text.slice(0, 80) });

  try {
    await handleBotMessage(userId, phone, text);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[bot-incoming] ERRO handleBotMessage:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
