import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

async function getAuthedSupabase(token: string) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const bearerToken = authHeader.slice(7);

    const supabase = await getAuthedSupabase(bearerToken);
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, "");
    const apiKey = process.env.EVOLUTION_API_KEY;

    if (!baseUrl || !apiKey) {
      return NextResponse.json({ error: "Evolution API não configurada no servidor." }, { status: 500 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("whatsapp_instance_id")
      .eq("id", user.id)
      .single();

    let instanceName = profile?.whatsapp_instance_id as string | null;

    if (!instanceName) {
      instanceName = `ap-${user.id.replace(/-/g, "").slice(0, 14)}`;
      await supabase.from("profiles").update({
        whatsapp_instance_id: instanceName,
        whatsapp_provider: "evolution",
      }).eq("id", user.id);
    }

    // Verifica se instância existe e estado
    const stateRes = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
      headers: { apikey: apiKey },
    });

    if (stateRes.ok) {
      const stateData = await stateRes.json();
      const state = stateData?.instance?.state || stateData?.state;
      if (state === "open") {
        return NextResponse.json({ status: "connected" });
      }
    } else {
      // Instância não existe — cria
      const createRes = await fetch(`${baseUrl}/instance/create`, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        }),
      });
      if (!createRes.ok) {
        const err = await createRes.text();
        return NextResponse.json({ error: `Erro ao criar instância: ${err}` }, { status: 502 });
      }
    }

    // Busca QR code
    const connectRes = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
      headers: { apikey: apiKey },
    });

    if (!connectRes.ok) {
      const err = await connectRes.text();
      return NextResponse.json({ error: `Erro ao obter QR: ${err}` }, { status: 502 });
    }

    const connectData = await connectRes.json();
    const qr = connectData?.qrcode?.base64 || connectData?.base64 || null;

    return NextResponse.json({ status: "disconnected", qr });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
