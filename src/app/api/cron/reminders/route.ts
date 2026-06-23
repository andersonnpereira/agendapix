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

    // Busca cobranças com lembrete agendado que ainda não foi enviado
    const { data: charges, error } = await admin
      .from("charges")
      .select("*, profiles!inner(whatsapp_provider, whatsapp_token, whatsapp_instance_id, msg_lembrete, pix_key)")
      .eq("auto_reminder", true)
      .eq("status", "pendente")
      .lte("scheduled_reminder_at", now)
      .is("last_auto_reminder_at", null);

    if (error) throw error;
    if (!charges || charges.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    let sent = 0;
    for (const charge of charges) {
      const profile = charge.profiles as {
        whatsapp_provider: string;
        whatsapp_token: string | null;
        whatsapp_instance_id: string | null;
        msg_lembrete: string | null;
        pix_key: string | null;
      };

      if (!charge.client_phone) continue;

      const amount = formatBRL(charge.amount_cents);
      let message: string;

      const dueDateFormatted = charge.due_date
        ? charge.due_date.slice(8, 10) + "/" + charge.due_date.slice(5, 7) + "/" + charge.due_date.slice(0, 4)
        : "";

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
