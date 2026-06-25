import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "Agendou <onboarding@resend.dev>";
  const to = "andersonnpereira@gmail.com";

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY não definida" });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Teste Agendou — diagnóstico de e-mail",
      html: "<p>Se você recebeu este e-mail, a configuração está funcionando.</p>",
    }),
  });

  const body = await res.json().catch(() => ({}));

  return NextResponse.json({
    ok: res.ok,
    status: res.status,
    from,
    to,
    resend_response: body,
  });
}
