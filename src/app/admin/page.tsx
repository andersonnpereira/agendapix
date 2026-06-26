"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { formatBRL } from "@/lib/format";

type Client = {
  id: string;
  name: string | null;
  business_name: string | null;
  email: string | null;
  slug: string | null;
  plan_type: string;
  plan_expires_at: string | null;
  plan_price_cents: number | null;
  is_blocked: boolean;
  plan_notes: string | null;
  registered_at: string | null;
  last_sign_in_at: string | null;
  booking_count: number;
};

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  trial:    { label: "Trial",     color: "bg-slate-100 text-slate-600" },
  monthly:  { label: "Mensal",    color: "bg-blue-100 text-blue-700" },
  annual:   { label: "Anual",     color: "bg-brand-light text-brand-dark" },
  lifetime: { label: "Vitalício", color: "bg-purple-100 text-purple-700" },
};

const PLAN_TYPES = ["trial", "monthly", "annual", "lifetime"];

type Tab = "visao-geral" | "clientes" | "config";

export default function AdminPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("visao-geral");
  const [clients, setClients] = useState<Client[]>([]);
  const [totalBookings, setTotalBookings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("todos");
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState("");

  const [cfgMonthlyUrl, setCfgMonthlyUrl] = useState("");
  const [cfgAnnualUrl, setCfgAnnualUrl] = useState("");
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgSaved, setCfgSaved] = useState(false);

  const [ePlan, setEPlan] = useState("trial");
  const [eExpires, setEExpires] = useState("");
  const [ePrice, setEPrice] = useState("");
  const [eBlocked, setEBlocked] = useState(false);
  const [eNotes, setENotes] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  async function loadConfig() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/admin/settings", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setCfgMonthlyUrl(data.settings?.checkout_monthly_url || "");
      setCfgAnnualUrl(data.settings?.checkout_annual_url || "");
    }
  }

  async function saveConfig() {
    setCfgSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        checkout_monthly_url: cfgMonthlyUrl.trim(),
        checkout_annual_url: cfgAnnualUrl.trim(),
      }),
    });
    setCfgSaving(false);
    if (res.ok) {
      setCfgSaved(true);
      setTimeout(() => setCfgSaved(false), 3000);
    } else {
      showToast("Erro ao salvar configurações.");
    }
  }

  async function load() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/admin/clients", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Erro ao carregar clientes.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setClients(data.clients || []);
    setTotalBookings(data.totalBookings || 0);
    setLoading(false);
  }

  useEffect(() => { load(); loadConfig(); }, []);

  function openEdit(c: Client) {
    setEditClient(c);
    setEPlan(c.plan_type || "trial");
    setEExpires(c.plan_expires_at ? c.plan_expires_at.slice(0, 10) : "");
    setEPrice(c.plan_price_cents ? String(c.plan_price_cents / 100).replace(".", ",") : "");
    setEBlocked(c.is_blocked || false);
    setENotes(c.plan_notes || "");
  }

  async function deleteClient() {
    if (!confirmDelete) return;
    setDeleting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/clients", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ id: confirmDelete.id }),
    });
    setDeleting(false);
    setConfirmDelete(null);
    if (res.ok) { load(); showToast("Cliente excluído com sucesso."); }
    else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ? `Erro: ${data.error}` : "Erro ao excluir cliente.");
    }
  }

  async function saveEdit() {
    if (!editClient) return;
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/clients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        id: editClient.id,
        plan_type: ePlan,
        plan_expires_at: eExpires ? new Date(eExpires).toISOString() : null,
        plan_price_cents: ePrice ? Math.round(parseFloat(ePrice.replace(",", ".")) * 100) : null,
        is_blocked: eBlocked,
        plan_notes: eNotes || null,
      }),
    });
    setSaving(false);
    if (res.ok) { setEditClient(null); load(); showToast("Cliente atualizado."); }
    else showToast("Erro ao salvar.");
  }

  const filtered = clients.filter((c) => {
    const matchPlan = filterPlan === "todos" || c.plan_type === filterPlan;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (c.name || "").toLowerCase().includes(q) ||
      (c.business_name || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.slug || "").toLowerCase().includes(q);
    return matchPlan && matchSearch;
  });

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const in7Days = new Date(now.getTime() + 7 * 86400000);

  const stats = {
    total: clients.length,
    trial: clients.filter((c) => c.plan_type === "trial").length,
    monthly: clients.filter((c) => c.plan_type === "monthly").length,
    annual: clients.filter((c) => c.plan_type === "annual").length,
    lifetime: clients.filter((c) => c.plan_type === "lifetime").length,
    blocked: clients.filter((c) => c.is_blocked).length,
    newThisMonth: clients.filter((c) => (c.registered_at || "") >= thisMonthStart).length,
    expiringSoon: clients.filter((c) => {
      if (!c.plan_expires_at || c.is_blocked) return false;
      const exp = new Date(c.plan_expires_at);
      return exp >= now && exp <= in7Days;
    }).length,
    expired: clients.filter((c) => c.plan_expires_at && new Date(c.plan_expires_at) < now && !c.is_blocked).length,
    mrr: clients.filter((c) => c.plan_type === "monthly" && !c.is_blocked)
      .reduce((s, c) => s + (c.plan_price_cents || 0), 0),
    arr: clients.filter((c) => c.plan_type === "annual" && !c.is_blocked)
      .reduce((s, c) => s + (c.plan_price_cents || 0), 0),
    paidUsers: clients.filter((c) => (c.plan_type === "monthly" || c.plan_type === "annual" || c.plan_type === "lifetime") && !c.is_blocked).length,
  };

  const conversionRate = stats.total > 0
    ? Math.round((stats.paidUsers / stats.total) * 100)
    : 0;

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    const [y, m, day] = d.slice(0, 10).split("-");
    return `${day}/${m}/${y}`;
  };

  const formatDatetime = (d: string | null) => {
    if (!d) return "—";
    const dt = new Date(d);
    return dt.toLocaleDateString("pt-BR") + " " + dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "visao-geral", label: "📊 Visão Geral" },
    { key: "clientes",    label: `👥 Clientes (${clients.length})` },
    { key: "config",      label: "⚙️ Configurações" },
  ];

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Painel Admin</h1>
        <p className="text-slate-500 text-sm">Gerenciamento completo da plataforma Agendou.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          ⚠️ {error}
          {error.includes("SERVICE_ROLE") && (
            <p className="mt-2 text-xs">Adicione <code className="bg-red-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> nas variáveis do Vercel.</p>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── VISÃO GERAL ── */}
      {tab === "visao-geral" && (
        <div className="space-y-5">
          {/* KPIs principais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total usuários",   value: stats.total,        color: "text-slate-900",  bg: "bg-white" },
              { label: "Novos este mês",   value: stats.newThisMonth, color: "text-blue-700",   bg: "bg-blue-50" },
              { label: "Pagantes ativos",  value: stats.paidUsers,    color: "text-brand-dark", bg: "bg-brand-light" },
              { label: "Conversão trial",  value: `${conversionRate}%`, color: "text-purple-700", bg: "bg-purple-50" },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-200 p-4 text-center`}>
                <p className={`text-2xl font-bold ${s.color}`}>{loading ? "—" : s.value}</p>
                <p className="text-xs text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Receita */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
              <p className="text-lg font-bold text-blue-800">{formatBRL(stats.mrr)}</p>
              <p className="text-xs text-blue-600 mt-1">MRR (mensais)</p>
            </div>
            <div className="bg-brand-light border border-brand/20 rounded-2xl p-4 text-center">
              <p className="text-lg font-bold text-brand-dark">{formatBRL(stats.arr)}</p>
              <p className="text-xs text-brand-dark mt-1">ARR (anuais)</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center col-span-2 sm:col-span-1">
              <p className="text-lg font-bold text-slate-800">{totalBookings.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-slate-500 mt-1">Agendamentos na plataforma</p>
            </div>
          </div>

          {/* Breakdown planos */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-800 mb-4">Distribuição por plano</h2>
            <div className="space-y-3">
              {[
                { label: "Trial",     value: stats.trial,    total: stats.total, color: "bg-slate-400" },
                { label: "Mensal",    value: stats.monthly,  total: stats.total, color: "bg-blue-500" },
                { label: "Anual",     value: stats.annual,   total: stats.total, color: "bg-brand" },
                { label: "Vitalício", value: stats.lifetime, total: stats.total, color: "bg-purple-500" },
              ].map((row) => {
                const pct = row.total > 0 ? Math.round((row.value / row.total) * 100) : 0;
                return (
                  <div key={row.label} className="flex items-center gap-3">
                    <span className="text-sm text-slate-600 w-20 shrink-0">{row.label}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                      <div className={`${row.color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 w-8 text-right">{row.value}</span>
                    <span className="text-xs text-slate-400 w-8">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Alertas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {stats.expiringSoon > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
                <p className="text-2xl font-bold text-amber-700">{stats.expiringSoon}</p>
                <p className="text-xs text-amber-600 mt-1">Expirando em 7 dias</p>
              </div>
            )}
            {stats.expired > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
                <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
                <p className="text-xs text-red-500 mt-1">Trials expirados (churn)</p>
              </div>
            )}
            {stats.blocked > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                <p className="text-2xl font-bold text-slate-600">{stats.blocked}</p>
                <p className="text-xs text-slate-400 mt-1">Contas bloqueadas</p>
              </div>
            )}
            {stats.expiringSoon === 0 && stats.expired === 0 && stats.blocked === 0 && (
              <div className="sm:col-span-3 bg-brand-light border border-brand/20 rounded-2xl p-4 text-center text-sm text-brand-dark font-medium">
                ✅ Nenhum alerta no momento
              </div>
            )}
          </div>

          {/* Usuários recentes */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-800 mb-4">Cadastros recentes</h2>
            {loading ? (
              <p className="text-slate-400 text-sm">Carregando...</p>
            ) : (
              <div className="space-y-2">
                {clients.slice(0, 5).map((c) => {
                  const plan = PLAN_LABELS[c.plan_type] || PLAN_LABELS.trial;
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 text-sm truncate">{c.business_name || c.name || "Sem nome"}</p>
                        <p className="text-xs text-slate-400 truncate">{c.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${plan.color}`}>{plan.label}</span>
                        <span className="text-xs text-slate-400">{formatDate(c.registered_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button
              onClick={() => setTab("clientes")}
              className="mt-3 text-sm text-brand font-medium hover:underline"
            >
              Ver todos →
            </button>
          </div>
        </div>
      )}

      {/* ── CLIENTES ── */}
      {tab === "clientes" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              className="input flex-1 text-sm"
              placeholder="Buscar por nome, e-mail ou slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex gap-2 flex-wrap">
              {["todos", ...PLAN_TYPES].map((p) => (
                <button
                  key={p}
                  onClick={() => setFilterPlan(p)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                    filterPlan === p ? "bg-brand text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {p === "todos" ? "Todos" : PLAN_LABELS[p]?.label || p}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="text-slate-400 text-sm">Carregando clientes...</p>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
              Nenhum cliente encontrado.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((c) => {
                const plan = PLAN_LABELS[c.plan_type] || PLAN_LABELS.trial;
                const isExpired = c.plan_expires_at && new Date(c.plan_expires_at) < new Date();
                return (
                  <div
                    key={c.id}
                    className={`bg-white rounded-2xl border p-4 ${c.is_blocked ? "border-red-200 opacity-60" : "border-slate-200"}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900 truncate">
                            {c.business_name || c.name || "Sem nome"}
                          </p>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${plan.color}`}>
                            {plan.label}
                          </span>
                          {c.is_blocked && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Bloqueado</span>
                          )}
                          {isExpired && !c.is_blocked && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600">Expirado</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 truncate mt-0.5">{c.email || "—"}</p>
                        <div className="flex gap-3 mt-1.5 text-xs text-slate-400 flex-wrap">
                          {c.slug && (
                            <a
                              href={`/agendar/${c.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand hover:underline"
                            >
                              /{c.slug} ↗
                            </a>
                          )}
                          {c.plan_expires_at && <span>Vence: {formatDate(c.plan_expires_at)}</span>}
                          {c.plan_price_cents && <span>{formatBRL(c.plan_price_cents)}</span>}
                          <span>Cadastro: {formatDate(c.registered_at)}</span>
                          <span>Login: {formatDatetime(c.last_sign_in_at)}</span>
                          <span>📅 {c.booking_count} agendamento{c.booking_count !== 1 ? "s" : ""}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => openEdit(c)}
                          className="btn text-sm px-3 py-1.5 border border-slate-200 hover:bg-slate-50"
                        >
                          Editar plano
                        </button>
                        <button
                          onClick={() => setConfirmDelete(c)}
                          className="btn text-sm px-3 py-1.5 border border-red-200 text-red-500 hover:bg-red-50"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CONFIGURAÇÕES ── */}
      {tab === "config" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
            <div>
              <h2 className="font-bold text-slate-900 text-lg">Links de pagamento</h2>
              <p className="text-sm text-slate-500 mt-1">
                Configure os links de checkout do Infinit Pay para cada plano. Os clientes serão redirecionados para esses links ao tentar assinar.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Plano Mensal — URL do checkout</label>
                <input
                  className="input font-mono text-sm"
                  value={cfgMonthlyUrl}
                  onChange={(e) => setCfgMonthlyUrl(e.target.value)}
                  placeholder="https://checkout.infinitpay.io/..."
                  type="url"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Configure o webhook no Infinit Pay como:{" "}
                  <code className="bg-slate-100 px-1 rounded">https://agendasj.vercel.app/api/webhook/infinitpay?plan=monthly</code>
                </p>
              </div>

              <div>
                <label className="label">Plano Anual — URL do checkout</label>
                <input
                  className="input font-mono text-sm"
                  value={cfgAnnualUrl}
                  onChange={(e) => setCfgAnnualUrl(e.target.value)}
                  placeholder="https://checkout.infinitpay.io/..."
                  type="url"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Configure o webhook no Infinit Pay como:{" "}
                  <code className="bg-slate-100 px-1 rounded">https://agendasj.vercel.app/api/webhook/infinitpay?plan=annual</code>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                className="btn-primary px-6"
                onClick={saveConfig}
                disabled={cfgSaving}
              >
                {cfgSaving ? "Salvando..." : "Salvar configurações"}
              </button>
              {cfgSaved && (
                <span className="text-sm text-brand font-medium">✅ Salvo com sucesso!</span>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-sm text-blue-700 space-y-2">
            <p className="font-semibold">Como configurar o Infinit Pay:</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-600">
              <li>Crie dois produtos/links de checkout no Infinit Pay (mensal e anual)</li>
              <li>Em cada produto, configure o webhook apontando para a URL acima com o <code className="bg-blue-100 px-1 rounded">?plan=</code> correspondente</li>
              <li>Cole as URLs de checkout nos campos acima e salve</li>
              <li>Quando um cliente pagar, o plano será ativado automaticamente pelo e-mail cadastrado</li>
            </ol>
          </div>
        </div>
      )}

      {/* Modal confirmar exclusão */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-xl shrink-0">🗑</div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Excluir cliente</h3>
                <p className="text-sm text-slate-500">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              Todos os dados de <strong>{confirmDelete.business_name || confirmDelete.name || confirmDelete.email}</strong> serão
              excluídos permanentemente: agendamentos, cobranças, clientes, serviços, disponibilidade e conta de acesso.
            </div>
            <div className="flex gap-3 pt-1">
              <button className="flex-1 btn border border-slate-200" onClick={() => setConfirmDelete(null)} disabled={deleting}>
                Cancelar
              </button>
              <button className="flex-1 btn bg-red-600 text-white hover:bg-red-700 font-semibold" onClick={deleteClient} disabled={deleting}>
                {deleting ? "Excluindo..." : "Excluir permanentemente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar plano */}
      {editClient && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Editar plano</h3>
                <p className="text-sm text-slate-500">{editClient.business_name || editClient.name || editClient.email}</p>
              </div>
              <button onClick={() => setEditClient(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            <div>
              <label className="label">Plano</label>
              <select className="input" value={ePlan} onChange={(e) => setEPlan(e.target.value)}>
                {PLAN_TYPES.map((p) => (
                  <option key={p} value={p}>{PLAN_LABELS[p]?.label || p}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Vencimento do plano</label>
                <input className="input" type="date" value={eExpires} onChange={(e) => setEExpires(e.target.value)} />
              </div>
              <div>
                <label className="label">Valor cobrado (R$)</label>
                <input className="input" value={ePrice} onChange={(e) => setEPrice(e.target.value)} placeholder="49,90" inputMode="decimal" />
              </div>
            </div>

            <div>
              <label className="label">Notas internas</label>
              <textarea
                className="input resize-none"
                rows={2}
                value={eNotes}
                onChange={(e) => setENotes(e.target.value)}
                placeholder="Observações sobre este cliente..."
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={eBlocked} onChange={(e) => setEBlocked(e.target.checked)} className="w-4 h-4 accent-red-500" />
              <span className="text-sm text-red-600 font-medium">Bloquear acesso ao portal</span>
            </label>

            <div className="flex gap-3 pt-2">
              <button className="flex-1 btn border border-slate-200" onClick={() => setEditClient(null)}>Cancelar</button>
              <button className="flex-1 btn-primary" onClick={saveEdit} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
