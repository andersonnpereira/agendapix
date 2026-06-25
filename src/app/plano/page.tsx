import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

const NOME_PRODUTO = "Agendou";
const CHECKOUT_URL =
  process.env.NEXT_PUBLIC_CHECKOUT_URL ||
  process.env.NEXT_PUBLIC_CHECKOUT_MONTHLY ||
  "";

export default async function PlanoPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isAdmin = user.email === process.env.ADMIN_EMAIL;
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_type, plan_expires_at, is_blocked, business_name, name")
    .eq("id", user.id)
    .single();

  if (isAdmin || profile?.plan_type === "lifetime") redirect("/dashboard");

  const isPaidActive =
    (profile?.plan_type === "monthly" || profile?.plan_type === "annual") &&
    !profile?.is_blocked &&
    (profile?.plan_expires_at === null || new Date(profile.plan_expires_at) >= new Date());

  if (isPaidActive) redirect("/dashboard");

  const isBlocked = profile?.is_blocked === true;
  const isExpired =
    profile?.plan_expires_at != null && new Date(profile.plan_expires_at) < new Date();
  const isActiveTrial = !isBlocked && !isExpired;

  const daysLeft = profile?.plan_expires_at
    ? Math.max(0, Math.ceil((new Date(profile.plan_expires_at).getTime() - Date.now()) / 86400000))
    : null;

  const displayName = profile?.business_name || profile?.name || "você";

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="text-center">
          <span className="text-2xl font-extrabold text-brand">{NOME_PRODUTO}</span>
        </div>

        {/* ── Card de status ─────────────────────────────────────────── */}
        {isBlocked ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center space-y-2">
            <p className="text-4xl">🔒</p>
            <p className="font-bold text-lg text-red-800">Acesso suspenso</p>
            <p className="text-sm text-red-600">
              Entre em contato para regularizar sua conta.
            </p>
          </div>
        ) : isExpired ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center space-y-2">
            <p className="text-4xl">⏳</p>
            <p className="font-bold text-lg text-amber-800">Período de teste encerrado</p>
            <p className="text-sm text-amber-600">
              Seu teste gratuito expirou, {displayName}.<br />
              Assine para continuar usando o {NOME_PRODUTO}.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-brand/30 bg-brand/5 p-6 text-center space-y-2">
            <p className="text-4xl">✨</p>
            <p className="font-bold text-lg text-slate-900">
              {daysLeft !== null
                ? `${daysLeft} dia${daysLeft !== 1 ? "s" : ""} de teste restante${daysLeft !== 1 ? "s" : ""}`
                : "Você está no período de teste"}
            </p>
            <p className="text-sm text-slate-600">
              Assine agora e mantenha todos os seus dados, {displayName}.
            </p>
          </div>
        )}

        {/* ── CTA principal ───────────────────────────────────────────── */}
        {!isBlocked && (
          <div className="space-y-3">
            {CHECKOUT_URL ? (
              <a
                href={CHECKOUT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-full bg-brand hover:opacity-90 text-white font-bold rounded-2xl py-4 text-base transition-opacity shadow-md"
              >
                Quero acesso completo →
              </a>
            ) : (
              <div className="text-center text-sm text-slate-400 bg-slate-100 rounded-2xl py-4 px-5">
                Link de assinatura não configurado ainda.
              </div>
            )}
            <p className="text-center text-xs text-slate-400">
              🔒 Compra segura · Acesso liberado automaticamente após a confirmação.
            </p>
          </div>
        )}

        {/* ── Rodapé ──────────────────────────────────────────────────── */}
        <div className="text-center space-y-2 pt-1">
          {isActiveTrial && (
            <Link href="/dashboard" className="block text-sm text-brand font-medium hover:underline">
              ← Voltar ao app
            </Link>
          )}
          <Link href="/login" className="block text-xs text-slate-400 hover:text-slate-600">
            Sair da conta
          </Link>
        </div>

      </div>
    </main>
  );
}
