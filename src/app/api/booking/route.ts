import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { sendEmail, htmlNovoAgendamento, htmlConfirmacaoCliente } from "@/lib/email";
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
    const { profile_id, service_id, client_name, client_phone, client_email, client_notes, extra_answers, date, time } = body;

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

    // Busca regras do perfil para validações
    const { data: profileRules } = await supabase
      .from("profiles")
      .select("min_notice_hours, max_advance_days, daily_booking_limit, auto_confirm")
      .eq("id", profile_id)
      .single();

    // Valida antecedência mínima
    if (profileRules?.min_notice_hours && profileRules.min_notice_hours > 0) {
      const nowBR = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const todayStr = `${nowBR.getFullYear()}-${String(nowBR.getMonth() + 1).padStart(2, "0")}-${String(nowBR.getDate()).padStart(2, "0")}`;
      const [sy, sm, sd] = date.split("-").map(Number);
      const [ty, tm, td] = todayStr.split("-").map(Number);
      const daysDiff = Math.round((new Date(sy, sm - 1, sd).getTime() - new Date(ty, tm - 1, td).getTime()) / (1000 * 60 * 60 * 24));
      const nowMinutes = nowBR.getHours() * 60 + nowBR.getMinutes();
      const [th, tmin] = time.slice(0, 5).split(":").map(Number);
      const minutesUntilSlot = daysDiff * 1440 + th * 60 + tmin - nowMinutes;
      if (minutesUntilSlot < profileRules.min_notice_hours * 60) {
        return NextResponse.json(
          { error: `Este serviço requer ${profileRules.min_notice_hours}h de antecedência para agendamento.` },
          { status: 400 }
        );
      }
    }

    // Valida antecedência máxima
    if (profileRules?.max_advance_days) {
      const todayBR = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }).split("/").reverse().join("-");
      const [ty2, tm2, td2] = todayBR.split("-").map(Number);
      const [sy2, sm2, sd2] = date.split("-").map(Number);
      const daysDiff2 = Math.round((new Date(sy2, sm2 - 1, sd2).getTime() - new Date(ty2, tm2 - 1, td2).getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff2 > profileRules.max_advance_days) {
        return NextResponse.json(
          { error: `Só é possível agendar com até ${profileRules.max_advance_days} dias de antecedência.` },
          { status: 400 }
        );
      }
    }

    // Valida limite diário
    if (profileRules?.daily_booking_limit) {
      const { count: dayCount } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profile_id)
        .eq("date", date)
        .in("status", ["pendente", "confirmado"]);
      if ((dayCount || 0) >= profileRules.daily_booking_limit) {
        return NextResponse.json(
          { error: "Não há mais horários disponíveis nesta data." },
          { status: 400 }
        );
      }
    }

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
        client_email: client_email || null,
        notes: client_notes || null,
        extra_answers: extra_answers || null,
        date,
        time,
        status: profileRules?.auto_confirm ? "confirmado" : "pendente",
      })
      .select("*, cancel_token")
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

    const instanceId = profile?.whatsapp_instance_id;
    const evolutionKey = process.env.EVOLUTION_API_KEY;

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

    // Confirmação por e-mail ao cliente
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
    if (client_email && booking.cancel_token) {
      const cancelUrl = `${siteUrl}/cancelar/${booking.cancel_token}`;
      sendEmail({
        to: client_email,
        subject: `Agendamento confirmado — ${serviceName}`,
        html: htmlConfirmacaoCliente({
          clientName: client_name,
          service: serviceName,
          date: dateFormatted,
          time: time.slice(0, 5),
          businessName: profile?.business_name || profile?.name || "seu profissional",
          cancelUrl,
          siteUrl,
        }),
      }).catch((e) => console.error("[booking confirm client email]", e));
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
