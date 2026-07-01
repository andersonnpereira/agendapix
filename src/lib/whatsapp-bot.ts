import { createAdminClient } from "@/lib/supabase-admin";
import { sendWhatsApp } from "@/lib/whatsapp";

export type BotState = "idle" | "menu" | "cobranca_lookup" | "human";
// "custom" cobre qualquer resposta livre — texto, links, FAQ, preços, endereço, etc.
// "link" e "message" são aliases legados, tratados como "custom" no motor.
export type BotMenuAction = "schedule" | "charges" | "human" | "custom";

export interface BotMenuItem {
  emoji: string;
  title: string;
  action: BotMenuAction | "link" | "message"; // legado aceito
  value?: string; // resposta para ação custom/link/message
}

export const BOT_DEFAULTS = {
  welcome: "Olá! 👋 Bem-vindo(a) a *{negocio}*!",
  menuHeader: "Como posso ajudar? Escolha uma opção:",
  fallback: "Não entendi 😕 Digite o *número* da opção desejada ou *menu* para recomeçar.",
  human: "Sua mensagem foi encaminhada! 🙏 Em breve nossa equipe entrará em contato.",
  away: "Olá! 👋 No momento estamos fora do horário de atendimento.\n\nRetornaremos em breve! 🕒",
  fallbackMaxTries: 2,
  typingDelayMs: 1200,
  sessionTimeoutMin: 30,
};

export const DEFAULT_MENU_ITEMS: BotMenuItem[] = [
  { emoji: "📅", title: "Agendar horário", action: "schedule" },
  { emoji: "💳", title: "Consultar cobrança", action: "charges" },
  { emoji: "👤", title: "Falar com atendente", action: "human" },
];

const MENU_NUMBERS = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣"];
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "";
const GREETING_WORDS = ["oi","olá","ola","hi","hello","menu","início","inicio","start","ajuda","help","ola!","oi!"];

function fmtBRL(cents: number): string {
  return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
}

