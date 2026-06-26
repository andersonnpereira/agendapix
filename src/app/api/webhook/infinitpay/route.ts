import { NextRequest, NextResponse } from "next/server";
import { activatePlanByEmail, detectPlanType, type PlanType } from "@/lib/plan-activation";

export async function POST(req: NextRequest) {
  // Autenticação opcional via secret header
  const secret = process.env.INFINITPAY_WEBHOOK_SECRET;
  if (secret) {
    const token =
      req.headers.get("x-infinitpay-signature") ||
      req.headers.get("x-webhook-secret") ||
      req.nextUrl.searchParams.get("secret");
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

  // Detecta status de pagamento aprovado
  const status =
    (body.status as string) ||
    ((body.data as Record<string, unknown>)?.status as string) ||
    (body.payment_status as string) ||
    "";

  const event =
    (body.event as string) ||
    (body.type as string) ||
    "";

  const APPROVED = ["paid", "approved", "captured", "succeeded", "active"];
  const isApproved =
    APPROVED.includes(status.toLowerCase()) ||
    event.includes("paid") ||
    event.includes("approved") ||
    event.includes("captured");

  if (!isApproved) {
    return NextResponse.json({ ok: true, skipped: true, status, event });
  }

  // Extrai e-mail do cliente (tenta vários caminhos)
  const data = (body.data as Record<string, unknown>) || body;
  const customer =
    (data.customer as Record<string, unknown>) ||
    (body.customer as Record<string, unknown>) ||
    {};

  const email =
    (customer.email as string) ||
    (body.customer_email as string) ||
    (body.email as string) ||
    (data.customer_email as string) ||
    "";

  if (!email) {
    return NextResponse.json({ error: "E-mail do cliente não encontrado no payload" }, { status: 422 });
  }

  // Detecta plano: query param ?plan=monthly|annual tem precedência
  const planParam = req.nextUrl.searchParams.get("plan");
  let planType: PlanType;

  if (planParam === "monthly") {
    planType = "monthly";
  } else if (planParam === "annual") {
    planType = "annual";
  } else {
    // Tenta detectar pelo nome do produto/plano no payload
    const planName =
      (customer.plan as string) ||
      ((data.plan as Record<string, unknown>)?.name as string) ||
      ((data.subscription as Record<string, unknown>)?.plan as string) ||
      (body.plan_name as string) ||
      (body.product_name as string) ||
      "";

    const detected = detectPlanType(planName, event);
    planType = detected || "monthly"; // fallback mensal
  }

  const result = await activatePlanByEmail(email, planType, "infinitpay", body);

  console.log("[webhook/infinitpay]", { event, status, email, planType, ...result });

  return NextResponse.json({ ok: true, ...result });
}
