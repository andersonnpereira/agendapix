import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendEmail, htmlLembreteCliente } from "@/lib/email";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (auth.replace("Bearer ", "") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Amanhã no fuso Brasil
  const brNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  brNow.setDate(brNow.getDate() + 1);
  const tomorrow = `${brNow.getFullYear()}-${String(brNow.getMonth() + 1).padStart(2, "0")}-${String(brNow.getDate()).padStart(2, "0")}`;

  // Busca agendamentos de amanhã ainda não lembrados
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id, profile_id, client_name, client_phone, client_email, cancel_token, time, services(name)")
    .eq("date", tomorrow)
    .in("status", ["pendente", "confirmado"]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!bookings || bookings.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  // Carrega perfis únicos
  const profileIds = [...new Set(bookings.map((b) => b.profile_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, business_name, name, whatsapp_provider, whatsapp_token, whatsapp_instance_id")
    .in("id", profileIds);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  const [day, month, year] = [
    String(brNow.getDate()).padStart(2, "0"),
    String(brNow.getMonth() + 1).padStart(2, "0"),
    brNow.getFullYear(),
  ];
  const dateFormatted = `${day}/${month}/${year}`;

  let sent = 0;
  for (const booking of bookings) {
    const profile = profileMap.get(booking.profile_id);
    if (!profile || !booking.client_phone) continue;

    const svc = Array.isArray(booking.services)
      ? (booking.services[0] as { name?: string })?.name
      : (booking.services as { name?: string } | null)?.name;
    const serviceName = svc || "seu atendimento";
    const timeStr = (booking.time as string)?.slice(0, 5) ?? "";
    const businessName = profile.business_name || profile.name || "seu profissional";

    const message =
      `Olá, ${booking.client_name}! 👋` +
      `

Lembrando que você tem *${serviceName}* amanhã:` +
      `
📅 *${dateFormatted}* às *${timeStr}*` +
      `
📍 *${businessName}*` +
      `

Qualquer dúvida é só chamar. Te esperamos! 😊`;

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

  return NextResponse.json({ ok: true, sent, total: bookings.length });
}