function fmtDate(d: string | null): string {
  if (!d) return "";
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

function isWithinBusinessHours(date: Date, startHour: number, endHour: number, days: string[]): boolean {
  // BRT = UTC-3
  const brt = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  const hour = brt.getUTCHours();
  const dayOfWeek = brt.getUTCDay();
  const dayMap: Record<number, string> = { 0: "dom", 1: "seg", 2: "ter", 3: "qua", 4: "qui", 5: "sex", 6: "sab" };
  return days.includes(dayMap[dayOfWeek]) && hour >= startHour && hour < endHour;
}

async function simulateTyping(instanceName: string, apiKey: string, phone: string, delayMs: number): Promise<void> {
  if (!delayMs || !instanceName) return;
  const baseUrl = (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
  if (!baseUrl) return;
  try {
    await fetch(`${baseUrl}/chat/sendPresence/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: phone, options: { presence: "composing", delay: delayMs } }),
    });
    await new Promise((r) => setTimeout(r, delayMs));
  } catch {
    // non-critical
  }
}

async function replyCharges(
  charges: Array<{ client_name: string | null; description: string | null; amount_cents: number; status: string; due_date: string | null }>,
  clientName: string,
  pixKey: string | null,
  reply: (msg: string) => Promise<void>
) {
  const statusLabel: Record<string, string> = { pendente: "⏳ Pendente", atrasado: "🔴 Vencida" };
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

export async function handleBotMessage(profileId: string, phone: string, text: string): Promise<void> {
  const admin = createAdminClient();

  const { data: _profileRaw } = await admin
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .single();

  if (!_profileRaw) return;
  const p = _profileRaw as unknown as Record<string, unknown>;
  if (!p.bot_enabled) return;
  const provider = ((p.whatsapp_provider as string) || "evolution") as "mock" | "zapi" | "evolution" | "ultramsg";
  const instanceName = (p.whatsapp_instance_id as string) || "";
  const apiKey = (p.whatsapp_token as string) || process.env.EVOLUTION_API_KEY || "";
  const businessName = (p.business_name as string) || "nosso negócio";

  const typingDelay = (p.bot_typing_delay_ms as number | null) ?? BOT_DEFAULTS.typingDelayMs;
  const sessionTimeout = (p.bot_session_timeout_min as number | null) ?? BOT_DEFAULTS.sessionTimeoutMin;
  const fallbackMaxTries = (p.bot_fallback_max_tries as number | null) ?? BOT_DEFAULTS.fallbackMaxTries;

  const menuItems: BotMenuItem[] =
    Array.isArray(p.bot_menu_items) && (p.bot_menu_items as BotMenuItem[]).length > 0
      ? (p.bot_menu_items as BotMenuItem[])
      : DEFAULT_MENU_ITEMS;

  async function reply(message: string) {
    await simulateTyping(instanceName, apiKey, phone, typingDelay);
    await sendWhatsApp({
      to: phone,
      message,
      provider,
      token: (p.whatsapp_token as string) || undefined,
      instanceId: (p.whatsapp_instance_id as string) || undefined,
    });
  }

  async function notifyOwner(msg: string) {
    const notifyPhone = (p.bot_notify_phone as string | null)?.trim();
    if (!notifyPhone) return;
    await sendWhatsApp({
      to: notifyPhone,
      message: `🤖 *Bot AgendaPix*\n${msg}`,
      provider,
      token: (p.whatsapp_token as string) || undefined,
      instanceId: (p.whatsapp_instance_id as string) || undefined,
    });
  }

  // Business hours check
  if (p.bot_business_hours_enabled as boolean) {
    const startHour = (p.bot_hours_start as number | null) ?? 8;
    const endHour = (p.bot_hours_end as number | null) ?? 18;
    const days = (p.bot_business_days as string[] | null) ?? ["seg","ter","qua","qui","sex"];
    if (!isWithinBusinessHours(new Date(), startHour, endHour, days)) {
      const awayMsg = (p.bot_away_message as string | null) || BOT_DEFAULTS.away;
      await reply(awayMsg.replace(/\{negocio\}/g, businessName));
      return;
    }
  }

  // Get/create conversation state
  const { data: conv } = await admin
    .from("bot_conversations")
    .select("state, last_message_at, fallback_count")
    .eq("profile_id", profileId)
    .eq("phone", phone)
    .single();

  const now = new Date();
  let state: BotState = "idle";
  let fallbackCount = 0;

  if (conv) {
    const minutesSince = (now.getTime() - new Date(conv.last_message_at).getTime()) / 60000;
    state = minutesSince > sessionTimeout ? "idle" : (conv.state as BotState);
    fallbackCount = (conv.fallback_count as number) ?? 0;
  }

  const normalized = text.trim().toLowerCase();
  const isGreeting = GREETING_WORDS.includes(normalized);

  if (isGreeting && state !== "cobranca_lookup") {
    state = "idle";
    fallbackCount = 0;
  }

  let newState: BotState = state;
  let newFallbackCount = 0;

  const welcomeMsg = (p.bot_welcome_message as string | null) || BOT_DEFAULTS.welcome;
  const menuHeader = (p.bot_menu_header as string | null) || BOT_DEFAULTS.menuHeader;
  const fallbackMsg = (p.bot_fallback_message as string | null) || BOT_DEFAULTS.fallback;
  const humanMsg = (p.bot_human_message as string | null) || BOT_DEFAULTS.human;

  function buildMenuText(): string {
    const items = menuItems.slice(0, 9)
      .map((item, i) => `${MENU_NUMBERS[i]} ${item.emoji} ${item.title}`)
      .join("\n");
    return `${welcomeMsg.replace(/\{negocio\}/g, businessName)}\n\n${menuHeader}\n\n${items}\n\n_Digite o número da opção._`;
  }

  if (state === "idle") {
    await reply(buildMenuText());
    newState = "menu";

  } else if (state === "menu") {
    const choice = parseInt(normalized) - 1;
    const item = menuItems[choice];

    if (!item) {
      newFallbackCount = fallbackCount + 1;
      if (newFallbackCount >= fallbackMaxTries) {
        await reply(humanMsg);
        newState = "human";
        newFallbackCount = 0;
        await notifyOwner(`Cliente *${phone}* foi escalado ao atendente após ${newFallbackCount + fallbackMaxTries} tentativas sem resposta válida.`);
      } else {
        const extra = (fallbackMaxTries - newFallbackCount === 1)
          ? "\n\n_Última tentativa antes de encaminhar ao atendente._"
          : "";
        await reply(fallbackMsg + extra);
        newState = "menu";
      }
    } else {
      newFallbackCount = 0;

      if (item.action === "schedule") {
        const link = p.slug ? `${SITE_URL}/agendar/${p.slug as string}` : null;
        await reply(
          link
            ? `📅 Clique aqui para agendar:\n${link}\n\nQualquer dúvida é só chamar! 😊`
            : `Entre em contato diretamente para agendar. Te aguardamos! 😊`
        );
        newState = "idle";

      } else if (item.action === "charges") {
        const last8 = phone.replace(/\D/g, "").slice(-8);
        const { data: allCharges } = await admin
          .from("charges")
          .select("id, client_name, client_phone, description, amount_cents, status, due_date")
          .eq("profile_id", profileId)
          .neq("status", "pago")
          .order("due_date")
          .limit(20);
        const byPhone = (allCharges || []).filter(
          (c) => c.client_phone && c.client_phone.replace(/\D/g, "").slice(-8) === last8
        );
        if (byPhone.length > 0) {
          await replyCharges(byPhone, byPhone[0].client_name || "Cliente", p.pix_key as string | null, reply);
          newState = "idle";
        } else {
          await reply("Para consultar sua cobrança, *informe seu nome completo*:");
          newState = "cobranca_lookup";
        }

      } else if (item.action === "human") {
        await reply(humanMsg);
        newState = "human";
        await notifyOwner(`Cliente *${phone}* solicitou atendimento humano.`);

      } else {
        // custom / link / message — resposta personalizada livre
        const msg = (item.value || `Obrigado por entrar em contato com *${businessName}*! 😊`).replace(/\{negocio\}/g, businessName);
        await reply(msg);
        newState = "idle";
      }
    }

  } else if (state === "cobranca_lookup") {
    const { data: charges } = await admin
      .from("charges")
      .select("id, client_name, description, amount_cents, status, due_date")
      .eq("profile_id", profileId)
      .ilike("client_name", `%${text.trim()}%`)
      .neq("status", "pago")
      .order("due_date")
      .limit(5);

    if (!charges || charges.length === 0) {
      await reply(`Não encontrei cobranças em aberto para "*${text.trim()}*" ✅\n\nEnvie *menu* para voltar ao início ou *3* para falar com atendente.`);
    } else {
      await replyCharges(charges, charges[0].client_name || text, p.pix_key as string | null, reply);
    }
    newState = "idle";

  } else if (state === "human") {
    await reply("Sua mensagem foi recebida! Em breve nossa equipe retornará. 🙏");
    newState = "human";
    await notifyOwner(`Nova mensagem de *${phone}*:\n"${text.slice(0, 200)}"`);
  }

  await admin.from("bot_conversations").upsert(
    { profile_id: profileId, phone, state: newState, last_message_at: now.toISOString(), fallback_count: newFallbackCount },
    { onConflict: "profile_id,phone" }
  );
}
