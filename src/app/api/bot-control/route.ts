import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { phoneMatchKey, normalizeWhatsAppPhone } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/**
 * POST /api/bot-control
 * Body: { phone: string, action: "status" | "pause" | "resume" }
 *
 * Pausa/reativa o bot do WhatsApp para a conversa de um telefone. "Pausar" =
 * assumir a conversa (state=human, human_owner_engaged) — o bot fica em
 * silêncio. Casa o telefone pelo número normalizado (DDD+8) para acertar a
 * linha de bot_conversations mesmo com variação do 9º dígito no JID.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let body: { phone?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const rawPhone = (body.phone || "").trim();
  const action = body.action || "status";
  const key = phoneMatchKey(rawPhone);
  if (key.length < 10) {
    return NextResponse.json({ error: "Telefone inválido ou ausente." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: convs } = await admin
    .from("bot_conversations")
    .select("id, phone, state")
    .eq("profile_id", user.id)
    .limit(5000);
  const matches = (convs || []).filter((c) => phoneMatchKey(c.phone as string) === key);

  if (action === "status") {
    return NextResponse.json({
      exists: matches.length > 0,
      paused: matches.some((m) => m.state === "human"),
    });
  }

  const nowIso = new Date().toISOString();

  if (action === "pause") {
    if (matches.length > 0) {
      for (const m of matches) {
        await admin.from("bot_conversations")
          .update({ state: "human", human_owner_engaged: true, fallback_count: 0, last_message_at: nowIso })
          .eq("id", m.id);
      }
    } else {
      // Nenhuma conversa ainda — cria a linha já pausada no formato de envio.
      await admin.from("bot_conversations").upsert(
        { profile_id: user.id, phone: normalizeWhatsAppPhone(rawPhone), state: "human", human_owner_engaged: true, fallback_count: 0, last_message_at: nowIso },
        { onConflict: "profile_id,phone" }
      );
    }
    return NextResponse.json({ ok: true, paused: true });
  }

  if (action === "resume") {
    for (const m of matches) {
      await admin.from("bot_conversations")
        .update({ state: "idle", human_owner_engaged: false, fallback_count: 0, last_message_at: nowIso })
        .eq("id", m.id);
    }
    return NextResponse.json({ ok: true, paused: false });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
