import { createAdminClient } from "@/lib/supabase-admin";
import { sendWhatsApp } from "@/lib/whatsapp";

export type BotState = "idle" | "menu" | "cobranca_lookup" | "human";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "";
const BOT_RESET_MINUTES = 30;

function fmtBRL(cents: number): string {
  return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
}

function fmtDate(d: string | null): string {
  if (!d) return "";
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

async function replyCharges(
  charges: Array<{
    client_name: string | null;
    description: string | null;
    amount_cents: number;
    status: string;
    due_date: string | null;
  }>,
  clientName: string,
  pixKey: string | null,
  reply: (msg: string) => Promise<void>
) {
  const statusLabel: Record<string, string> = {
    pendente: "⏳ Pendente",
    atrasado: "🔴 Vencida",
  };
  const lines = charges.slice(0, 5).map((c) =>
    `• *${c.description || "Cobrança"}* — ${fmtBRL(c.amount_cents)}\n  ${statusLabel[c.status] || c.status}${c.due_date ? ` · Vence ${fmtDate(c.due_date)}` : ""}`
  );
  const pixLine = pixKey ? `\n\n🔑 *Chave Pix:*\n${pixKey}` : "";
  await reply(
    `Olá, *${clientName}*! 👋\n\n` +
      `Você tem ${charges.length} cobrança${charges.length > 1 ? "s" : ""} em aberto:\n\n` +
      lines.join("\n\n") +
      pixLine +
      "\n\nQualquer dúvida, estamos à disposição! 😊"
  );
}

export async function handleBotMessage(
  profileId: string,
  phone: string,
  text: string
): Promise<void> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select(
      "id, whatsapp_provider, whatsapp_token, whatsapp_instance_id, pix_key, slug, business_name, bot_enabled"
    )
    .eq("id", profileId)
    .single();

  if (!profile?.bot_enabled) return;

  const provider = (profile.whatsapp_provider || "evolution") as
    | "mock"
    | "zapi"
    | "evolution"
    | "ultramsg";

  async function reply(message: string) {
    await sendWhatsApp({
      to: phone,
      message,
      provider,
      token: profile!.whatsapp_token || undefined,
      instanceId: profile!.whatsapp_instance_id || undefined,
    });
  }

  // Get/create conversation state
  const { data: conv } = await admin
    .from("bot_conversations")
    .select("state, last_message_at")
    .eq("profile_id", profileId)
    .eq("phone", phone)
    .single();

  const now = new Date();

  let state: BotState = "idle";
  if (conv) {
    const minutesSince =
      (now.getTime() - new Date(conv.last_message_at).getTime()) / 60000;
    state =
      minutesSince > BOT_RESET_MINUTES ? "idle" : (conv.state as BotState);
  }

  const normalized = text.trim().toLowerCase();
  const isGreeting = [
    "oi", "olá", "ola", "hi", "hello", "menu",
    "início", "inicio", "start", "ajuda",
  ].includes(normalized);

  // Greeting always resets to menu (except inside a lookup flow)
  if (isGreeting && state !== "cobranca_lookup") {
    state = "idle";
  }

  let newState: BotState = state;
  const businessName = profile.business_name || "nosso negócio";

  if (state === "idle") {
    await reply(
      `Olá! 👋 Bem-vindo(a) a *${businessName}*!\n\nComo posso ajudar?\n\n` +
        `1️⃣ Agendar um horário\n` +
        `2️⃣ Consultar minha cobrança\n` +
        `3️⃣ Falar com atendente\n\n` +
        `_Digite o número da opção._`
    );
    newState = "menu";
  } else if (state === "menu") {
    if (normalized === "1") {
      const link = profile.slug
        ? `${SITE_URL}/agendar/${profile.slug}`
        : null;
      await reply(
        link
          ? `Clique aqui para agendar:\n${link}\n\nQualquer dúvida é só chamar! 😊`
          : `Entre em contato diretamente para agendar. Te aguardamos! 😊`
      );
      newState = "idle";
    } else if (normalized === "2") {
      // Try to find charges by caller's phone first
      const last8 = phone.replace(/\D/g, "").slice(-8);
      const { data: allCharges } = await admin
        .from("charges")
        .select(
          "id, client_name, client_phone, description, amount_cents, status, due_date"
        )
        .eq("profile_id", profileId)
        .neq("status", "pago")
        .order("due_date")
        .limit(20);

      const byPhone = (allCharges || []).filter(
        (c) =>
          c.client_phone &&
          c.client_phone.replace(/\D/g, "").slice(-8) === last8
      );

      if (byPhone.length > 0) {
        await replyCharges(
          byPhone,
          byPhone[0].client_name || "Cliente",
          profile.pix_key,
          reply
        );
        newState = "idle";
      } else {
        await reply(
          "Para consultar sua cobrança, *informe seu nome completo*:"
        );
        newState = "cobranca_lookup";
      }
    } else if (normalized === "3") {
      await reply(
        "Sua mensagem foi encaminhada! 🙏\nEm breve nossa equipe entrará em contato."
      );
      newState = "human";
    } else {
      await reply(
        "Não entendi. 😕\nEscolha uma das opções:\n\n1️⃣ Agendar\n2️⃣ Cobrança\n3️⃣ Atendente"
      );
      newState = "menu";
    }
  } else if (state === "cobranca_lookup") {
    const { data: charges } = await admin
      .from("charges")
      .select(
        "id, client_name, description, amount_cents, status, due_date"
      )
      .eq("profile_id", profileId)
      .ilike("client_name", `%${text.trim()}%`)
      .neq("status", "pago")
      .order("due_date")
      .limit(5);

    if (!charges || charges.length === 0) {
      await reply(
        `Não encontrei cobranças em aberto para "${text.trim()}". ✅\n\nSe precisar de ajuda, envie *3* para falar com atendente.`
      );
    } else {
      await replyCharges(
        charges,
        charges[0].client_name || text,
        profile.pix_key,
        reply
      );
    }
    newState = "idle";
  } else if (state === "human") {
    await reply(
      "Sua mensagem foi recebida! Em breve nossa equipe retornará. 🙏"
    );
    newState = "human";
  }

  // Persist state
  await admin.from("bot_conversations").upsert(
    {
      profile_id: profileId,
      phone,
      state: newState,
      last_message_at: now.toISOString(),
    },
    { onConflict: "profile_id,phone" }
  );
}
