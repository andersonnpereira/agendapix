import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { formatBRL, getTodayBR, addDaysBR } from "@/lib/format";

type PendingCharge = {
  id: string;
  client_name: string | null;
  description: string | null;
  amount_cents: number;
  status: string;
  due_date: string | null;
};

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, name, pix_key")
    .eq("id", user.id)
    .single();

  // uso pessoal: se ainda não configurou a chave Pix, manda pras Configurações
  if (!profile?.pix_key) redirect("/configuracoes");

  const today = getTodayBR();
  const weekEnd = addDaysBR(7);
  const monthStartStr = today.slice(0, 7) + "-01";

  const [
    { data: pending },
    { data: paidCharges },
    { count: clientCount },
    { data: allClients },
  ] = await Promise.all([
    supabase
      .from("charges")
      .select("id, client_name, description, amount_cents, status, due_date")
      .eq("profile_id", user.id)
      .neq("status", "pago")
      .order("due_date", { ascending: true }),
    supabase
      .from("charges")
      .select("amount_cents, paid_at")
      .eq("profile_id", user.id)
      .eq("status", "pago")
      .gte("paid_at", monthStartStr),
    supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .eq("status", "ativo"),
    supabase
      .from("clients")
      .select("name, birthdate")
      .eq("profile_id", user.id)
      .eq("status", "ativo"),
  ]);

  const pend = (pending || []) as PendingCharge[];
  const isOverdue = (c: PendingCharge) =>
    c.status === "atrasado" || (!!c.due_date && c.due_date < today);

  const overdue = pend.filter(isOverdue);
  const dueToday = pend.filter((c) => c.due_date === today);
  const dueThisWeek = pend.filter((c) => !isOverdue(c) && c.due_date && c.due_date <= weekEnd);

  const sum = (list: PendingCharge[]) => list.reduce((s, c) => s + (c.amount_cents || 0), 0);
  const totalReceived = (paidCharges || []).reduce((s, c) => s + (c.amount_cents || 0), 0);

  // Aniversariantes (próximos 7 dias)
  const nowDate = new Date();
  const birthdayClients = (allClients || []).filter((c) => {
    if (!c.birthdate) return false;
    const [, bm, bd] = c.birthdate.split("-");
    for (let i = 0; i <= 6; i++) {
      const d = new Date(nowDate);
      d.setDate(d.getDate() + i);
      if (bm === String(d.getMonth() + 1).padStart(2, "0") && bd === String(d.getDate()).padStart(2, "0")) return true;
    }
    return false;
  });
  const todayMM = String(nowDate.getMonth() + 1).padStart(2, "0");
  const todayDD = String(nowDate.getDate()).padStart(2, "0");
  const todayBirthdays = birthdayClients.filter((c) => {
    const [, bm, bd] = (c.birthdate || "").split("-");
    return bm === todayMM && bd === todayDD;
  });

  const fmtDate = (d: string | null) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Olá, {profile.business_name || profile.name || "tudo certo"} 👋
        </h1>
        <p className="text-slate-500 text-sm">Resumo das suas cobranças</p>
      </div>

      {/* Alerta de atrasadas */}
      {overdue.length > 0 && (
        <Link href="/cobrancas?status=atrasado" className="card bg-red-50 border-red-200 py-3 px-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-red-700">
              ⚠️ {overdue.length} cobrança{overdue.length > 1 ? "s" : ""} atrasada{overdue.length > 1 ? "s" : ""} — {formatBRL(sum(overdue))}
            </p>
            <p className="text-xs text-red-500 mt-0.5">Envie um lembrete agora</p>
          </div>
          <span className="text-red-400 text-sm">→</span>
        </Link>
      )}

      {/* Aniversariantes */}
      {birthdayClients.length > 0 && (
        <Link href="/clientes" className="card bg-pink-50 border-pink-200 py-3 px-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-pink-700">
              🎂 {todayBirthdays.length > 0
                ? `${todayBirthdays.length} aniversariante${todayBirthdays.length > 1 ? "s" : ""} hoje!`
                : `${birthdayClients.length} aniversariante${birthdayClients.length > 1 ? "s" : ""} esta semana`}
            </p>
            <p className="text-xs text-pink-500 mt-0.5">
              {(todayBirthdays.length > 0 ? todayBirthdays : birthdayClients)
                .slice(0, 3)
                .map((c) => c.name.split(" ")[0])
                .join(", ")}
            </p>
          </div>
          <span className="text-pink-300 text-sm">→</span>
        </Link>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center py-4">
          <p className="text-lg font-bold text-amber-600">{formatBRL(sum(dueToday))}</p>
          <p className="text-xs text-slate-500 mt-1">A receber hoje ({dueToday.length})</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-lg font-bold text-slate-900">{formatBRL(sum(dueThisWeek))}</p>
          <p className="text-xs text-slate-500 mt-1">A receber na semana ({dueThisWeek.length})</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-lg font-bold text-red-600">{formatBRL(sum(overdue))}</p>
          <p className="text-xs text-slate-500 mt-1">Em atraso ({overdue.length})</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-lg font-bold text-brand">{formatBRL(totalReceived)}</p>
          <p className="text-xs text-slate-500 mt-1">Recebido no mês</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-3xl font-bold text-amber-600">{pend.length}</p>
          <p className="text-xs text-slate-500 mt-1">Cobranças abertas</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-3xl font-bold text-slate-900">{clientCount || 0}</p>
          <p className="text-xs text-slate-500 mt-1">Clientes ativos</p>
        </div>
      </div>

      {/* Vencem hoje */}
      {dueToday.length > 0 && (
        <div>
          <h2 className="font-semibold text-slate-900 mb-3">Vencem hoje</h2>
          <div className="space-y-2">
            {dueToday.map((c) => (
              <Link key={c.id} href="/cobrancas" className="card flex items-center justify-between py-3 hover:border-brand transition-colors">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">{c.client_name || "—"}</p>
                  {c.description && <p className="text-sm text-slate-500 truncate">{c.description}</p>}
                </div>
                <span className="text-amber-600 font-semibold shrink-0 ml-2">{formatBRL(c.amount_cents)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Atrasadas */}
      {overdue.length > 0 && (
        <div>
          <h2 className="font-semibold text-slate-900 mb-3">Atrasadas</h2>
          <div className="space-y-2">
            {overdue.slice(0, 8).map((c) => (
              <Link key={c.id} href="/cobrancas?status=atrasado" className="card flex items-center justify-between py-3 hover:border-red-300 transition-colors">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">{c.client_name || "—"}</p>
                  <p className="text-xs text-red-500">Venceu {fmtDate(c.due_date)}</p>
                </div>
                <span className="text-red-600 font-semibold shrink-0 ml-2">{formatBRL(c.amount_cents)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {pend.length === 0 && (
        <div className="card text-center text-slate-500 text-sm py-8">
          Nenhuma cobrança em aberto. 🎉
        </div>
      )}

      <Link href="/cobrancas" className="btn-primary w-full">
        + Nova cobrança
      </Link>
    </div>
  );
}
