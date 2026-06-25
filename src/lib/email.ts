/**
 * Notificações por e-mail via Resend (https://resend.com).
 * Se RESEND_API_KEY não estiver definida, apenas loga e retorna true.
 * Sem dependência extra — usa fetch nativo.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Email] RESEND_API_KEY não definida — e-mail NÃO enviado para:", params.to);
    return false;
  }

  // onboarding@resend.dev funciona sem verificar domínio próprio.
  // Para usar domínio próprio, configure RESEND_FROM e verifique o domínio no painel Resend.
  const from = process.env.RESEND_FROM || "Agendou <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error("[Email] Resend erro", res.status, JSON.stringify(body), "| para:", params.to, "| de:", from);
      return false;
    }

    console.log("[Email] Enviado para:", params.to, "| assunto:", params.subject);
    return true;
  } catch (err) {
    console.error("[Email] Exceção ao enviar:", err);
    return false;
  }
}

export function htmlNovoAgendamento(data: {
  clientName: string;
  service: string;
  date: string;
  time: string;
  phone: string;
  siteUrl: string;
}): string {
  return `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
  <div style="background:#16a34a;padding:20px 24px;border-radius:8px 8px 0 0">
    <h2 style="color:#fff;margin:0;font-size:20px">📅 Novo agendamento!</h2>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
    <p>Você recebeu um novo agendamento:</p>
    <table style="width:100%;border-collapse:collapse;margin:12px 0">
      <tr><td style="padding:8px 0;font-weight:700;width:100px">Cliente</td><td style="padding:8px 0">${data.clientName}</td></tr>
      <tr style="background:#f9fafb"><td style="padding:8px;font-weight:700">Serviço</td><td style="padding:8px">${data.service}</td></tr>
      <tr><td style="padding:8px 0;font-weight:700">Data</td><td style="padding:8px 0">${data.date}</td></tr>
      <tr style="background:#f9fafb"><td style="padding:8px;font-weight:700">Horário</td><td style="padding:8px">${data.time}</td></tr>
      <tr><td style="padding:8px 0;font-weight:700">WhatsApp</td><td style="padding:8px 0">${data.phone}</td></tr>
    </table>
    <a href="${data.siteUrl}/agenda" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;margin-top:8px">
      Confirmar agendamento →
    </a>
  </div>
</div>`.trim();
}
