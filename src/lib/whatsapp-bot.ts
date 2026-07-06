import { createAdminClient } from "@/lib/supabase-admin";
import { sendWhatsApp, sendWhatsAppImage } from "@/lib/whatsapp";

export type BotState = "idle" | "menu" | "cobranca_lookup" | "human";
export type BotSpecialAction = "schedule" | "charges" | "human";
export type BotTriggerMode = "always" | "keywords" | "new_session" | "keywords_or_new";

// Um item dentro de um fluxo
export interface BotFlowItem {
  emoji: string;
  title: string;
  value?: string;              // texto livre enviado ao cliente
  imageUrl?: string;           // imagem opcional enviada junto (texto vira legenda)
  nextFlow?: string;           // ID do próximo fluxo (sub-menu)
  action?: BotSpecialAction | "custom" | "link" | "message"; // legado ou ação especial
}

// Um fluxo (pode ser o menu principal ou um sub-menu)
export interface BotFlow {
  id: string;         // slug único, ex: "main", "suporte", "como_funciona"
  name: string;       // nome exibido no editor
  message: string;    // mensagem enviada ao entrar nesse fluxo (antes de listar as opções)
  imageUrl?: string;  // imagem opcional enviada com a mensagem de entrada (vira legenda)
  items: BotFlowItem[];
}

// Legado — mantido para leitura de dados antigos
export interface BotMenuItem {
  emoji: string;
  title: string;
  value?: string;
  action?: BotSpecialAction | "custom" | "link" | "message";
}

export const BOT_DEFAULTS = {
  fallback: "Não entendi 😕 Digite o *número* da opção desejada ou *menu* para recomeçar.",
  human: "Sua mensagem foi encaminhada! 🙏 Em breve nossa equipe entrará em contato.",
  away: "Olá! 👋 No momento estamos fora do horário de atendimento.\n\nRetornaremos em breve! 🕒",
  fallbackMaxTries: 2,
  typingDelayMs: 1200,
  sessionTimeoutMin: 30,
  humanTimeoutHours: 24,
  triggerMode: "keywords" as BotTriggerMode,
  triggerKeywords: ["oi","olá","ola","hi","hello","menu","início","inicio","start","ajuda","help","info","informações"],
  triggerNewConvHours: 24,
};

export const DEFAULT_FLOWS: BotFlow[] = [
  {
    id: "main",
    name: "Menu Principal",
    message: "Olá! 👋 Bem-vindo(a) a *{negocio}*!\n\nComo posso ajudar? Escolha uma opção:",
    items: [
      { emoji: "📅", title: "Agendar horário",    action: "schedule" },
      { emoji: "💳", title: "Consultar cobrança", action: "charges" },
      { emoji: "👤", title: "Falar com atendente",action: "human" },
    ],
  },
];

// Janela de tolerância entre nós enviarmos uma mensagem e o eco "fromMe"
// dela voltar pelo webhook da Evolution API — usada para diferenciar "essa
// mensagem fromMe é o eco do que ACABAMOS de mandar" de "o profissional
// respondeu manualmente pelo próprio celular".
const OUTBOUND_ECHO_WINDOW_MS = 30_000;

const MENU_NUMBERS = [
  "1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣",
  "🔟","1️⃣1️⃣","1️⃣2️⃣","1️⃣3️⃣","1️⃣4️⃣","1️⃣5️⃣",
];
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "";

function fmtBRL(cents: number): string {
  return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
}

// Normaliza um telefone para comparação: só dígitos, remove DDI 55 e o
// nono dígito do celular, retornando DDD + 8 dígitos finais. Assim
// "5511999998888", "11999998888" e "1199998888" convergem, sem colidir
// com clientes de DDDs diferentes (o DDD é preservado).
function normalizePhoneForMatch(raw: string | null | undefined): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2); // remove DDI
  if (d.length === 11) d = d.slice(0, 2) + d.slice(3);      // remove 9º dígito
  return d; // esperado: 10 dígitos (DDD + 8)
}
function fmtDate(d: string | null): string {
  if (!d) return "";
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

function isWithinBusinessHours(date: Date, startHour: number, endHour: number, days: string[]): boolean {
  const brt = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  const hour = brt.getUTCHours();
  const dayMap: Record<number, string> = { 0:"dom",1:"seg",2:"ter",3:"qua",4:"qui",5:"sex",6:"sab" };
  return days.includes(dayMap[brt.getUTCDay()]) && hour >= startHour && hour < endHour;
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
  } catch { /* non-critical */ }
}

