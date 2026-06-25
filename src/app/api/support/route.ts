import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { name, email, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
    }

    const supportEmail = process.env.SUPPORT_EMAIL || "anderson.pereira@grupojcn.com.br";

    await sendEmail({
      to: supportEmail,
      subject: `[Ajuda Agendou] Mensagem de ${name}`,
      html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
  <div style="background:#16a34a;padding:20px 24px;border-radius:8px 8px 0 0">
    <h2 style="color:#fff;margin:0;font-size:18px">💬 Mensagem via Central de Ajuda</h2>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <tr><td style="padding:6px 0;font-weight:700;width:80px">Nome</td><td style="padding:6px 0">${name}</td></tr>
      <tr style="background:#f9fafb"><td style="padding:6px;font-weight:700">E-mail</td><td style="padding:6px">
        <a href="mailto:${email}" style="color:#16a34a">${email}</a>
      </td></tr>
    </table>
    <p style="font-weight:700;margin-bottom:8px">Mensagem:</p>
    <div style="background:#f9fafb;border-radius:6px;padding:16px;white-space:pre-wrap;font-size:14px;line-height:1.6">
      ${message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
    </div>
    <p style="margin-top:16px;font-size:12px;color:#94a3b8">
      Responda diretamente para <a href="mailto:${email}" style="color:#16a34a">${email}</a>
    </p>
  </div>
</div>`,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
