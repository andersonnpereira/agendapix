import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { name, email, message } = await req.json();
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "Preencha todos os campos." }, { status: 400 });
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `[Agendou Suporte] ${name} — ${email}`,
        html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
  <div style="background:#16a34a;padding:20px 24px;border-radius:8px 8px 0 0">
    <h2 style="color:#fff;margin:0;font-size:20px">💬 Nova mensagem de suporte</h2>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
    <p style="margin:0 0 8px"><strong>Nome:</strong> ${name}</p>
    <p style="margin:0 0 16px"><strong>E-mail:</strong> ${email}</p>
    <p style="margin:0 0 8px"><strong>Mensagem:</strong></p>
    <div style="background:#f9fafb;border-radius:8px;padding:16px;white-space:pre-wrap;font-size:14px;line-height:1.6">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
  </div>
</div>`.trim(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
