import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

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

  const admin = createAdminClient();

  // Lê URL de checkout configurada pelo admin
  const { data: settings } = await admin
    .from("app_settings")
    .select("key, value")
    .in("key", ["checkout_monthly_url", "checkout_annual_url"]);

  const map = Object.fromEntries((settings || []).map((s) => [s.key, s.value]));
  const checkoutUrl = plan === "monthly" ? map["checkout_monthly_url"] : map["checkout_annual_url"];

  if (!checkoutUrl) {
    return NextResponse.redirect(new URL("/plano", req.url));
  }

  // Salva sessão de checkout: email + plano + timestamp
  await admin.from("checkout_sessions").insert({
    email: user.email,
    plan,
  });

  console.log("[checkout/start]", { email: user.email, plan, checkoutUrl });

  return NextResponse.redirect(checkoutUrl);
}