async function replyCharges(
  charges: Array<{ client_name: string | null; description: string | null; amount_cents: number; status: string; due_date: string | null }>,
  clientName: string, pixKey: string | null, reply: (msg: string) => Promise<void>
) {
  const statusLabel: Record<string, string> = { pendente: "⏳ Pendente", atrasado: "🔴 Vencida" };
  const lines = charges.slice(0, 5).map((c) =>
    `• *${c.description || "Cobrança"}* — ${fmtBRL(c.amount_cents)}\n  ${statusLabel[c.status] || c.status}${c.due_date ? ` · Vence ${fmtDate(c.due_date)}` : ""}`
  );
  const pixLine = pixKey ? `\n\n🔑 *Chave Pix:*\n${pixKey}` : "";
  await reply(
    `Olá, *${clientName}*! 👋\n\n` +
    `Você tem ${charges.length} cobrança${charges.length > 1 ? "s" : ""} em aberto:\n\n` +
    lines.join("\n\n") + pixLine +
    "\n\nQualquer dúvida, estamos à disposição! 😊"
  );
}

function resolveFlows(p: Record<string, unknown>): BotFlow[] {
  // Prioridade 1: bot_flows (novo formato multi-nível)
  if (Array.isArray(p.bot_flows) && (p.bot_flows as BotFlow[]).length > 0) {
    return p.bot_flows as BotFlow[];
  }
  // Prioridade 2: bot_menu_items (legado — migra para fluxo único)
  if (Array.isArray(p.bot_menu_items) && (p.bot_menu_items as BotMenuItem[]).length > 0) {
    const legacyItems = p.bot_menu_items as BotMenuItem[];
    return [{
      id: "main",
      name: "Menu Principal",
      message: (p.bot_welcome_message as string) ||
        `Olá! 👋 Bem-vindo(a) a *{negocio}*!\n\n${p.bot_menu_header as string || "Como posso ajudar? Escolha uma opção:"}`,
      items: legacyItems.map((item) => ({
        emoji: item.emoji,
        title: item.title,
        value: item.value || "",
        action: (item.action === "schedule" || item.action === "charges" || item.action === "human")
          ? item.action
          : undefined,
      })),
    }];
  }
  return DEFAULT_FLOWS;
}

function buildFlowText(flow: BotFlow, businessName: string): string {
  const items = flow.items.slice(0, 15)
    .map((item, i) => `${MENU_NUMBERS[i]} ${item.emoji} ${item.title}`)
    .join("\n");
  return `${flow.message.replace(/\{negocio\}/g, businessName)}\n\n${items}\n\n_Digite o número da opção._`;
}

// Chamado por TODO envio de WhatsApp ao cliente (bot, lembretes automáticos
// de cron, cobrança manual, confirmação de agendamento) — grava o horário
// para handleOwnerOutbound conseguir distinguir "eco do que acabamos de
// mandar" de "o profissional respondeu manualmente pelo celular dele".
// Falha aqui nunca deve derrubar o envio em si — por isso engole erros.
export async function markOutboundSent(profileId: string, phone: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("bot_conversations").upsert(
      { profile_id: profileId, phone, last_outbound_at: new Date().toISOString() },
      { onConflict: "profile_id,phone" }
    );
  } catch (e) {
    console.error("[whatsapp-bot] markOutboundSent falhou:", e);
  }
}

// Chamado pelo webhook quando chega um evento fromMe=true (mensagem saída do
// próprio número do profissional). Duas origens possíveis:
//   1) Eco de algo que NÓS enviamos há poucos segundos (bot, cron, cobrança) —
//      ignorar, o estado da conversa já reflete isso.
//   2) O profissional respondeu manualmente pelo app do celular — o bot não
//      pode continuar empurrando menu/escalonamento por cima de um
//      atendimento humano que já está em andamento. Pausa em estado "human".
export async function handleOwnerOutbound(profileId: string, phone: string): Promise<void> {
  const admin = createAdminClient();
  const { data: conv } = await admin
    .from("bot_conversations")
    .select("last_outbound_at, state")
    .eq("profile_id", profileId)
    .eq("phone", phone)
    .single();

  if (conv?.last_outbound_at) {
    const sinceMs = Date.now() - new Date(conv.last_outbound_at).getTime();
    if (sinceMs >= 0 && sinceMs < OUTBOUND_ECHO_WINDOW_MS) return; // eco do nosso próprio envio
  }
  if (conv?.state === "human") return; // já pausado

  await admin.from("bot_conversations").upsert(
    { profile_id: profileId, phone, state: "human", last_message_at: new Date().toISOString(), fallback_count: 0 },
    { onConflict: "profile_id,phone" }
  );
  console.log("[whatsapp-bot] resposta manual do profissional detectada — bot pausado:", { profileId, phone });
}

