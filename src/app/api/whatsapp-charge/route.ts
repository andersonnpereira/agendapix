import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { sendWhatsApp, msgPix, msgLembrete } from "@/lib/whatsapp";
import { formatBRL } from "@/lib/format";

/**
 * POST /api/whatsapp-charge
 * Body: { charge_id: string, type?: "pix" | "lembrete" }
 * Envia o código Pix ou lembrete via Evolution API usando a sessão autenticada.
 */
export async function POST(req: NextRequest) {
  try {
    const { charge_id, type = "pix", message: customMessage } = await req.json();
    if (!charge_id) {
      return NextResponse.json({ error: "charge_id obrigatório." }, { status: 400 });
    }

    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { data: charge, error: cErr } = await supabase
      .from("charges")
      .select("*")
      .eq("id", charge_id)
      .eq("profile_id", user.id)
      .single();

    if (cErr || !charge) {
      return NextResponse.json({ error: "Cobrança não encontrada." }, { status: 404 });
    }
    if (!charge.client_phone) {
      return NextResponse.json({ error: "Número do cliente não informado." }, { status: 400 });
    }
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("business_name, whatsapp_instance_id, msg_pix, msg_lembrete, pix_key")
      .eq("id", user.id)
      .single();

    if (pErr || !profile) {
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
    }

    if (!profile.whatsapp_instance_id) {
      return NextResponse.json({ error: "WhatsApp não conectado. Conecte na página de Configurações." }, { status: 400 });
    }

    const instanceId = profile.whatsapp_instance_id;
    const evolutionKey = process.env.EVOLUTION_API_KEY;

    if (!evolutionKey) {
      return NextResponse.json({ error: "EVOLUTION_API_KEY não configurada." }, { status: 500 });
    }

    const [year, month, day] = (charge.due_date || "").split("-");
    const dueDateFormatted = charge.due_date ? `${day}/${month}/${year}` : "";

    const message = customMessage || (
      type === "lembrete"
        ? msgLembrete(
            charge.client_name || "Cliente",
            charge.description || "Serviço",
            formatBRL(charge.amount_cents),
            profile.pix_key || "",
            profile.msg_lembrete || null,
            dueDateFormatted
          )
        : msgPix(
            charge.client_name || "Cliente",
            charge.description || "Serviço",
            formatBRL(charge.amount_cents),
            profile.pix_key || "",
            profile.msg_pix || null
          )
    );

    const result = await sendWhatsApp({
      to: charge.client_phone,
      message,
      provider: "evolution",
      instanceId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: `WhatsApp falhou: ${result.error}` }, { status: 502 });
    }

    await supabase
      .from("charges")
      .update({ reminders_sent: (charge.reminders_sent || 0) + 1 })
      .eq("id", charge_id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: `Erro interno: ${String(e)}` }, { status: 500 });
  }
}
