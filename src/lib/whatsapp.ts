export type WhatsAppProvider = "mock" | "zapi" | "evolution" | "ultramsg";

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
            body: JSON.stringify({ phone, message }),
          }
        );
        if (!res.ok) {
          const body = await res.text();
          return { ok: false, error: `Z-API ${res.status}: ${body}` };
        }
        return { ok: true };
      }

      case "evolution": {
        const baseUrl = process.env.EVOLUTION_API_URL || "";
        // Evolution API v2: número sem @s.whatsapp.net, com DDI 55
        const normalized = phone.startsWith("55") ? phone : `55${phone}`;
        const res = await fetch(
          `${baseUrl}/message/sendText/${instanceId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: token,
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
              to: `+${phone}`,
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
  if (customTemplate) {
    return formatTemplate(customTemplate, { nome: clientName, servico: serviceName, data: date, horario: time, negocio: businessName });
  }
  return (
    `Olá, ${clientName}! 👋\n\n` +
    `Seu agendamento foi *confirmado*!\n\n` +
    `✅ Serviço: ${serviceName}\n` +
    `📅 Data: ${date}\n` +
    `🕐 Horário: ${time}\n\n` +
    `*${businessName}* te espera. Qualquer dúvida, é só chamar!\n\nObrigado 😊`
  );
}

export function msgPix(
  clientName: string,
  serviceName: string,
  amount: string,
  pixPayload: string,
  customTemplate?: string | null
): string {
  if (customTemplate) {
    return formatTemplate(customTemplate, { nome: clientName, servico: serviceName, valor: amount, pix: pixPayload });
  }
  return (
    `Olá, ${clientName}! 💳\n\n` +
    `Aqui está o Pix para o serviço *${serviceName}*:\n` +
    `💰 Valor: *${amount}*\n\n` +
    `📋 Pix copia e cola:\n${pixPayload}\n\n` +
    `Obrigado pelo atendimento! 🙏`
  );
}

export function msgLembrete(
  clientName: string,
  description: string,
  amount: string,
  pixPayload: string,
  customTemplate?: string | null
): string {
  if (customTemplate) {
    return formatTemplate(customTemplate, { nome: clientName, servico: description, valor: amount, pix: pixPayload });
  }
  return (
    `Olá, ${clientName}! 👋\n\n` +
    `Lembrete de pagamento pendente:\n` +
    `📌 *${description}* — ${amount}\n\n` +
    `📋 Pix copia e cola:\n${pixPayload}\n\n` +
    `Se já pagou, desconsidere. Obrigado! 😊`
  );
}