export async function handleBotMessage(profileId: string, phone: string, text: string): Promise<void> {
  const admin = createAdminClient();
  const { data: _raw } = await admin.from("profiles").select("*").eq("id", profileId).single();
  if (!_raw) { console.warn("[whatsapp-bot] perfil não encontrado:", profileId); return; }
  const p = _raw as unknown as Record<string, unknown>;
  if (!p.bot_enabled) { console.log("[whatsapp-bot] bot desativado para perfil:", profileId); return; }

  const provider = ((p.whatsapp_provider as string) || "evolution") as "mock"|"zapi"|"evolution"|"ultramsg";
  const instanceName = (p.whatsapp_instance_id as string) || "";
  const apiKey = (p.whatsapp_token as string) || process.env.EVOLUTION_API_KEY || "";
  const businessName = (p.business_name as string) || "nosso negócio";
  const typingDelay = (p.bot_typing_delay_ms as number | null) ?? BOT_DEFAULTS.typingDelayMs;
  const sessionTimeout = (p.bot_session_timeout_min as number | null) ?? BOT_DEFAULTS.sessionTimeoutMin;
  const fallbackMaxTries = (p.bot_fallback_max_tries as number | null) ?? BOT_DEFAULTS.fallbackMaxTries;

  const flows = resolveFlows(p);

  async function reply(message: string, imageUrl?: string) {
    await simulateTyping(instanceName, apiKey, phone, typingDelay);
    const common = { to: phone, provider, token: (p.whatsapp_token as string) || undefined, instanceId: (p.whatsapp_instance_id as string) || undefined };
    const result = imageUrl
      ? await sendWhatsAppImage({ ...common, imageUrl, caption: message })
      : await sendWhatsApp({ ...common, message });
    if (!result.ok) {
      console.error("[whatsapp-bot] falha ao enviar:", result.error, { phone, provider, instanceName, comImagem: !!imageUrl });
      // Fallback: se a imagem falhou, garante que o texto chegue
      if (imageUrl && message) await sendWhatsApp({ ...common, message });
    }
    await markOutboundSent(profileId, phone);
  }
  async function notifyOwner(msg: string) {
    const notifyPhone = (p.bot_notify_phone as string | null)?.trim();
    if (!notifyPhone) return;
    await sendWhatsApp({ to: notifyPhone, message: `🤖 *Bot*\n${msg}`, provider, token: (p.whatsapp_token as string) || undefined, instanceId: (p.whatsapp_instance_id as string) || undefined });
  }

  // Horário de atendimento
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

  // Carregar conversa
  const { data: conv } = await admin
    .from("bot_conversations")
    .select("state, last_message_at, fallback_count, current_flow")
    .eq("profile_id", profileId)
    .eq("phone", phone)
    .single();

  const now = new Date();
  let state: BotState = "idle";
  let fallbackCount = 0;
  let currentFlowId = "main";

  const humanTimeoutHours = (p.bot_human_timeout_hours as number | null) ?? BOT_DEFAULTS.humanTimeoutHours;

  if (conv) {
    const minutesSince = (now.getTime() - new Date(conv.last_message_at).getTime()) / 60000;
    const hoursSince = minutesSince / 60;
    const convState = conv.state as BotState;
    if (convState === "human") {
      // Modo humano expira após humanTimeoutHours horas de inatividade do cliente.
      // 0 = "nunca expira" pelo config, mas há um teto de segurança absoluto de
      // 30 dias para o cliente nunca ficar preso caso desconheça "menu"/"0".
      const HUMAN_MAX_HOURS = 24 * 30;
      const effectiveTimeout = humanTimeoutHours > 0 ? Math.min(humanTimeoutHours, HUMAN_MAX_HOURS) : HUMAN_MAX_HOURS;
      state = hoursSince > effectiveTimeout ? "idle" : "human";
    } else {
      state = minutesSince > sessionTimeout ? "idle" : convState;
    }
    fallbackCount = (conv.fallback_count as number) ?? 0;
    currentFlowId = (conv.current_flow as string) || "main";
  }

  const normalized = text.trim().toLowerCase();
  const firstWord = normalized.split(/[\s!?,.:;]+/)[0] || normalized;

  const RESTART_WORDS = ["menu", "0", "reiniciar", "restart", "inicio", "início"];
  const isExplicitRestart = RESTART_WORDS.includes(normalized) || RESTART_WORDS.includes(firstWord);

  if (state === "human") {
    if (isExplicitRestart) {
      state = "idle";
      fallbackCount = 0;
      currentFlowId = "main";
    }
    // Nenhuma outra mensagem reinicia em modo humano — bot permanece silencioso
  } else if (isExplicitRestart && state !== "idle") {
    // Restart explícito ("menu", "0", etc.) de qualquer estado ativo → volta ao início
    state = "idle";
    fallbackCount = 0;
    currentFlowId = "main";
  }
  // Saudações ("oi", "olá"…) não são restart explícito — se state === "menu",
  // viram entrada inválida → fallback (bot não reinicia no meio da conversa)

  // Gatilho: só bloqueia ativações frias (state === idle, sem ser restart
  // explícito, não modo humano). "menu"/"0"/etc. sempre reabrem o bot — o
  // resto (saudações, palavras livres) respeita o trigger_mode configurado
  // pelo profissional, para não ativar o bot fora do que ele escolheu.
  if (state === "idle" && !isExplicitRestart) {
    const triggerMode = (p.bot_trigger_mode as BotTriggerMode | null) || BOT_DEFAULTS.triggerMode;
    const triggerKeywords: string[] = (p.bot_trigger_keywords as string[] | null) || BOT_DEFAULTS.triggerKeywords;
    const triggerNewConvHours = (p.bot_trigger_new_conv_hours as number | null) ?? BOT_DEFAULTS.triggerNewConvHours;

    function keywordMatch(): boolean {
      return triggerKeywords.some((kw) => {
        const k = kw.toLowerCase().trim();
        return firstWord === k || normalized === k;
      });
    }
    function isNewSession(): boolean {
      if (!conv) return true;
      const hoursSince = (now.getTime() - new Date(conv.last_message_at).getTime()) / 3600000;
      return hoursSince > triggerNewConvHours;
    }

    let activate = false;
    if (triggerMode === "always") activate = true;
    else if (triggerMode === "keywords") activate = keywordMatch();
    else if (triggerMode === "new_session") activate = isNewSession();
    else if (triggerMode === "keywords_or_new") activate = keywordMatch() || isNewSession();

    if (!activate) {
      console.log("[whatsapp-bot] gatilho não ativado:", { triggerMode, normalized, firstWord });
      return;
    }
  }

  let newState: BotState = state;
  let newFallbackCount = 0;
  let newCurrentFlowId = currentFlowId;

  const fallbackMsg = (p.bot_fallback_message as string | null) || BOT_DEFAULTS.fallback;
  const humanMsg = (p.bot_human_message as string | null) || BOT_DEFAULTS.human;

  // Estado idle → mostrar menu principal
  if (state === "idle") {
    const mainFlow = flows.find((f) => f.id === "main") || flows[0];
    await reply(buildFlowText(mainFlow, businessName), mainFlow.imageUrl);
    newState = "menu";
    newCurrentFlowId = mainFlow.id;

  } else if (state === "menu") {
    const currentFlow = flows.find((f) => f.id === currentFlowId) || flows[0];
    const choice = parseInt(normalized) - 1;
    const item = currentFlow?.items[choice];

    if (!item) {
      newFallbackCount = fallbackCount + 1;
      if (newFallbackCount >= fallbackMaxTries) {
        await reply(humanMsg);
        newState = "human";
        newFallbackCount = 0;
        await notifyOwner(`Cliente *${phone}* escalado ao atendente após respostas inválidas.`);
      } else {
        const hint = fallbackMaxTries - newFallbackCount === 1 ? "\n\n_Última tentativa._" : "";
        await reply(fallbackMsg + hint);
        newState = "menu";
      }
      newCurrentFlowId = currentFlowId;

    } else {
      newFallbackCount = 0;
      const freeText = (item.value || "").trim()
        .replace(/\{negocio\}/g, businessName)
        .replace(/\{link_agendamento\}/g, p.slug ? `${SITE_URL}/agendar/${p.slug as string}` : "");

      if (item.nextFlow) {
        // Navegar para sub-fluxo
        const nextFlow = flows.find((f) => f.id === item.nextFlow);
        if (nextFlow) {
          if (freeText || item.imageUrl) await reply(freeText, item.imageUrl);
          await reply(buildFlowText(nextFlow, businessName), nextFlow.imageUrl);
          newState = "menu";
          newCurrentFlowId = nextFlow.id;
        } else {
          await reply(freeText || `Obrigado por entrar em contato com *${businessName}*! 😊`, item.imageUrl);
          newState = "idle";
          newCurrentFlowId = "main";
        }

      } else if (item.action === "schedule") {
        const link = p.slug ? `${SITE_URL}/agendar/${p.slug as string}` : null;
        if (freeText || item.imageUrl) await reply(freeText, item.imageUrl);
        if (!freeText || !freeText.includes(link || "")) {
          await reply(link
            ? `📅 Clique aqui para agendar:\n${link}\n\nQualquer dúvida é só chamar! 😊`
            : `Entre em contato diretamente para agendar. 😊`);
        }
        newState = "idle";
        newCurrentFlowId = "main";

      } else if (item.action === "charges") {
        const target = normalizePhoneForMatch(phone);
        const { data: allCharges } = await admin
          .from("charges")
          .select("id, client_name, client_phone, description, amount_cents, status, due_date")
          .eq("profile_id", profileId).neq("status", "pago").order("due_date").limit(20);
        const byPhone = (allCharges || []).filter(
          (c) => c.client_phone && target.length >= 10 && normalizePhoneForMatch(c.client_phone) === target
        );
        if (freeText || item.imageUrl) await reply(freeText, item.imageUrl);
        if (byPhone.length > 0) {
          await replyCharges(byPhone, byPhone[0].client_name || "Cliente", p.pix_key as string | null, reply);
          newState = "idle";
        } else {
          await reply("Para consultar sua cobrança, *informe seu nome completo*:");
          newState = "cobranca_lookup";
        }
        newCurrentFlowId = "main";

      } else if (item.action === "human") {
        await reply(freeText || humanMsg, item.imageUrl);
        newState = "human";
        newCurrentFlowId = "main";
        await notifyOwner(`Cliente *${phone}* solicitou atendimento humano.`);

      } else {
        // Resposta livre pura
        await reply(freeText || `Obrigado por entrar em contato com *${businessName}*! 😊`, item.imageUrl);
        newState = "idle";
        newCurrentFlowId = "main";
      }
    }

  } else if (state === "cobranca_lookup") {
    // Escapa metacaracteres de LIKE (%, _, \) para evitar wildcard injection
    // e exige um nome plausível (mín. 3 caracteres) antes de consultar.
    const rawName = text.trim();
    const safeName = rawName.replace(/[\\%_]/g, "\\$&");
    const charges = rawName.length < 3 ? [] : (await admin
      .from("charges")
      .select("id, client_name, description, amount_cents, status, due_date")
      .eq("profile_id", profileId).ilike("client_name", `%${safeName}%`).neq("status", "pago").order("due_date").limit(5)).data;
    if (rawName.length < 3) {
      // Nome muito curto — permanece aguardando o nome completo
      await reply("Por favor, informe seu *nome completo* para consultar. 🙂");
      newState = "cobranca_lookup";
      newCurrentFlowId = "main";
    } else {
      if (!charges || charges.length === 0) {
        await reply(`Não encontrei cobranças para "*${rawName}*" ✅\n\nEnvie *menu* para voltar ao início.`);
      } else {
        await replyCharges(charges, charges[0].client_name || rawName, p.pix_key as string | null, reply);
      }
      newState = "idle";
      newCurrentFlowId = "main";
    }

  } else if (state === "human") {
    // Bot desativado — apenas encaminha mensagem ao atendente, sem responder ao cliente
    await notifyOwner(`💬 *${phone}*:\n"${text.slice(0, 300)}"`);
    newState = "human";
    newCurrentFlowId = currentFlowId;
  }

  await admin.from("bot_conversations").upsert(
    { profile_id: profileId, phone, state: newState, last_message_at: now.toISOString(), fallback_count: newFallbackCount, current_flow: newCurrentFlowId },
    { onConflict: "profile_id,phone" }
  );
}
