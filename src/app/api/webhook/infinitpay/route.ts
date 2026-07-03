import { NextRequest, NextResponse } from "next/server";
import { activatePlanByEmail, detectPlanType, type PlanType } from "@/lib/plan-activation";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  // Autenticação via secret header (fail-closed)
  const secret = process.env.INFINITPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook/infinitpay] INFINITPAY_WEBHOOK_SECRET não configurado — bloqueado.");
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }
  const token =
    req.headers.get("x-infinitpay-signature") ||
    req.headers.get("x-webhook-secret") ||
    req.nextUrl.searchParams.get("secret");
  if (token !== secret) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  // Log apenas das chaves de topo — evita gravar PII/dados de pagamento nos logs
  console.log("[webhook/infinitpay] payload recebido — chaves:", Object.keys(body).join(", "));

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
    return NextResponse.json({ ok: true, skipped: true });
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

  let email =
    (customer.email as string) ||
    (payer.email as string) ||
    (body.customer_email as string) ||
    (body.email as string) ||
    (data.customer_email as string) ||
    (data.email as string) ||
    "";

  console.log("[webhook/infinitpay] email extraído:", email ? "(encontrado)" : "(não encontrado)");

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

  // Lookup exato por order_nsu (UUID definido por nós ao criar o link via API)
  // Elimina qualquer problema de concorrência — cada order_nsu é único por usuário
  let sessionId: string | null = null;
  if (!email) {
    const orderNsu = (body.order_nsu as string) || "";
    console.log("[webhook/infinitpay] order_nsu recebido:", orderNsu || "(não encontrado)");

    if (orderNsu) {
      const admin = createAdminClient();
      const { data: session } = await admin
        .from("checkout_sessions")
        .select("id, email")
        .eq("order_nsu", orderNsu)
        .eq("activated", false)
        .single();

      if (session?.email) {
        email = session.email;
        sessionId = session.id;
        console.log("[webhook/infinitpay] email via order_nsu:", email);
      } else {
        console.warn("[webhook/infinitpay] order_nsu não encontrado em checkout_sessions:", orderNsu);
      }
    }
  }

  if (!email) {
    console.error("[webhook/infinitpay] ERRO: email não encontrado em payload nem em checkout_sessions");
    return NextResponse.json({
      error: "E-mail do cliente não encontrado",
      debug_body_keys: Object.keys(body),
    }, { status: 422 });
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
