import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { formatBRL } from "@/lib/format";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { ShareLinkButton } from "@/components/ShareLinkButton";

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

  const trialDaysLeft =
    profile.plan_type === "trial" && profile.plan_expires_at
      ? Math.ceil(
          (new Date(profile.plan_expires_at).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      : null;

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

  const { count: overdueCount } = await supabase
    .from("charges")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .eq("status", "pendente")
    .lt("due_date", today);

  const { data: paidCharges } = await supabase
    .from("charges")
    .select("amount_cents, paid_at")
    .eq("profile_id", user.id)
    .eq("status", "pago")
    .gte("paid_at", monthStartStr);

  const totalReceived =
    paidCharges?.reduce((sum, c) => sum + (c.amount_cents || 0), 0) || 0;

  // Analytics extras
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const [{ count: clientCount }, { data: monthBookings }, { data: upcomingBookings }] =
    await Promise.all([
      supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", user.id)
        .eq("status", "ativo"),
      supabase
        .from("bookings")
        .select("service_id, services(name)")
        .eq("profile_id", user.id)
        .gte("date", monthStartStr)
        .neq("status", "cancelado"),
      supabase
        .from("bookings")
        .select("client_name, date, time, services(name)")
        .eq("profile_id", user.id)
        .gt("date", today)
        .lte("date", new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10))
        .neq("status", "cancelado")
        .order("date")
        .order("time")
        .limit(3),
    ]);

  // Serviço mais agendado no mês
  const svcCount: Record<string, { name: string; count: number }> = {};
  for (const b of monthBookings || []) {
    const svc = b.services as unknown as { name: string } | null;
    if (svc && b.service_id) {
      if (!svcCount[b.service_id]) svcCount[b.service_id] = { name: svc.name, count: 0 };
      svcCount[b.service_id].count++;
    }
  }
  const topService = Object.values(svcCount).sort((a, b) => b.count - a.count)[0] || null;

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
          <ShareLinkButton url={publicLink} title="Agende comigo!" />
        </div>
      </div>

      {/* Banner de trial */}
      {trialDaysLeft !== null && trialDaysLeft > 0 && (
        <Link
          href="/plano"
          className="card border-amber-300 bg-amber-50 py-3 px-4 flex items-center justify-between"
        >
          <div>
            <p className="text-sm font-semibold text-amber-800">
              ⏳ Teste gratuito: {trialDaysLeft} dia{trialDaysLeft !== 1 ? "s" : ""} restante{trialDaysLeft !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">Veja os planos para continuar usando →</p>
          </div>
          <span className="text-amber-400 text-sm">→</span>
        </Link>
      )}

      {/* Alerta de cobranças atrasadas */}
      {(overdueCount ?? 0) > 0 && (
        <Link href="/cobrancas?status=pendente" className="card bg-red-50 border-red-200 py-3 px-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-red-700">
              ⚠️ {overdueCount} cobrança{overdueCount! > 1 ? "s" : ""} atrasada{overdueCount! > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-red-500 mt-0.5">Envie um lembrete agora</p>
          </div>
          <span className="text-red-400 text-sm">→</span>
        </Link>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center py-4">
          <p className="text-3xl font-bold text-slate-900">{todayBookings?.length || 0}</p>
          <p className="text-xs text-slate-500 mt-1">Agendamentos hoje</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-3xl font-bold text-amber-600">{pendingCount || 0}</p>
          <p className="text-xs text-slate-500 mt-1">Cobranças abertas</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-lg font-bold text-brand">{formatBRL(totalReceived)}</p>
          <p className="text-xs text-slate-500 mt-1">Recebido no mês</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-3xl font-bold text-slate-900">{clientCount || 0}</p>
          <p className="text-xs text-slate-500 mt-1">Clientes ativos</p>
        </div>
      </div>

      {/* Top serviço + próximos */}
      {(topService || (upcomingBookings && upcomingBookings.length > 0)) && (
        <div className="grid grid-cols-1 gap-3">
          {topService && (
            <div className="card py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">🏆 Serviço mais agendado este mês</p>
                <p className="font-semibold text-slate-900 mt-0.5">{topService.name}</p>
              </div>
              <span className="text-2xl font-bold text-brand">{topService.count}×</span>
            </div>
          )}
          {upcomingBookings && upcomingBookings.length > 0 && (
            <div className="card space-y-2 py-3">
              <p className="text-xs text-slate-500 font-medium">📆 Próximos 3 dias</p>
              {upcomingBookings.map((b, i) => {
                const [y, m, d] = b.date.split("-");
                const svc = b.services as unknown as { name: string } | null;
                return (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{b.client_name}</p>
                      <p className="text-xs text-slate-400">{svc?.name || "Serviço"}</p>
                    </div>
                    <p className="text-xs text-slate-500 text-right">
                      {d}/{m}<br />
                      <span className="font-semibold text-brand">{b.time?.slice(0, 5)}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
