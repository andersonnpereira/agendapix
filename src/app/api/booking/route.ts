import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { sendEmail, htmlNovoAgendamento } from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp";

const supabaseAdmin = () =>
  createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { profile_id, service_id, client_name, client_phone, client_notes, date, time } = body;

    if (!profile_id || !client_name || !client_phone || !date || !time) {
      return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    // Cria o agendamento
    const { data: booking, error } = await supabase
      .from("bookings")
      .insert({
        profile_id,
        service_id: service_id || null,
        client_name,
        client_phone,
        notes: client_notes || null,
        date,
        time,
        status: "pendente",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auto-cria/vincula cliente usando service role key (opcional — não bloqueia o booking)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey) {
      try {
        const admin = createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceKey,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // Busca cliente existente pelo telefone + profile
        const { data: existing } = await admin
          .from("clients")
          .select("id")
          .eq("profile_id", profile_id)
          .eq("phone", client_phone)
          .maybeSingle();

        let clientId: string | null = null;
        if (existing) {
          clientId = existing.id;
        } else {
          const { data: created } = await admin
            .from("clients")
            .insert({ profile_id, name: client_name, phone: client_phone, source: "link", status: "ativo" })
            .select("id")
            .single();
          clientId = created?.id || null;
        }

        if (clientId) {
          await admin.from("bookings").update({ client_id: clientId }).eq("id", booking.id);
        }
      } catch (e) {
        // não bloqueia o fluxo principal
        console.warn("[booking client-link]", e);
      }
    }

    // Busca perfil + serviço em paralelo para notificação
    const [{ data: profile }, { data: service }] = await Promise.all([
      supabase
        .from("profiles")
        .select("notification_email, business_name, phone, whatsapp_instance_id")
        .eq("id", profile_id)
        .single(),
      service_id
        ? supabase.from("services").select("name").eq("id", service_id).single()
        : Promise.resolve({ data: null }),
    ]);

    const [year, month, day] = date.split("-");
    const dateFormatted = `${day}/${month}/${year}`;
    const serviceName = (service as { name: string } | null)?.name || "Serviço";

    let ownerMsg =
      `📅 *Novo agendamento recebido!*\n\n` +
      `👤 *Cliente:* ${client_name}\n` +
      `✂️ *Serviço:* ${serviceName}\n` +
      `📅 *Data:* ${dateFormatted} às ${time.slice(0, 5)}\n` +
      `📱 *WhatsApp:* ${client_phone}`;

    if (client_notes) {
      ownerMsg += `\n📝 *Observação:* ${client_notes}`;
    }

    const ownerPhone = profile?.phone;
    const instanceId = profile?.whatsapp_instance_id;
    const evolutionKey = process.env.EVOLUTION_API_KEY;

    if (ownerPhone && instanceId && evolutionKey) {
      const result = await sendWhatsApp({
        to: ownerPhone,
        message: ownerMsg,
        provider: "evolution",
        instanceId,
      });
      if (!result.ok) {
        console.error("[booking notify WA]", result.error);
      }
    }

    const email = profile?.notification_email;
    if (email) {
      sendEmail({
        to: email,
        subject: `Novo agendamento — ${client_name}`,
        html: htmlNovoAgendamento({
          clientName: client_name,
          service: serviceName,
          date: dateFormatted,
          time: time.slice(0, 5),
          phone: client_phone,
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "",
        }),
      }).catch((e) => console.error("[booking notify email]", e));
    }

    return NextResponse.json({ booking }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
