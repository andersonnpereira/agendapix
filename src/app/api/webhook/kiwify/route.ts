import { NextRequest, NextResponse } from "next/server";
import { activatePlanByEmail, type PlanType } from "@/lib/plan-activation";

export async function POST(req: NextRequest) {
  // ── Validação do token ─────────────────────────────────────────────
  const secret = process.env.KIWIFY_WEBHOOK_SECRET;
  if (secret) {
    const token =
      req.headers.get("kiwify-secret") ||
      req.nextUrl.searchParams.get("token");
    if (token !== secret) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  // Kiwify usa order_status ou event para indicar aprovação
  const orderStatus = (body.order_status as string) || (body.OrderStatus as string) || "";
  const event = (body.event as string) || "";

  const APPROVED_STATUSES = ["paid", "approved"];
  const isApproved =
    APPROVED_STATUSES.includes(orderStatus.toLowerCase()) ||
    event === "order.approved";

  if (!isApproved) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // ── Extrai campos — Kiwify tem dois formatos (v1 e v2) ────────────
  const personalData =
    (body.PersonalData as Record<string, string>) ||
    (body.customer as Record<string, string>) ||
    {};
  const productData =
    (body.Product as Record<string, string>) ||
    (body.product as Record<string, string>) ||
    {};
  const subscriptionData =
    (body.Subscription as Record<string, string>) ||
    (body.subscription as Record<string, string>) ||
    {};

  const email = personalData.Email || personalData.email || (body.email as string);
  if (!email) {
    return NextResponse.json({ error: "E-mail do comprador não encontrado" }, { status: 422 });
  }

  // Toda venda via Kiwify = acesso vitalício (sem suporte)
  const planType: PlanType = "lifetime";

  // ── Ativa o plano ─────────────────────────────────────────────────
  const result = await activatePlanByEmail(email, planType, "kiwify", body);

  console.log("[webhook/kiwify]", { event, orderStatus, email, planType, ...result });

  return NextResponse.json({ ok: true, ...result });
}
