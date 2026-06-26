import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { sendWhatsApp, msgConfirmacao } from "@/lib/whatsapp";

/**
 * POST /api/whatsapp
 * Body: { booking_id: string }
 *
 * 1. Busca o booking e o profile do profissional (que tem as credenciais WA).
 * 2. Envia a mensagem de confirmação via provedor configurado.
 * 3. Atualiza bookings.whatsapp_sent = true e status = 'confirmado'.
 */
export async function POST(req: NextRequest) {
  try {
    const { booking_id } = await req.json();
    if (!booking_id) {
      return NextResponse.json({ error: "booking_id obrigatório." }, { status: 400 });
    }

    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    // Busca booking + serviço + profile
    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("*, services(name, duration_minutes)")
      .eq("id", booking_id)
      .single();

    if (bErr || !booking) {
      return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
    }

    if (booking.profile_id !== user.id) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("business_name, whatsapp_provider, whatsapp_token, whatsapp_instance_id, msg_confirmacao")
      .eq("id", booking.profile_id)
      .single();

    if (pErr || !profile) {
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
    }

    const [year, month, day] = booking.date.split("-");
    const dateFormatted = `${day}/${month}/${year}`;

    const message = msgConfirmacao(
      booking.client_name,
      (booking.services as { name: string } | null)?.name || "Serviço",
      dateFormatted,
      booking.time?.slice(0, 5),
      profile.business_name || "Profissional",
      profile.msg_confirmacao
    );

    const result = await sendWhatsApp({
      to: booking.client_phone,
      message,
      provider: profile.whatsapp_provider as "mock" | "zapi" | "evolution" | "ultramsg",
      token: profile.whatsapp_token || undefined,
      instanceId: profile.whatsapp_instance_id || undefined,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: `WhatsApp falhou: ${result.error}` },
        { status: 502 }
      );
    }

    // Atualiza booking
    const { error: uErr } = await supabase
      .from("bookings")
      .update({ status: "confirmado", whatsapp_sent: true })
      .eq("id", booking_id);

    if (uErr) {
      console.error("[whatsapp confirm] erro ao atualizar booking:", uErr.message);
      return NextResponse.json({ error: `Erro ao atualizar agendamento: ${uErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
