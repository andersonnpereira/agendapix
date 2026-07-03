import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { randomUUID } from "crypto";

const INFINITPAY_API = "https://api.checkout.infinitepay.io/links";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://agendasj.vercel.app";

// Preços em centavos
const PRICES: Record<string, number> = {
  monthly: 100,   // TESTE: R$ 1,00 — reverter para 1990 (R$ 19,90) após o teste
  annual:  17990, // R$ 179,90
};

const DESCRIPTIONS: Record<string, string> = {
  monthly: "Plano Mensal Agendou",
  annual:  "Plano Anual Agendou",
};

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const plan = req.nextUrl.searchParams.get("plan");
  if (plan !== "monthly" && plan !== "annual") {
    return NextResponse.redirect(new URL("/plano", req.url));
  }

  const handle = process.env.INFINITPAY_HANDLE;
  if (!handle) {
    console.error("[checkout/start] INFINITPAY_HANDLE não configurado nas env vars do Vercel");
    return NextResponse.redirect(new URL("/plano?erro=config", req.url));
  }

  const orderNsu  = randomUUID();
  // Inclui o secret no webhook — o endpoint /api/webhook/infinitpay é fail-closed
  // (rejeita 503 sem secret). Sem isso, o plano nunca seria ativado após o pagamento.
  const webhookSecret = process.env.INFINITPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[checkout/start] INFINITPAY_WEBHOOK_SECRET não configurado — o webhook rejeitaria a confirmação.");
    return NextResponse.redirect(new URL("/plano?erro=config", req.url));
  }
  const webhookUrl  = `${APP_URL}/api/webhook/infinitpay?plan=${plan}&secret=${encodeURIComponent(webhookSecret)}`;
  const redirectUrl = `${APP_URL}/dashboard`;

  // Headers — INFINITPAY_API_KEY opcional; alguns endpoints não exigem auth
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const apiKey = process.env.INFINITPAY_API_KEY;
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  let checkoutUrl: string;
  try {
    const res = await fetch(INFINITPAY_API, {
      method: "POST",
      headers,
      body: JSON.stringify({
        handle,
        redirect_url: redirectUrl,
        webhook_url: webhookUrl,
        order_nsu: orderNsu,
        customer: {
          email: user.email,
          name:  user.user_metadata?.full_name || user.email,
        },
        items: [{
          quantity:    1,
          price:       PRICES[plan],
          description: DESCRIPTIONS[plan],
        }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[checkout/start] Erro API Infinit Pay:", res.status, errText);
      return NextResponse.redirect(new URL("/plano?erro=pagamento", req.url));
    }

    const data = await res.json() as { url?: string };
    checkoutUrl = data.url || "";
    if (!checkoutUrl) {
      console.error("[checkout/start] API não retornou url:", data);
      return NextResponse.redirect(new URL("/plano?erro=pagamento", req.url));
    }
  } catch (err) {
    console.error("[checkout/start] Falha ao criar link:", err);
    return NextResponse.redirect(new URL("/plano?erro=pagamento", req.url));
  }

  // Salva sessão — order_nsu permite lookup exato no webhook
  const admin = createAdminClient();
  await admin.from("checkout_sessions").insert({ order_nsu: orderNsu, email: user.email, plan });

  console.log("[checkout/start]", { email: user.email, plan, orderNsu });

  return NextResponse.redirect(checkoutUrl);
}
