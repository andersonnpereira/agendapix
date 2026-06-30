import { NextRequest, NextResponse } from "next/server";
import { activatePlanByEmail, detectPlanType, type PlanType } from "@/lib/plan-activation";
import { createAdminClient } from "@/lib/supabase-admin";

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

  // Log completo para diagnóstico — visível nos logs do Vercel
  console.log("[webhook/infinitpay] RAW PAYLOAD:", JSON.stringify(body, null, 2));

  // Detecta status de pagamento aprovado — tenta todos os caminhos comuns do Infinit Pay
  const data = (body.data as Record<string, unknown>) || {};
  const charge = (body.charge as Record<string, unknown>) ||
                 (data.charge as Record<string, unknown>) || {};
  const subscription = (body.subscription as Record<string, unknown>) ||
                       (data.subscription as Record<string, unknown>) || {};

  const status =
    (body.status as string) ||
    (data.status as string) ||
    (charge.status as string) ||
    (subscription.status as string) ||
    (body.payment_status as string) ||
    "";

  const event =
    (body.event as string) ||
    (body.type as string) ||
    (body.event_type as string) ||
    "";

  const APPROVED = ["paid", "approved", "captured", "succeeded", "active", "completed"];
  const paidAmount = Number(body.paid_amount ?? (data.paid_amount ?? 0));
  const isApproved =
    APPROVED.includes(status.toLowerCase()) ||
    event.toLowerCase().includes("paid") ||
    event.toLowerCase().includes("approved") ||
    event.toLowerCase().includes("captured") ||
    event.toLowerCase().includes("succeeded") ||
    event.toLowerCase().includes("payment_succeeded") ||
    event.toLowerCase().includes("completed") ||
    paidAmount > 0; // Infinit Pay manda o webhook sem status quando o link de pagamento é pago

  console.log("[webhook/infinitpay] status:", status, "| event:", event, "| paid_amount:", paidAmount, "| isApproved:", isApproved);

  if (!isApproved) {
    return NextResponse.json({ ok: true, skipped: true, status, event, debug_body_keys: Object.keys(body) });
  }

  // Extrai e-mail — tenta todos os caminhos possíveis do Infinit Pay
  const customer =
    (data.customer as Record<string, unknown>) ||
    (body.customer as Record<string, unknown>) ||
    (charge.customer as Record<string, unknown>) ||
    (subscription.customer as Record<string, unknown>) ||
    {};

  const payer =
    (body.payer as Record<string, unknown>) ||
    (data.payer as Record<string, unknown>) ||
    {};

  const email =
    (customer.email as string) ||
    (payer.email as string) ||
    (body.customer_email as string) ||
    (body.email as string) ||
    (data.customer_email as string) ||
    (data.email as string) ||
    "";

  console.log("[webhook/infinitpay] email extraído do payload:", email || "(não encontrado)");

  // Fallback: busca sessão de checkout mais recente para este plano
  // (Infinit Pay não inclui email no webhook de link de pagamento PIX)
  let sessionId: string | null = null;
  if (!email) {
    const admin = createAdminClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: session } = await admin
      .from("checkout_sessions")
      .select("id, email")
      .eq("plan", planType)
      .eq("activated", false)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (session?.email) {
      email = session.email;
      sessionId = session.id;
      console.log("[webhook/infinitpay] email via checkout_session:", email);
    }
  }

  if (!email) {
    console.error("[webhook/infinitpay] ERRO: email não encontrado em payload nem em checkout_sessions");
    return NextResponse.json({
      error: "E-mail do cliente não encontrado",
      debug_body_keys: Object.keys(body),
    }, { status: 422 });
  }

  // Detecta plano: query param ?plan=monthly|annual tem precedência
  const planParam = req.nextUrl.searchParams.get("plan");
  let planType: PlanType;

  if (planParam === "monthly") {
    planType = "monthly";
  } else if (planParam === "annual") {
    planType = "annual";
  } else {
    const planName =
      (customer.plan as string) ||
      ((data.plan as Record<string, unknown>)?.name as string) ||
      ((subscription.plan as Record<string, unknown>)?.name as string) ||
      (body.plan_name as string) ||
      (body.product_name as string) ||
      "";

    const detected = detectPlanType(planName, event);
    planType = detected || "monthly";
  }

  const result = await activatePlanByEmail(email, planType, "infinitpay", body);

  // Marca sessão de checkout como usada
  if (sessionId && result.activated) {
    const admin = createAdminClient();
    await admin.from("checkout_sessions").update({ activated: true }).eq("id", sessionId);
  }

  console.log("[webhook/infinitpay] RESULTADO:", { event, status, email, planType, sessionId, ...result });

  return NextResponse.json({ ok: true, ...result });
}
