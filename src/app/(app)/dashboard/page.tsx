import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { formatBRL } from "@/lib/format";
import { CopyLinkButton } from "@/components/CopyLinkButton";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // se não terminou o onboarding, manda pra lá
  if (!profile?.slug || !profile?.pix_key) {
    redirect("/onboarding");
  }

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  const { data: todayBookings } = await supabase
    .from("bookings")
    .select("*, services(name)")
    .eq("profile_id", user.id)
    .eq("date", today)
    .order("time");

  const { count: pendingCount } = await supabase
    .from("charges")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .neq("status", "pago");

  const { data: paidCharges } = await supabase
    .from("charges")
    .select("amount_cents, paid_at")
    .eq("profile_id", user.id)
    .eq("status", "pago")
    .gte("paid_at", monthStartStr);

  const totalReceived =
    paidCharges?.reduce((sum, c) => sum + (c.amount_cents || 0), 0) || 0;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const publicLink = `${siteUrl}/agendar/${profile.slug}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Olá, {profile.business_name || "tudo certo"} 👋
        </h1>
        <p className="text-slate-500 text-sm">Resumo de hoje</p>
      </div>

      {/* Link público */}
      <div className="card bg-brand-light border-brand/20">
        <p className="text-sm font-medium text-brand-dark mb-2">
          Seu link pra colar na bio
        </p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={publicLink}
            className="input text-sm bg-white flex-1 truncate"
          />
          <CopyLinkButton text={publicLink} />
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <p className="text-2xl font-bold text-slate-900">
            {todayBookings?.length || 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">Hoje</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-amber-600">
            {pendingCount || 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">A receber</p>
        </div>
        <div className="card text-center">
          <p className="text-lg font-bold text-brand">
            {formatBRL(totalReceived)}
          </p>
          <p className="text-xs text-slate-500 mt-1">No mês</p>
        </div>
      </div>

      {/* Agendamentos de hoje */}
      <div>
        <h2 className="font-semibold text-slate-900 mb-3">
          Agendamentos de hoje
        </h2>
        {todayBookings && todayBookings.length > 0 ? (
          <div className="space-y-2">
            {todayBookings.map((b) => (
              <div
                key={b.id}
                className="card flex items-center justify-between py-3"
              >
                <div>
                  <p className="font-medium text-slate-900">{b.client_name}</p>
                  <p className="text-sm text-slate-500">
                    {(b.services as { name: string } | null)?.name || "Serviço"}
                  </p>
                </div>
                <span className="text-brand font-semibold">
                  {b.time?.slice(0, 5)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center text-slate-500 text-sm py-8">
            Você ainda não tem agendamentos hoje.
            <br />
            Compartilhe seu link na bio para receber clientes. 🚀
          </div>
        )}
      </div>

      <Link href="/cobrancas" className="btn-primary w-full">
        + Nova cobrança
      </Link>
    </div>
  );
}
