import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

// ─── EDITE AQUI ───────────────────────────────────────────────
const PRECO_MENSAL = "R$ 47/mês";
const PRECO_ANUAL = "R$ 397/ano"; // ~R$ 33/mês
const ECONOMIA_ANUAL = "Economize R$ 167";
const WHATSAPP_CONTATO = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || "5567999999999"; // DDI+DDD+número
const NOME_PRODUTO = "Agendou";
// ──────────────────────────────────────────────────────────────

function waLink(msg: string) {
  return `https://wa.me/${WHATSAPP_CONTATO}?text=${encodeURIComponent(msg)}`;
}

const PLAN_LABELS: Record<string, string> = {
  trial: "Período de teste",
  monthly: "Mensal",
  annual: "Anual",
  lifetime: "Vitalício",
};

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

  // Admin e vitalício têm acesso — manda pro dashboard
  if (isAdmin || profile?.plan_type === "lifetime") {
    redirect("/dashboard");
  }

  const now = new Date();
  const isBlocked = profile?.is_blocked === true;
  const isExpired =
    profile?.plan_expires_at !== null &&
    profile?.plan_expires_at !== undefined &&
    new Date(profile.plan_expires_at) < now;

  // Usuário com plano ativo — manda pro dashboard
  if (!isBlocked && !isExpired) {
    redirect("/dashboard");
  }

  const displayName = profile?.business_name || profile?.name || user.email || "usuário";
  const planLabel = PLAN_LABELS[profile?.plan_type || "trial"] ?? "Plano";

  const waMsg = isBlocked
    ? `Olá! Minha conta no ${NOME_PRODUTO} está bloqueada e preciso de ajuda. E-mail: ${user.email}`
    : `Olá! Quero assinar o ${NOME_PRODUTO}. E-mail cadastrado: ${user.email}`;

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-start py-12 px-5">
      <div className="w-full max-w-md space-y-6">

        {/* Header */}
        <div className="text-center">
          <span className="text-2xl font-extrabold text-brand">{NOME_PRODUTO}</span>
        </div>

        {/* Status card */}
        <div className={`rounded-2xl border p-5 text-center space-y-2 ${
          isBlocked
            ? "bg-red-50 border-red-200"
            : "bg-amber-50 border-amber-200"
        }`}>
          <p className="text-3xl">{isBlocked ? "🔒" : "⏳"}</p>
          <p className={`font-bold text-lg ${isBlocked ? "text-red-800" : "text-amber-800"}`}>
            {isBlocked ? "Acesso suspenso" : "Período de teste encerrado"}
          </p>
          <p className={`text-sm ${isBlocked ? "text-red-600" : "text-amber-600"}`}>
            {isBlocked
              ? "Sua conta foi suspensa. Entre em contato para regularizar."
              : `Seu ${planLabel.toLowerCase()} gratuito expirou, ${displayName}.`}
          </p>
        </div>

        {/* Planos */}
        {!isBlocked && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700 text-center">Escolha um plano para continuar</p>

            {/* Mensal */}
            <a
              href={waLink(`${waMsg} — Quero o plano MENSAL (${PRECO_MENSAL})`)}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white border-2 border-slate-200 hover:border-brand rounded-2xl p-4 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">Mensal</p>
                  <p className="text-xs text-slate-500 mt-0.5">Renovação mensal · Cancele quando quiser</p>
                </div>
                <p className="font-extrabold text-brand text-lg">{PRECO_MENSAL}</p>
              </div>
            </a>

            {/* Anual — destaque */}
            <a
              href={waLink(`${waMsg} — Quero o plano ANUAL (${PRECO_ANUAL})`)}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-brand border-2 border-brand rounded-2xl p-4 transition-opacity hover:opacity-90 relative"
            >
              <div className="absolute -top-2.5 left-4">
                <span className="bg-amber-400 text-amber-900 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  MELHOR VALOR
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">Anual</p>
                  <p className="text-xs text-green-100 mt-0.5">{ECONOMIA_ANUAL} comparado ao mensal</p>
                </div>
                <p className="font-extrabold text-white text-lg">{PRECO_ANUAL}</p>
              </div>
            </a>

            <p className="text-xs text-slate-400 text-center">
              Após escolher um plano, envie o Pix e aguarde a liberação em até 1 hora útil.
            </p>
          </div>
        )}

        {/* CTA WhatsApp */}
        <a
          href={waLink(waMsg)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white font-semibold rounded-2xl py-4 text-base transition-colors shadow-md"
        >
          <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Falar no WhatsApp
        </a>

        <div className="text-center space-y-2">
          <p className="text-xs text-slate-400">
            Já pagou e está esperando a liberação?{" "}
            <a href={waLink(`Olá! Já enviei o Pix para assinar o ${NOME_PRODUTO} (${user.email}). Aguardando liberação.`)} target="_blank" rel="noopener noreferrer" className="text-brand underline">
              Confirmar pagamento
            </a>
          </p>
          <Link href="/login" className="block text-xs text-slate-400 hover:text-slate-600">
            Sair da conta →
          </Link>
        </div>
      </div>
    </main>
  );
}
