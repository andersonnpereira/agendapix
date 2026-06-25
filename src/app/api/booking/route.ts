import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { sendEmail, htmlNovoAgendamento } from "@/lib/email";
import { sendWhatsApp, msgConfirmacao } from "@/lib/whatsapp";

const supabaseAdmin = () =>
  createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
      ? { auth: { autoRefreshToken: false, persistSession: false } }
      : undefined
  );

// --- Rate limiting em memória ---
// Chave: "profile_id-date" → { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hora

function checkRateLimit(profile_id: string, date: string): boolean {
  const key = `${profile_id}-${date}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true; // permitido
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false; // bloqueado
  }

  entry.count += 1;
  return true; // permitido
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { profile_id, service_id, client_name, client_phone, client_notes, date, time } = body;

    if (!profile_id || !client_name || !client_phone || !date || !time) {
      return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
    }

    // Valida que date não é no passado (timezone Brasil)
    const todayBR = new Date()
      .toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
      .split("/")
      .reverse()
      .join("-");

    if (date < todayBR) {
      return NextResponse.json(
        { error: "Não é possível agendar para datas passadas." },
        { status: 400 }
      );
    }

    // Rate limiting: máximo 50 agendamentos por profile por dia
    if (!checkRateLimit(profile_id, date)) {
      return NextResponse.json(
        { error: "Limite de agendamentos para este dia atingido. Tente novamente mais tarde." },
        { status: 429 }
      );
    }

    const supabase = supabaseAdmin();

    // Verifica conflito de horário antes do insert
    const { data: conflito } = await supabase
      .from("bookings")
      .select("id")
      .eq("profile_id", profile_id)
      .eq("date", date)
      .eq("time", time)
      .in("status", ["pendente", "confirmado"])
      .maybeSingle();

    if (conflito) {
      return NextResponse.json(
        { error: "Este horário já foi reservado. Por favor, escolha outro." },
        { status: 409 }
      );
    }

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

    // Busca perfil + serviço + auth email em paralelo para notificação
    const adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const [{ data: profile }, { data: service }, { data: authUser }] = await Promise.all([
      supabase
        .from("profiles")
        .select("notification_email, business_name, name, phone, whatsapp_instance_id")
        .eq("id", profile_id)
        .single(),
      service_id
        ? supabase.from("services").select("name").eq("id", service_id).single()
        : Promise.resolve({ data: null }),
      adminClient.auth.admin.getUserById(profile_id),
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

    const email = profile?.notification_email || authUser?.user?.email;
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

    // Notifica o cliente com confirmação
    if (client_phone && instanceId && evolutionKey) {
      const [y2, m2, d2] = date.split("-");
      const clientMsg = msgConfirmacao(
        client_name,
        serviceName,
        `${d2}/${m2}/${y2}`,
        time.slice(0, 5),
        profile?.business_name || profile?.name || "seu profissional",
        null
      );
      sendWhatsApp({
        to: client_phone.replace(/\D/g, ""),
        message: clientMsg,
        provider: "evolution",
        instanceId,
      }).catch((e) => console.error("[booking client-notify WA]", e));
    }

    return NextResponse.json({ booking }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
