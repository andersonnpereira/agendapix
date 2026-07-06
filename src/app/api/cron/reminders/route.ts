import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  sendWhatsApp, msgLembrete, formatTemplate, normalizeWhatsAppPhone,
  DEFAULT_MSG_LEMBRETE_HOJE, DEFAULT_MSG_COBRANCA_VENCIDA,
} from "@/lib/whatsapp";
import { markOutboundSent } from "@/lib/whatsapp-bot";
import { formatBRL } from "@/lib/format";

// Sem isso o Next.js trata a rota como estática e o Vercel cacheia a resposta
// no CDN — o cron "roda" mas a função nunca executa (X-Vercel-Cache: HIT)
export const dynamic = "force-dynamic";
// E sem isso os SELECTs do Supabase (fetch GET) são congelados pelo Data Cache
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  // Fail-closed: sem CRON_SECRET configurado, o endpoint fica bloqueado.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/reminders] CRON_SECRET não configurado — endpoint bloqueado.");
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    // Data de hoje no fuso horário de Brasília (UTC-3)
    const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
    const nowBRtMs = Date.now() - BRT_OFFSET_MS;
    const todayDate = new Date(nowBRtMs).toISOString().slice(0, 10); // "YYYY-MM-DD" BRT
    const todayStart = todayDate + "T03:00:00.000Z"; // meia-noite BRT = 03:00 UTC
    const currentHourBRT = new Date(nowBRtMs).getUTCHours();

    // Piso de segurança ABSOLUTO: nenhuma mensagem automática de cobrança sai
    // entre meia-noite e 6h BRT — nem "vence hoje"/vencidas (já gated por
    // reminder_hour) nem lembretes ANTECIPADOS agendados manualmente pelo
    // profissional (datetime-local livre, sem gate por padrão). Se o horário
    // marcado cair na madrugada — erro de preenchimento, ou matemática de
    // recorrência reproduzindo o horário original —, o envio só ocorre na
    // primeira execução do cron a partir das 6h; nada se perde, só atrasa.
    const QUIET_HOUR_END = 6;
    if (currentHourBRT < QUIET_HOUR_END) {
      return NextResponse.json({ ok: true, sent: 0, hour: currentHourBRT, skipped: "quiet_hours" });
    }

    // Marca todas as cobranças vencidas (não pagas) como "atrasado" no banco
    await admin
      .from("charges")
      .update({ status: "atrasado" })
      .neq("status", "pago")
      .lt("due_date", todayDate);

    type ProfileJoin = {
      whatsapp_provider: string;
      whatsapp_token: string | null;
      whatsapp_instance_id: string | null;
      msg_lembrete: string | null;
      msg_lembrete_hoje: string | null;
      msg_cobranca_vencida: string | null;
      pix_key: string | null;
      reminder_hour: number | null;
    };

    const PROFILE_SELECT = "whatsapp_provider, whatsapp_token, whatsapp_instance_id, msg_lembrete, msg_lembrete_hoje, msg_cobranca_vencida, pix_key, reminder_hour";

    // ── 1. Lembretes antecipados + vencidas ─────────────────────────────────
    // Inclui: antes do vencimento (regular) E após vencimento (cobrança vencida)
    // Condição: data agendada já chegou, não é dia de vencimento (tratado pelo grupo 2), não enviou hoje
    const { data: advanceCharges, error } = await admin
      .from("charges")
      .select(`*, profiles!inner(${PROFILE_SELECT})`)
      .eq("auto_reminder", true)
      .neq("status", "pago")
      .neq("due_date", todayDate)   // dia exato fica no grupo 2
      .lte("scheduled_reminder_at", now)
      .or(`last_auto_reminder_at.is.null,last_auto_reminder_at.lt.${todayStart}`);

    if (error) throw error;

    // ── 2. Lembretes no dia do vencimento ────────────────────────────────────
    const { data: dueTodayCharges } = await admin
      .from("charges")
      .select(`*, profiles!inner(${PROFILE_SELECT})`)
      .eq("auto_reminder", true)
      .neq("status", "pago")
      .eq("due_date", todayDate)
      .or(`last_auto_reminder_at.is.null,last_auto_reminder_at.lt.${todayStart}`);

    // Mescla removendo duplicatas
    const advanceIds = new Set((advanceCharges || []).map((c) => c.id));
    const merged = [
      ...(advanceCharges || []).map((c) => ({ charge: c, type: "advance" as const })),
      ...(dueTodayCharges || [])
        .filter((c) => !advanceIds.has(c.id))
        .map((c) => ({ charge: c, type: "due_today" as const })),
    ];

    // Portão de horário: "vence hoje" e vencidos (que reenviam todo dia) não
    // podem sair de madrugada — só a partir da hora configurada (reminder_hour,
    // padrão 8h). Lembretes ANTECIPADOS têm data/hora escolhida pelo usuário
    // (scheduled_reminder_at, datetime) e são respeitados sem gate.
    const allToProcess = merged.filter(({ charge, type }) => {
      const rh = (charge.profiles as ProfileJoin).reminder_hour ?? 8;
      const isDueToday = type === "due_today";
      const isOverdue = !!charge.due_date && charge.due_date < todayDate;
      if (isDueToday || isOverdue) return currentHourBRT >= rh;
      return true; // antecipado agendado — respeita o horário escolhido
    });

    if (allToProcess.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, hour: currentHourBRT });
    }

    // Modo diagnóstico: ?dry=1 apenas lista o que seria enviado, sem enviar
    // nem gravar nada (não muta estado — seguro mesmo autenticado).
    if (req.nextUrl.searchParams.get("dry") === "1") {
      return NextResponse.json({
        ok: true,
        dry: true,
        matched: allToProcess.map(({ charge, type }) => ({
          id: charge.id,
          client: charge.client_name,
          due_date: charge.due_date,
          scheduled_reminder_at: charge.scheduled_reminder_at,
          last_auto_reminder_at: charge.last_auto_reminder_at,
          reminders_sent: charge.reminders_sent,
          status: charge.status,
          type,
        })),
      });
    }

    let sent = 0;
    const details: Array<Record<string, unknown>> = [];
    for (const { charge, type } of allToProcess) {
      const profile = charge.profiles as ProfileJoin;
      if (!charge.client_phone) continue;

      const amount = formatBRL(charge.amount_cents);
      const dueDateFormatted = charge.due_date
        ? charge.due_date.slice(8, 10) + "/" + charge.due_date.slice(5, 7) + "/" + charge.due_date.slice(0, 4)
        : "";

      let message: string;

      if (type === "due_today") {
        // ── No dia do vencimento ──────────────────────────────────────────────
        const tpl = profile.msg_lembrete_hoje || profile.msg_lembrete || DEFAULT_MSG_LEMBRETE_HOJE;
        message = formatTemplate(tpl, {
          nome:    charge.client_name || "Cliente",
          servico: charge.description || "Serviço",
          valor:   amount,
          pix:     profile.pix_key || "",
          data:    dueDateFormatted,
        });
      } else if (charge.due_date && charge.due_date < todayDate) {
        // ── Após o vencimento — cobrança vencida ─────────────────────────────
        const tpl = profile.msg_cobranca_vencida || DEFAULT_MSG_COBRANCA_VENCIDA;
        message = formatTemplate(tpl, {
          nome:    charge.client_name || "Cliente",
          servico: charge.description || "Serviço",
          valor:   amount,
          pix:     profile.pix_key || "",
          data:    dueDateFormatted,
        });
      } else {
        // ── Antecipado: 1 dia antes ou mais ──────────────────────────────────
        message = msgLembrete(
          charge.client_name || "Cliente",
          charge.description || "Serviço",
          amount,
          profile.pix_key || "",
          profile.msg_lembrete || null,
          dueDateFormatted
        );
      }

      const result = await sendWhatsApp({
        to: charge.client_phone,
        message,
        provider: profile.whatsapp_provider as "mock" | "zapi" | "evolution" | "ultramsg",
        token: profile.whatsapp_token || undefined,
        instanceId: profile.whatsapp_instance_id || undefined,
      });

      if (result.ok) {
        await markOutboundSent(charge.profile_id as string, normalizeWhatsAppPhone(charge.client_phone as string));
        // Grava também em send_history — sem isso o envio automático some do
        // "Histórico de envios" na UI (que só lê send_history, não reminders_sent).
        const newHistory = [...((charge.send_history as string[] | null) || []), now];
        const { error: upErr } = await admin
          .from("charges")
          .update({
            last_auto_reminder_at: now,
            reminders_sent: (charge.reminders_sent || 0) + 1,
            send_history: newHistory,
          })
          .eq("id", charge.id);
        if (upErr) {
          // CRÍTICO: sem esse update a cobrança fica elegível para sempre e o cliente recebe spam a cada execução
          console.error("[cron/reminders] UPDATE FALHOU:", { id: charge.id, error: upErr.message });
        }
        sent++;
        details.push({ id: charge.id, client: charge.client_name, type, sendOk: true, updateError: upErr?.message || null });
        console.log("[cron/reminders] enviado:", { id: charge.id, client: charge.client_name, type, due: charge.due_date });
      } else {
        details.push({ id: charge.id, client: charge.client_name, type, sendOk: false, sendError: result.error });
        console.error("[cron/reminders] FALHA:", { id: charge.id, client: charge.client_name, result });
      }
    }

    return NextResponse.json({ ok: true, sent, details });
  } catch (e) {
    console.error("[cron/reminders]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
