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
    const { profile_id, service_id, client_name, client_phone, date, time } =
      body;

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
        date,
        time,
        status: "pendente",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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

    const ownerMsg =
      `📅 *Novo agendamento recebido!*\n\n` +
      `👤 *Cliente:* ${client_name}\n` +
      `✂️ *Serviço:* ${serviceName}\n` +
      `📅 *Data:* ${dateFormatted} às ${time.slice(0, 5)}\n` +
      `📱 *WhatsApp:* ${client_phone}`;

    // Notificação WhatsApp ao profissional (síncrono — Vercel mata fire-and-forget)
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
    } else {
      console.warn("[booking notify WA] pulado —", {
        semTelefone: !ownerPhone,
        semInstancia: !instanceId,
        semChaveEvolution: !evolutionKey,
        semEvoUrl: !process.env.EVOLUTION_API_URL,
      });
    }

    // E-mail como fallback (não bloqueia se falhar)
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
