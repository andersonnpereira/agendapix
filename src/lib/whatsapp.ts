export type WhatsAppProvider = "mock" | "zapi" | "evolution" | "ultramsg";

export const DEFAULT_MSG_CONFIRMACAO =
  `Olá, {nome}! 👋\n\nSeu agendamento foi *confirmado*! ✅\n\n✂️ Serviço: *{servico}*\n📅 Data: *{data}* às *{horario}*\n\n*{negocio}* te espera! Qualquer dúvida é só chamar. 😊`;

export const DEFAULT_MSG_PIX =
  `Olá, {nome}! 💳\n\nAqui está o Pix para o serviço *{servico}*:\n💰 Valor: *{valor}*\n\n🔑 *Chave Pix:*\n{pix}\n\nObrigado pelo atendimento! 🙏`;

export const DEFAULT_MSG_LEMBRETE =
  `Olá, {nome}! 👋\n\nPassando para lembrar que o pagamento do serviço *{servico}* no valor de *{valor}* vence em *{data}*.\n\n🔑 *Chave Pix:*\n{pix}\n\nSe já pagou, desconsidere. Obrigado! 😊`;

export const DEFAULT_MSG_LEMBRETE_HOJE =
  `Olá, {nome}! ⏰\n\nLembrete: sua cobrança referente a *{servico}* vence *HOJE*!\n\n💰 Valor: *{valor}*\n📅 Vencimento: *{data}*\n\n🔑 *Chave Pix:*\n{pix}\n\nContamos com você! 🙏`;

export const DEFAULT_MSG_LEMBRETE_AMANHA =
  `Olá, {nome}! 👋\n\nLembrando que você tem *{servico}* amanhã:\n📅 *{data}* às *{horario}*\n📍 *{negocio}*\n\nQualquer dúvida é só chamar. Te esperamos! 😊`;

export const DEFAULT_MSG_COBRANCA_VENCIDA =
  `Olá, {nome}! 😊\n\nPassando para lembrar que temos uma cobrança em aberto no seu nome:\n\n📋 *{servico}*\n💰 Valor: *{valor}*\n📅 Vencimento: *{data}*\n\n🔑 *Chave Pix para pagamento:*\n{pix}\n\nCaso já tenha efetuado o pagamento, desconsidere esta mensagem. 🙏\n\nQualquer dúvida estou à disposição!`;

// Normaliza para o mesmo formato usado no JID do WhatsApp (só dígitos, com
// DDI) — usado tanto para montar o "to" de envio quanto para casar com o
// telefone extraído do webhook (bot_conversations.phone), que vem sempre
// nesse formato. Mantenha em sincronia com a lógica de envio abaixo.
export function normalizeWhatsAppPhone(raw: string): string {
  const hasPlus = raw.trim().startsWith("+");
  const digits = raw.replace(/\D/g, "");
  return hasPlus ? digits : (digits.startsWith("55") ? digits : `55${digits}`);
}

export interface SendWhatsAppParams {
  to: string; // apenas dígitos, com DDI: "5511999998888"
  message: string;
  provider?: WhatsAppProvider;
  token?: string;
  instanceId?: string;
}

/**
 * Envia mensagem WhatsApp via provedor configurado.
 * Em dev (provider=mock), apenas loga no console.
 *
 * Variáveis de ambiente usadas como fallback:
 *   WHATSAPP_PROVIDER, WHATSAPP_TOKEN, WHATSAPP_INSTANCE_ID
 *
 * Para Z-API, também use ZAPI_CLIENT_TOKEN (header obrigatório).
 * Para Evolution API, também use EVOLUTION_API_URL (URL base do servidor).
 */
