import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("whatsapp_instance_id, whatsapp_token, bot_enabled")
    .eq("id", user.id)
    .single();

  if (!profile?.whatsapp_instance_id) {
    return NextResponse.json({ error: "WhatsApp não configurado" }, { status: 400 });
  }

  const baseUrl = (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
  if (!baseUrl) {
    return NextResponse.json({ error: "EVOLUTION_API_URL não configurado" }, { status: 500 });
  }

  const apiKey = profile.whatsapp_token || process.env.EVOLUTION_API_KEY || "";
  const instanceName = profile.whatsapp_instance_id;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  try {
    if (profile.bot_enabled) {
      // Ativa o webhook apontando para o endpoint do bot deste usuário
      const webhookUrl = `${siteUrl}/api/whatsapp-incoming/${user.id}`;
      const res = await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({
          url: webhookUrl,
          webhook_by_events: false,
          webhook_base64: false,
          events: ["MESSAGES_UPSERT"],
          enabled: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      console.log("[bot-webhook-setup] ativado:", data);
      return NextResponse.json({ ok: true, enabled: true, webhookUrl });
    } else {
      // Desativa o webhook
      const res = await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({ url: "", enabled: false, events: [] }),
      });
      const data = await res.json().catch(() => ({}));
      console.log("[bot-webhook-setup] desativado:", data);
      return NextResponse.json({ ok: true, enabled: false });
    }
  } catch (e) {
    console.error("[bot-webhook-setup]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
