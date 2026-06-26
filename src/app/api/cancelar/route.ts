import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { sendEmail, htmlCancelamentoProfissional } from "@/lib/email";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const { booking_id, token } = await req.json();
    if (!booking_id || !token) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const supabase = adminClient();

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, status, cancel_token, profile_id, date, time, client_name, services(name)")
      .eq("id", booking_id)
      .eq("cancel_token", token)
      .single();

    if (!booking) {
      return NextResponse.json({ error: "Link inválido ou expirado." }, { status: 404 });
    }

    if (booking.status === "concluido") {
      return NextResponse.json({ error: "Agendamento já concluído, não é possível cancelar." }, { status: 400 });
    }

    if (booking.status === "cancelado") {
      return NextResponse.json({ ok: true, alreadyCancelled: true });
    }

    // Busca regras do profissional
    const { data: profileData } = await supabase
      .from("profiles")
      .select("cancel_min_hours, notification_email, business_name, name")
      .eq("id", booking.profile_id)
      .single();

    // Valida prazo mínimo para cancelamento
    if (profileData?.cancel_min_hours && profileData.cancel_min_hours > 0) {
      const nowBR = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const [sy, sm, sd] = (booking.date as string).split("-").map(Number);
      const timeStr = (booking.time as string).slice(0, 5);
      const [th, tmin] = timeStr.split(":").map(Number);
      const bookingMs = new Date(sy, sm - 1, sd, th, tmin).getTime();
      const hoursUntilBooking = (bookingMs - nowBR.getTime()) / (1000 * 60 * 60);
      if (hoursUntilBooking < profileData.cancel_min_hours) {
        return NextResponse.json(
          { error: `Este agendamento só pode ser cancelado com ${profileData.cancel_min_hours}h de antecedência.` },
          { status: 400 }
        );
      }
    }

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelado", cancel_token: null })
      .eq("id", booking_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Notifica o profissional por e-mail
    const profEmail = profileData?.notification_email;
    if (profEmail) {
      const [y, m, d] = (booking.date as string).split("-");
      const svc = Array.isArray(booking.services) ? booking.services[0] : booking.services;
      sendEmail({
        to: profEmail,
        subject: `Agendamento cancelado — ${booking.client_name}`,
        html: htmlCancelamentoProfissional({
          clientName: booking.client_name as string,
          service: (svc as { name: string } | null)?.name || "Serviço",
          date: `${d}/${m}/${y}`,
          time: (booking.time as string).slice(0, 5),
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "",
        }),
      }).catch((e) => console.error("[cancelar notify prof]", e));
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
