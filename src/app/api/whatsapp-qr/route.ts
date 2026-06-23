import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const token = authHeader.slice(7);

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("whatsapp_provider, whatsapp_token, whatsapp_instance_id")
      .eq("id", user.id)
      .single();

    if (!profile || profile.whatsapp_provider !== "evolution") {
      return NextResponse.json({ error: "Evolution API não configurada" }, { status: 400 });
    }

    const baseUrl = process.env.EVOLUTION_API_URL;
    const apiKey = profile.whatsapp_token as string;
    const instanceName = profile.whatsapp_instance_id as string;

    if (!baseUrl || !apiKey || !instanceName) {
      return NextResponse.json({ error: "Configuração incompleta. Defina EVOLUTION_API_URL." }, { status: 400 });
    }

    // Verifica estado da conexão
    const stateRes = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
      headers: { apikey: apiKey },
    });

    if (stateRes.ok) {
      const stateData = await stateRes.json();
      const state = stateData?.instance?.state || stateData?.state;
      if (state === "open") {
        return NextResponse.json({ status: "connected" });
      }
    }

    // Não conectado — busca QR code
    const connectRes = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
      headers: { apikey: apiKey },
    });

    if (!connectRes.ok) {
      const err = await connectRes.text();
      return NextResponse.json({ error: `Erro Evolution API: ${err}` }, { status: 502 });
    }

    const connectData = await connectRes.json();
    const qr = connectData?.qrcode?.base64 || connectData?.base64 || null;

    return NextResponse.json({ status: "disconnected", qr });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
