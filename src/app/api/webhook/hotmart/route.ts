import { NextRequest, NextResponse } from "next/server";
import { activatePlanByEmail, type PlanType } from "@/lib/plan-activation";

export async function POST(req: NextRequest) {
  // ── Validação do token ─────────────────────────────────────────────
  const secret = process.env.HOTMART_WEBHOOK_TOKEN;
  if (secret) {
    const token =
      req.headers.get("x-hotmart-webhook-token") ||
      req.nextUrl.searchParams.get("hottok");
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

  const event = (body.event as string) || "";

  // ── Eventos de compra aprovada ─────────────────────────────────────
  const APPROVE_EVENTS = [
    "PURCHASE_APPROVED",
    "PURCHASE_COMPLETE",
    "SUBSCRIPTION_REACTIVATED",
  ];
  if (!APPROVE_EVENTS.includes(event)) {
    // Evento ignorado intencionalmente (refund, etc) — apenas confirma recebimento
    return NextResponse.json({ ok: true, skipped: true });
  }

  const data = (body.data as Record<string, unknown>) || {};
  const buyer = (data.buyer as Record<string, string>) || {};
  const purchase = (data.purchase as Record<string, unknown>) || {};
  const offer = (purchase.offer as Record<string, string>) || {};
  const product = (data.product as Record<string, string>) || {};
  const subscription = (data.subscription as Record<string, unknown>) || {};
  const plan = (subscription.plan as Record<string, string>) || {};

  const email = buyer.email;
  if (!email) {
    return NextResponse.json({ error: "E-mail do comprador não encontrado" }, { status: 422 });
  }

  // Toda venda via Hotmart = acesso vitalício (sem suporte)
  const planType: PlanType = "lifetime";

  // ── Ativa o plano ─────────────────────────────────────────────────
  const result = await activatePlanByEmail(email, planType, "hotmart", body);

  console.log("[webhook/hotmart]", { event, email, planType, ...result });

  return NextResponse.json({ ok: true, ...result });
}