export async function sendWhatsApp(
  params: SendWhatsAppParams
): Promise<{ ok: boolean; error?: string }> {
  const provider =
    params.provider ||
    (process.env.WHATSAPP_PROVIDER as WhatsAppProvider) ||
    "mock";
  const token = params.token || process.env.WHATSAPP_TOKEN || "";
  const instanceId =
    params.instanceId || process.env.WHATSAPP_INSTANCE_ID || "";
  const phone = params.to.replace(/\D/g, "");
  const phoneWithDDI = normalizeWhatsAppPhone(params.to);
  const { message } = params;

  try {
    switch (provider) {
      case "zapi": {
        const clientToken = process.env.ZAPI_CLIENT_TOKEN || "";
        const res = await fetch(
          `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "client-token": clientToken,
            },
            body: JSON.stringify({ phone: phoneWithDDI, message }),
          }
        );
        if (!res.ok) {
          const body = await res.text();
          return { ok: false, error: `Z-API ${res.status}: ${body}` };
        }
        return { ok: true };
      }

      case "evolution": {
        const baseUrl = (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
        const apiKey = token || process.env.EVOLUTION_API_KEY || "";
        const normalized = phoneWithDDI;
        const res = await fetch(
          `${baseUrl}/message/sendText/${instanceId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: apiKey,
            },
            body: JSON.stringify({
              number: normalized,
              text: message,
            }),
          }
        );
        if (!res.ok) {
          const body = await res.text();
          return { ok: false, error: `Evolution ${res.status}: ${body}` };
        }
        return { ok: true };
      }

      case "ultramsg": {
        const res = await fetch(
          `https://api.ultramsg.com/${instanceId}/messages/chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              token,
              to: `+${phoneWithDDI}`,
              body: message,
            }).toString(),
          }
        );
        if (!res.ok) {
          const body = await res.text();
          return { ok: false, error: `Ultramsg ${res.status}: ${body}` };
        }
        return { ok: true };
      }

      case "mock":
      default:
        console.log(`[WhatsApp Mock] → ${phone}: ${message}`);
        return { ok: true };
    }
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export interface SendWhatsAppImageParams {
  to: string;
  imageUrl: string;   // URL pública da imagem
  caption?: string;   // texto que acompanha a imagem
  provider?: WhatsAppProvider;
  token?: string;
  instanceId?: string;
}

/** Envia imagem (com legenda opcional) via provedor configurado. */
export async function sendWhatsAppImage(
  params: SendWhatsAppImageParams
): Promise<{ ok: boolean; error?: string }> {
  const provider =
    params.provider ||
    (process.env.WHATSAPP_PROVIDER as WhatsAppProvider) ||
    "mock";
  const token = params.token || process.env.WHATSAPP_TOKEN || "";
  const instanceId =
    params.instanceId || process.env.WHATSAPP_INSTANCE_ID || "";
  const phone = params.to.replace(/\D/g, "");
  const phoneWithDDI = normalizeWhatsAppPhone(params.to);
  const { imageUrl, caption } = params;

  try {
    switch (provider) {
      case "zapi": {
        const clientToken = process.env.ZAPI_CLIENT_TOKEN || "";
        const res = await fetch(
          `https://api.z-api.io/instances/${instanceId}/token/${token}/send-image`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "client-token": clientToken },
            body: JSON.stringify({ phone: phoneWithDDI, image: imageUrl, caption: caption || "" }),
          }
        );
        if (!res.ok) return { ok: false, error: `Z-API ${res.status}: ${await res.text()}` };
        return { ok: true };
      }

      case "evolution": {
        const baseUrl = (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
        const apiKey = token || process.env.EVOLUTION_API_KEY || "";
        const res = await fetch(
          `${baseUrl}/message/sendMedia/${instanceId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: apiKey },
            body: JSON.stringify({
              number: phoneWithDDI,
              mediatype: "image",
              media: imageUrl,
              caption: caption || "",
            }),
          }
        );
        if (!res.ok) return { ok: false, error: `Evolution ${res.status}: ${await res.text()}` };
        return { ok: true };
      }

      case "ultramsg": {
        const res = await fetch(
          `https://api.ultramsg.com/${instanceId}/messages/image`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              token,
              to: `+${phoneWithDDI}`,
              image: imageUrl,
              caption: caption || "",
            }).toString(),
          }
        );
        if (!res.ok) return { ok: false, error: `Ultramsg ${res.status}: ${await res.text()}` };
        return { ok: true };
      }

      case "mock":
      default:
        console.log(`[WhatsApp Mock] → ${phone}: [imagem] ${imageUrl} — ${caption || ""}`);
        return { ok: true };
    }
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export function formatTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export function msgConfirmacao(
  clientName: string,
  serviceName: string,
  date: string,
  time: string,
  businessName: string,
  customTemplate?: string | null
): string {
  const tpl = customTemplate || DEFAULT_MSG_CONFIRMACAO;
  return formatTemplate(tpl, { nome: clientName, servico: serviceName, data: date, horario: time, negocio: businessName });
}

export function msgPix(
  clientName: string,
  serviceName: string,
  amount: string,
  pixPayload: string,
  customTemplate?: string | null
): string {
  const tpl = customTemplate || DEFAULT_MSG_PIX;
  return formatTemplate(tpl, { nome: clientName, servico: serviceName, valor: amount, pix: pixPayload });
}

export function msgLembrete(
  clientName: string,
  description: string,
  amount: string,
  pixPayload: string,
  customTemplate?: string | null,
  dueDate?: string | null
): string {
  const tpl = customTemplate || DEFAULT_MSG_LEMBRETE;
  return formatTemplate(tpl, { nome: clientName, servico: description, valor: amount, pix: pixPayload, data: dueDate || "" });
}
