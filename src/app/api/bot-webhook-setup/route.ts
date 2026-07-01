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
    return NextResponse.json({ error: "WhatsApp não configurado — conecte o WhatsApp primeiro." }, { status: 400 });
  }

  const baseUrl = (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
  if (!baseUrl) {
    return NextResponse.json({ error: "EVOLUTION_API_URL não configurado no servidor." }, { status: 500 });
  }

  const apiKey = profile.whatsapp_token || process.env.EVOLUTION_API_KEY || "";
  const instanceName = profile.whatsapp_instance_id;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  try {
    if (profile.bot_enabled) {
      const webhookUrl = `${siteUrl}/api/whatsapp-incoming/${user.id}`;

      const res = await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({
          url: webhookUrl,
          enabled: true,
          webhookByEvents: false,
          webhookBase64: false,
          events: ["MESSAGES_UPSERT"],
        }),
      });

      const resText = await res.text();
      let resData: unknown;
      try { resData = JSON.parse(resText); } catch { resData = resText; }

      console.log("[bot-webhook-setup] ativado — HTTP", res.status, JSON.stringify(resData).slice(0, 300));

      if (!res.ok) {
        return NextResponse.json({
          error: `Evolution API retornou ${res.status}`,
          detail: resData,
          webhookUrl,
        }, { status: 502 });
      }

      return NextResponse.json({ ok: true, enabled: true, webhookUrl, evolutionResponse: resData });

    } else {
      const res = await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({ url: "", enabled: false, webhookByEvents: false, webhookBase64: false, events: [] }),
      });

      const resText = await res.text();
      let resData: unknown;
      try { resData = JSON.parse(resText); } catch { resData = resText; }

      console.log("[bot-webhook-setup] desativado — HTTP", res.status, JSON.stringify(resData).slice(0, 300));

      return NextResponse.json({ ok: true, enabled: false, evolutionResponse: resData });
    }
  } catch (e) {
    console.error("[bot-webhook-setup] erro:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
