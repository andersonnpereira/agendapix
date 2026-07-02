import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  sendWhatsApp, msgLembrete, formatTemplate,
  DEFAULT_MSG_LEMBRETE_HOJE, DEFAULT_MSG_COBRANCA_VENCIDA,
} from "@/lib/whatsapp";
import { formatBRL } from "@/lib/format";

// Sem isso o Next.js trata a rota como estática e o Vercel cacheia a resposta
// no CDN — o cron "roda" mas a função nunca executa (X-Vercel-Cache: HIT)
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    // Data de hoje no fuso horário de Brasília (UTC-3)
    const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
    const nowBRtMs = Date.now() - BRT_OFFSET_MS;
    const todayDate = new Date(nowBRtMs).toISOString().slice(0, 10); // "YYYY-MM-DD" BRT
    const todayStart = todayDate + "T03:00:00.000Z"; // meia-noite BRT = 03:00 UTC

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
    };

    const PROFILE_SELECT = "whatsapp_provider, whatsapp_token, whatsapp_instance_id, msg_lembrete, msg_lembrete_hoje, msg_cobranca_vencida, pix_key";

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
    const allToProcess = [
      ...(advanceCharges || []).map((c) => ({ charge: c, type: "advance" as const })),
      ...(dueTodayCharges || [])
        .filter((c) => !advanceIds.has(c.id))
        .map((c) => ({ charge: c, type: "due_today" as const })),
    ];

    if (allToProcess.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    // Modo diagnóstico: ?dry=1 lista o que seria enviado, sem enviar nada.
    // ?dry=1&fix=1 também executa o update anti-reenvio e retorna as linhas afetadas.
    if (req.nextUrl.searchParams.get("dry") === "1") {
      const fix = req.nextUrl.searchParams.get("fix") === "1";
      const matched: Array<Record<string, unknown>> = [];
      for (const { charge, type } of allToProcess) {
        const entry: Record<string, unknown> = {
          id: charge.id,
          client: charge.client_name,
          due_date: charge.due_date,
          scheduled_reminder_at: charge.scheduled_reminder_at,
          last_auto_reminder_at: charge.last_auto_reminder_at,
          reminders_sent: charge.reminders_sent,
          status: charge.status,
          type,
        };
        if (fix) {
          const { data: upData, error: upErr } = await admin
            .from("charges")
            .update({
              last_auto_reminder_at: now,
              reminders_sent: (charge.reminders_sent || 0) + 1,
            })
            .eq("id", charge.id)
            .select("id, last_auto_reminder_at, reminders_sent");
          entry.update = { error: upErr?.message || null, affectedRows: upData };
        }
        matched.push(entry);
      }
      return NextResponse.json({ ok: true, dry: true, matched });
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
        const { error: upErr } = await admin
          .from("charges")
          .update({
            last_auto_reminder_at: now,
            reminders_sent: (charge.reminders_sent || 0) + 1,
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
