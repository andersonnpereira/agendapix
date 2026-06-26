import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendWhatsApp, msgLembrete, formatTemplate } from "@/lib/whatsapp";
import { formatBRL } from "@/lib/format";

export async function GET(req: NextRequest) {
  // Protege o endpoint: Vercel passa Authorization ou CRON_SECRET
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
    const todayDate = now.slice(0, 10); // "YYYY-MM-DD"
    const todayStart = todayDate + "T00:00:00.000Z";

    type ProfileJoin = {
      whatsapp_provider: string;
      whatsapp_token: string | null;
      whatsapp_instance_id: string | null;
      msg_lembrete: string | null;
      pix_key: string | null;
    };

    // ── 1. Lembretes antecipados — dispara diariamente até o pagamento ────
    // Condição: data agendada já chegou E ainda não enviou hoje
    const { data: advanceCharges, error } = await admin
      .from("charges")
      .select("*, profiles!inner(whatsapp_provider, whatsapp_token, whatsapp_instance_id, msg_lembrete, pix_key)")
      .eq("auto_reminder", true)
      .eq("status", "pendente")
      .lte("scheduled_reminder_at", now)
      .or(`last_auto_reminder_at.is.null,last_auto_reminder_at.lt.${todayStart}`);

    if (error) throw error;

    // ── 2. Lembretes de vencimento no dia ──────────────────────────────────
    // Envia para charges com due_date = hoje que ainda não receberam lembrete hoje
    const { data: dueTodayCharges } = await admin
      .from("charges")
      .select("*, profiles!inner(whatsapp_provider, whatsapp_token, whatsapp_instance_id, msg_lembrete, pix_key)")
      .eq("auto_reminder", true)
      .eq("status", "pendente")
      .eq("due_date", todayDate)
      .or(`last_auto_reminder_at.is.null,last_auto_reminder_at.lt.${todayStart}`);

    // Mescla listas removendo duplicatas (um charge pode aparecer nos dois grupos)
    const advanceIds = new Set((advanceCharges || []).map((c) => c.id));
    const allToProcess = [
      ...(advanceCharges || []).map((c) => ({ charge: c, type: "advance" as const })),
      ...(dueTodayCharges || [])
        .filter((c) => !advanceIds.has(c.id)) // evita enviar duas vezes no mesmo cron
        .map((c) => ({ charge: c, type: "due_today" as const })),
    ];

    if (allToProcess.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    let sent = 0;
    for (const { charge, type } of allToProcess) {
      const profile = charge.profiles as ProfileJoin;
      if (!charge.client_phone) continue;

      const amount = formatBRL(charge.amount_cents);
      const dueDateFormatted = charge.due_date
        ? charge.due_date.slice(8, 10) + "/" + charge.due_date.slice(5, 7) + "/" + charge.due_date.slice(0, 4)
        : "";

      let message: string;

      if (type === "due_today") {
        // Mensagem específica para o dia do vencimento
        message = profile.msg_lembrete
          ? formatTemplate(profile.msg_lembrete, {
              nome: charge.client_name || "Cliente",
              servico: charge.description || "Serviço",
              valor: amount,
              pix: profile.pix_key || "",
              data: dueDateFormatted,
            })
          : [
              `Olá, ${charge.client_name || "Cliente"}! ⏰`,
              ``,
              `Lembrete: sua cobrança vence *HOJE*!`,
              ``,
              `📋 ${charge.description || "Serviço"}`,
              `💰 Valor: *${amount}*`,
              `📅 Vencimento: *${dueDateFormatted}*`,
              profile.pix_key ? `\n🔑 Chave Pix:\n${profile.pix_key}` : "",
              ``,
              `Contamos com você! 🙏`,
            ].filter((l) => l !== undefined).join("\n");
      } else {
        if (profile.msg_lembrete) {
          message = formatTemplate(profile.msg_lembrete, {
            nome: charge.client_name || "Cliente",
            servico: charge.description || "Serviço",
            valor: amount,
            pix: profile.pix_key || "",
            data: dueDateFormatted,
          });
        } else {
          message = msgLembrete(
            charge.client_name || "Cliente",
            charge.description || "Serviço",
            amount,
            profile.pix_key || "",
            null,
            dueDateFormatted
          );
        }
      }

      const result = await sendWhatsApp({
        to: charge.client_phone,
        message,
        provider: profile.whatsapp_provider as "mock" | "zapi" | "evolution" | "ultramsg",
        token: profile.whatsapp_token || undefined,
        instanceId: profile.whatsapp_instance_id || undefined,
      });

      if (result.ok) {
        await admin
          .from("charges")
          .update({
            last_auto_reminder_at: now,
            reminders_sent: (charge.reminders_sent || 0) + 1,
          })
          .eq("id", charge.id);
        sent++;
      }
    }

    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    console.error("[cron/reminders]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
