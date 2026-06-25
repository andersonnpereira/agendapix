import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

const PRECO_MENSAL_LABEL = "R$ 47";
const PRECO_ANUAL_LABEL = "R$ 397";
const PRECO_ANUAL_MES = "R$ 33";
const ECONOMIA_ANUAL = "R$ 167";
const WHATSAPP_CONTATO = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || "5567999999999";
const NOME_PRODUTO = "Agendou";

// Links diretos de checkout (Hotmart ou Kiwify) — configure no Vercel
const CHECKOUT_MONTHLY = process.env.NEXT_PUBLIC_CHECKOUT_MONTHLY || "";
const CHECKOUT_ANNUAL  = process.env.NEXT_PUBLIC_CHECKOUT_ANNUAL  || "";

function waLink(msg: string) {
  return `https://wa.me/${WHATSAPP_CONTATO}?text=${encodeURIComponent(msg)}`;
}

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

  // Usuário com plano pago ativo → já tem acesso, manda pro dashboard
  const isPaidActive =
    (profile?.plan_type === "monthly" || profile?.plan_type === "annual") &&
    !profile?.is_blocked &&
    (profile?.plan_expires_at === null || new Date(profile.plan_expires_at) >= new Date());

  if (isPaidActive) redirect("/dashboard");

  const isBlocked = profile?.is_blocked === true;
  const isExpired =
    profile?.plan_expires_at != null && new Date(profile.plan_expires_at) < new Date();
  const isActiveTrial = profile?.plan_type === "trial" && !isBlocked && !isExpired;

  const daysLeft = profile?.plan_expires_at
    ? Math.max(0, Math.ceil((new Date(profile.plan_expires_at).getTime() - Date.now()) / 86400000))
    : null;

  const displayName = profile?.business_name || profile?.name || "você";

  const waBase = `Olá! Quero assinar o ${NOME_PRODUTO}. E-mail: ${user.email}`;
  const waMensal = waLink(`${waBase} — Plano MENSAL (${PRECO_MENSAL_LABEL}/mês)`);
  const waAnual = waLink(`${waBase} — Plano ANUAL (${PRECO_ANUAL_LABEL}/ano)`);
  const waContato = waLink(
    isBlocked
      ? `Olá! Minha conta no ${NOME_PRODUTO} está suspensa. E-mail: ${user.email}`
      : waBase
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col items-center justify-start pt-10 pb-16 px-5">
      <div className="w-full max-w-md space-y-6">

        {/* Logo */}
        <div className="text-center">
          <span className="text-2xl font-extrabold text-brand">{NOME_PRODUTO}</span>
        </div>

        {/* ── Banner de status ─────────────────────────────────── */}
        {isBlocked ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center space-y-1.5">
            <p className="text-3xl">🔒</p>
            <p className="font-bold text-lg text-red-800">Acesso suspenso</p>
            <p className="text-sm text-red-600">
              Sua conta foi suspensa. Entre em contato para regularizar.
            </p>
          </div>
        ) : isExpired ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center space-y-1.5">
            <p className="text-3xl">⏳</p>
            <p className="font-bold text-lg text-amber-800">Período de teste encerrado</p>
            <p className="text-sm text-amber-600">
              Seu teste gratuito expirou, {displayName}. Assine para continuar usando.
            </p>
          </div>
        ) : (
          /* Trial ativo */
          <div className="rounded-2xl border border-brand/30 bg-brand/5 p-5 text-center space-y-1.5">
            <div className="inline-flex items-center gap-1.5 bg-brand text-white text-xs font-bold px-3 py-1 rounded-full mb-1">
              ✨ {daysLeft !== null ? `${daysLeft} dia${daysLeft !== 1 ? "s" : ""} restantes` : "Teste ativo"}
            </div>
            <p className="font-bold text-lg text-slate-900">
              Aproveite enquanto testa, {displayName}!
            </p>
            <p className="text-sm text-slate-600">
              Assine agora e mantenha todos os seus dados e agendamentos.
            </p>
          </div>
        )}

        {/* ── Planos (só mostra se não bloqueado) ──────────────── */}
        {!isBlocked && (
          <div className="space-y-4">
            <p className="text-center text-sm font-semibold text-slate-500 uppercase tracking-wide">
              Escolha seu plano
            </p>

            {/* Card Mensal */}
            <a
              href={CHECKOUT_MONTHLY || waMensal}
              target="_blank"
              rel="noopener noreferrer"
              className="group block bg-white border-2 border-slate-200 hover:border-brand rounded-2xl p-5 transition-all hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-bold text-slate-900 text-base group-hover:text-brand transition-colors">
                    Mensal
                  </p>
                  <ul className="space-y-0.5">
                    {["Agendamentos ilimitados", "Cobranças Pix", "WhatsApp automático", "Cancele quando quiser"].map((f) => (
                      <li key={f} className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span className="text-brand">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-extrabold text-slate-900 text-2xl leading-none">{PRECO_MENSAL_LABEL}</p>
                  <p className="text-xs text-slate-400 mt-0.5">por mês</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-brand group-hover:gap-3 transition-all">
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Assinar plano mensal →
              </div>
            </a>

            {/* Card Anual — destaque */}
            <a
              href={CHECKOUT_ANNUAL || waAnual}
              target="_blank"
              rel="noopener noreferrer"
              className="group block relative bg-brand rounded-2xl p-5 transition-all hover:opacity-95 hover:shadow-lg"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-amber-400 text-amber-900 text-xs font-extrabold px-3 py-1 rounded-full shadow-sm whitespace-nowrap">
                  🏆 MELHOR VALOR — {ECONOMIA_ANUAL} de economia
                </span>
              </div>
              <div className="flex items-start justify-between gap-3 mt-2">
                <div className="space-y-1">
                  <p className="font-bold text-white text-base">Anual</p>
                  <ul className="space-y-0.5">
                    {["Tudo do plano mensal", "Suporte prioritário", "Funcionalidades antecipadas", "Pague uma vez no ano"].map((f) => (
                      <li key={f} className="text-xs text-green-100 flex items-center gap-1.5">
                        <span className="text-white">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-extrabold text-white text-2xl leading-none">{PRECO_ANUAL_LABEL}</p>
                  <p className="text-xs text-green-200 mt-0.5">{PRECO_ANUAL_MES}/mês</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-white group-hover:gap-3 transition-all">
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Assinar plano anual →
              </div>
            </a>

            {CHECKOUT_MONTHLY || CHECKOUT_ANNUAL ? (
              <p className="text-center text-xs text-slate-400 leading-relaxed">
                🔒 Compra segura · O acesso é liberado automaticamente após a confirmação do pagamento.
              </p>
            ) : (
              <p className="text-center text-xs text-slate-400 leading-relaxed">
                Pagamento via Pix. Após o envio, a liberação é feita em até 1 hora útil.
              </p>
            )}
          </div>
        )}

        {/* ── Botão WhatsApp universal ──────────────────────────── */}
        <a
          href={waContato}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold rounded-2xl py-4 text-sm transition-colors shadow"
        >
          <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          {isBlocked ? "Falar com suporte" : "Dúvidas? Fale no WhatsApp"}
        </a>

        {/* ── Rodapé ───────────────────────────────────────────── */}
        <div className="text-center space-y-2 pt-1">
          {!isBlocked && (
            <p className="text-xs text-slate-400">
              Já pagou?{" "}
              <a
                href={waLink(`Olá! Já enviei o Pix para assinar o ${NOME_PRODUTO} (${user.email}). Aguardando liberação.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand underline"
              >
                Confirmar pagamento →
              </a>
            </p>
          )}
          {isActiveTrial && (
            <Link href="/dashboard" className="block text-xs text-slate-400 hover:text-slate-600">
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
