import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { sendWhatsApp, msgPix } from "@/lib/whatsapp";
import { formatBRL } from "@/lib/format";

const supabaseAdmin = () =>
  createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

/**
 * POST /api/whatsapp-charge
 * Body: { charge_id: string }
 * Envia o código Pix da cobrança via WhatsApp usando o provedor configurado.
 */
export async function POST(req: NextRequest) {
  try {
    const { charge_id } = await req.json();
    if (!charge_id) {
      return NextResponse.json({ error: "charge_id obrigatório." }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    const { data: charge, error: cErr } = await supabase
      .from("charges")
      .select("*")
      .eq("id", charge_id)
      .single();

    if (cErr || !charge) {
      return NextResponse.json({ error: "Cobrança não encontrada." }, { status: 404 });
    }
    if (!charge.client_phone) {
      return NextResponse.json({ error: "Número do cliente não informado." }, { status: 400 });
    }
    if (!charge.pix_payload) {
      return NextResponse.json({ error: "Código Pix não gerado para esta cobrança." }, { status: 400 });
    }

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("business_name, whatsapp_provider, whatsapp_token, whatsapp_instance_id")
      .eq("id", charge.profile_id)
      .single();

    if (pErr || !profile) {
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
    }

    const message = msgPix(
      charge.client_name || "Cliente",
      charge.description || "Serviço",
      formatBRL(charge.amount_cents),
      charge.pix_payload
    );

    const result = await sendWhatsApp({
      to: charge.client_phone,
      message,
      provider: profile.whatsapp_provider as "mock" | "zapi" | "evolution" | "ultramsg",
      token: profile.whatsapp_token || undefined,
      instanceId: profile.whatsapp_instance_id || undefined,
    });

    if (!result.ok) {
      return NextResponse.json({ error: `WhatsApp falhou: ${result.error}` }, { status: 502 });
    }

    await supabase
      .from("charges")
      .update({ reminders_sent: (charge.reminders_sent || 0) + 1 })
      .eq("id", charge_id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
