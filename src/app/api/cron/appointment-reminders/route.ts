import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendEmail, htmlLembreteCliente } from "@/lib/email";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Hora atual no fuso Brasil
  const brNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const currentHourBRT = brNow.getHours();

  // Amanhã no fuso Brasil
  const brTomorrow = new Date(brNow);
  brTomorrow.setDate(brTomorrow.getDate() + 1);
  const tomorrow = `${brTomorrow.getFullYear()}-${String(brTomorrow.getMonth() + 1).padStart(2, "0")}-${String(brTomorrow.getDate()).padStart(2, "0")}`;

  // Busca perfis cuja hora de lembrete bate com a hora atual
  // reminder_hour null → padrão 8h
  let profileQuery = supabase.from("profiles").select("id");
  if (currentHourBRT === 8) {
    profileQuery = profileQuery.or("reminder_hour.eq.8,reminder_hour.is.null");
  } else {
    profileQuery = profileQuery.eq("reminder_hour", currentHourBRT);
  }
  const { data: matchingProfiles } = await profileQuery;

  const profileIds = (matchingProfiles || []).map((p) => p.id);

  if (profileIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, hour: currentHourBRT });
  }

  // Busca agendamentos de amanhã para esses perfis, ainda não lembrados
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id, profile_id, client_name, client_phone, client_email, cancel_token, time, services(name)")
    .eq("date", tomorrow)
    .in("status", ["pendente", "confirmado"])
    .neq("client_reminder_sent", true)
    .in("profile_id", profileIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!bookings || bookings.length === 0) return NextResponse.json({ ok: true, sent: 0, hour: currentHourBRT });

  // Carrega perfis únicos (com dados de contato)
  const uniqueProfileIds = [...new Set(bookings.map((b) => b.profile_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, business_name, name, whatsapp_provider, whatsapp_token, whatsapp_instance_id")
    .in("id", uniqueProfileIds);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  const dateFormatted = `${String(brTomorrow.getDate()).padStart(2, "0")}/${String(brTomorrow.getMonth() + 1).padStart(2, "0")}/${brTomorrow.getFullYear()}`;

  let sent = 0;
  for (const booking of bookings) {
    const profile = profileMap.get(booking.profile_id);
    if (!profile) continue;

    const svc = Array.isArray(booking.services)
      ? (booking.services[0] as { name?: string })?.name
      : (booking.services as { name?: string } | null)?.name;
    const serviceName = svc || "seu atendimento";
    const timeStr = (booking.time as string)?.slice(0, 5) ?? "";
    const businessName = profile.business_name || profile.name || "seu profissional";

    const message =
      `Olá, ${booking.client_name}! 👋\n\n` +
      `Lembrando que você tem *${serviceName}* amanhã:\n` +
      `📅 *${dateFormatted}* às *${timeStr}*\n` +
      `📍 *${businessName}*\n\n` +
      `Qualquer dúvida é só chamar. Te esperamos! 😊`;

    let notified = false;

    if (booking.client_phone) {
      const result = await sendWhatsApp({
        to: booking.client_phone.replace(/\D/g, ""),
        message,
        provider: profile.whatsapp_provider as "mock" | "zapi" | "evolution" | "ultramsg",
        token: profile.whatsapp_token || undefined,
        instanceId: profile.whatsapp_instance_id || undefined,
      });
      if (result.ok) notified = true;
    }

    const clientEmail = (booking as Record<string, unknown>).client_email as string | null | undefined;
    const cancelToken = (booking as Record<string, unknown>).cancel_token as string | null | undefined;
    if (clientEmail) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
      const cancelUrl = cancelToken ? `${siteUrl}/cancelar/${cancelToken}` : siteUrl;
      const ok = await sendEmail({
        to: clientEmail,
        subject: `Lembrete: ${serviceName} amanhã`,
        html: htmlLembreteCliente({
          clientName: booking.client_name,
          service: serviceName,
          date: dateFormatted,
          time: timeStr,
          businessName,
          cancelUrl,
        }),
      });
      if (ok) notified = true;
    }

    if (notified) {
      sent++;
      try {
        await supabase
          .from("bookings")
          .update({ client_reminder_sent: true })
          .eq("id", booking.id)
          .throwOnError();
      } catch {/* coluna pode não existir ainda */}
    }
  }

  return NextResponse.json({ ok: true, sent, total: bookings.length, hour: currentHourBRT });
}
