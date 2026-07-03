import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createAdmin } from "@supabase/supabase-js";

function icalDate(dateStr: string, timeStr: string) {
  // dateStr: "YYYY-MM-DD", timeStr: "HH:MM:SS" — converte para UTC assumindo Brasília (UTC-3)
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d, h + 3, min)); // +3h para converter BRT→UTC
  return utcDate
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function escape(s: string) {
  return s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
}

export async function GET(req: NextRequest) {
  // Permite ?token=<ical_token> para subscrição sem cookie (ex: Google Calendar).
  // O token é um segredo dedicado (coluna ical_token), NÃO o profile_id —
  // que é público e apareceria no HTML da página de agendamento.
  const { searchParams } = new URL(req.url);
  const tokenParam = searchParams.get("token");

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let profileId: string;

  if (tokenParam) {
    if (!/^[0-9a-f-]{36}$/i.test(tokenParam)) {
      return new NextResponse("Token inválido", { status: 401 });
    }
    const { data: owner } = await admin
      .from("profiles")
      .select("id")
      .eq("ical_token", tokenParam)
      .single();
    if (!owner) return new NextResponse("Token inválido", { status: 401 });
    profileId = owner.id;
  } else {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new NextResponse("Não autenticado", { status: 401 });
    profileId = user.id;
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: bookings } = await admin
    .from("bookings")
    .select("id, client_name, date, time, notes, services(name, duration_minutes), profiles(business_name, name)")
    .eq("profile_id", profileId)
    .gte("date", today)
    .in("status", ["pendente", "confirmado"])
    .order("date")
    .order("time");

  const { data: profile } = await admin
    .from("profiles")
    .select("business_name, name")
    .eq("id", profileId)
    .single();

  const calName = profile?.business_name || profile?.name || "Agendamentos";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://agendapix.vercel.app";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//Agendou//Agenda//PT`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(calName)}`,
    "X-WR-TIMEZONE:America/Sao_Paulo",
  ];

  for (const booking of bookings || []) {
    const svc = Array.isArray(booking.services)
      ? (booking.services[0] as { name: string; duration_minutes: number } | undefined)
      : (booking.services as { name: string; duration_minutes: number } | null);

    const serviceName = svc?.name || "Atendimento";
    const duration = svc?.duration_minutes || 60;

    const dtstart = icalDate(booking.date, booking.time);
    const [y, m, d] = booking.date.split("-").map(Number);
    const [h, min] = booking.time.split(":").map(Number);
    const endUTC = new Date(Date.UTC(y, m - 1, d, h + 3 + Math.floor((min + duration) / 60), (min + duration) % 60));
    const dtend = endUTC
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");

    const uid = `booking-${booking.id}@agendou`;
    const summary = `${escape(serviceName)} — ${escape(booking.client_name)}`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTART:${dtstart}`);
    lines.push(`DTEND:${dtend}`);
    lines.push(`SUMMARY:${summary}`);
    if (booking.notes) lines.push(`DESCRIPTION:${escape(booking.notes as string)}`);
    lines.push(`URL:${siteUrl}/agenda`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const ical = lines.join("\r\n");

  return new NextResponse(ical, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="agenda.ics"`,
      "Cache-Control": "no-cache",
    },
  });
}
