import { NextRequest, NextResponse } from "next/server";
import { handleBotMessage } from "@/lib/whatsapp-bot";

// SQL para rodar no Supabase:
// CREATE TABLE IF NOT EXISTS public.bot_conversations (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
//   phone text NOT NULL,
//   state text NOT NULL DEFAULT 'idle',
//   last_message_at timestamptz DEFAULT now(),
//   UNIQUE(profile_id, phone)
// );
// ALTER TABLE public.bot_conversations ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "bot_conv_service" ON public.bot_conversations
//   USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
// ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bot_enabled boolean NOT NULL DEFAULT false;

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

  // Só processa eventos de mensagens recebidas
  const event = (body.event as string) || "";
  if (event !== "messages.upsert") {
    return NextResponse.json({ ok: true, skipped: "notMessage" });
  }

  const data = (body.data as Record<string, unknown>) || {};
  const key = (data.key as Record<string, unknown>) || {};

  // Ignora mensagens enviadas pelo próprio bot
  if (key.fromMe === true) {
    return NextResponse.json({ ok: true, skipped: "fromMe" });
  }

  // Extrai o número de telefone (remove @s.whatsapp.net)
  const remoteJid = (key.remoteJid as string) || "";

  // Ignora grupos
  if (remoteJid.includes("@g.us")) {
    return NextResponse.json({ ok: true, skipped: "group" });
  }

  const phone = remoteJid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
  if (!phone) {
    return NextResponse.json({ ok: true, skipped: "noPhone" });
  }

  // Extrai texto da mensagem (diferentes formatos do Evolution API)
  const message = (data.message as Record<string, unknown>) || {};
  const text =
    (message.conversation as string) ||
    ((message.extendedTextMessage as Record<string, unknown>)
      ?.text as string) ||
    ((message.buttonsResponseMessage as Record<string, unknown>)
      ?.selectedDisplayText as string) ||
    "";

  if (!text.trim()) {
    return NextResponse.json({ ok: true, skipped: "noText" });
  }

  console.log("[whatsapp-incoming]", { userId, phone, text: text.slice(0, 80) });

  try {
    await handleBotMessage(userId, phone, text);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[whatsapp-incoming] erro:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
