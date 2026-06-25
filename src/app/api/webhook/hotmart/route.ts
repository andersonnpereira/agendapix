import { NextRequest, NextResponse } from "next/server";
import { activatePlanByEmail, detectPlanType, type PlanType } from "@/lib/plan-activation";

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

  // ── Determina o tipo de plano ──────────────────────────────────────
  // Prioridade: env vars com offer code → nome do produto/plano
  let planType: PlanType | null = null;

  const offerCode = offer.code || "";
  const monthlyOffer = process.env.HOTMART_OFFER_MONTHLY;
  const annualOffer = process.env.HOTMART_OFFER_ANNUAL;

  if (monthlyOffer && offerCode === monthlyOffer) planType = "monthly";
  else if (annualOffer && offerCode === annualOffer) planType = "annual";
  else {
    planType = detectPlanType(
      offerCode,
      product.name,
      plan.name,
      (data.subscription as Record<string, unknown> | null)?.toString()
    );
  }

  if (!planType) planType = "monthly"; // fallback seguro

  // ── Ativa o plano ─────────────────────────────────────────────────
  const result = await activatePlanByEmail(email, planType, "hotmart", body);

  console.log("[webhook/hotmart]", { event, email, planType, ...result });

  return NextResponse.json({ ok: true, ...result });
}
