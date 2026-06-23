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
};

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  trial:    { label: "Trial",   color: "bg-slate-100 text-slate-600" },
  monthly:  { label: "Mensal",  color: "bg-blue-100 text-blue-700" },
  annual:   { label: "Anual",   color: "bg-brand-light text-brand-dark" },
  lifetime: { label: "Vitalício", color: "bg-purple-100 text-purple-700" },
};

const PLAN_TYPES = ["trial", "monthly", "annual", "lifetime"];

export default function AdminPage() {
  const supabase = createClient();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("todos");
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState("");

  // Edit form state
  const [ePlan, setEPlan] = useState("trial");
  const [eExpires, setEExpires] = useState("");
  const [ePrice, setEPrice] = useState("");
  const [eBlocked, setEBlocked] = useState(false);
  const [eNotes, setENotes] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

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
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

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
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ id: confirmDelete.id }),
    });
    setDeleting(false);
    setConfirmDelete(null);
    if (res.ok) {
      load();
      showToast("Cliente excluído com sucesso.");
    } else {
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
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
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
    if (res.ok) {
      setEditClient(null);
      load();
      showToast("Cliente atualizado.");
    } else {
      showToast("Erro ao salvar.");
    }
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

  const stats = {
    total: clients.length,
    trial: clients.filter((c) => c.plan_type === "trial").length,
    monthly: clients.filter((c) => c.plan_type === "monthly").length,
    annual: clients.filter((c) => c.plan_type === "annual").length,
    blocked: clients.filter((c) => c.is_blocked).length,
    mrr: clients.filter((c) => c.plan_type === "monthly" && !c.is_blocked)
      .reduce((s, c) => s + (c.plan_price_cents || 0), 0),
    arr: clients.filter((c) => c.plan_type === "annual" && !c.is_blocked)
      .reduce((s, c) => s + (c.plan_price_cents || 0), 0),
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    const [y, m, day] = d.slice(0, 10).split("-");
    return `${day}/${m}/${y}`;
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Gerenciador de Clientes</h1>
        <p className="text-slate-500 text-sm">Gerencie licenças e planos dos assinantes AgendaPix.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          ⚠️ {error}
          {error.includes("SERVICE_ROLE") && (
            <p className="mt-2 text-xs">Adicione <code className="bg-red-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> nas variáveis do Vercel.</p>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total clientes", value: stats.total, color: "text-slate-900" },
          { label: "Trial", value: stats.trial, color: "text-slate-600" },
          { label: "Mensais", value: stats.monthly, color: "text-blue-700" },
          { label: "Anuais", value: stats.annual, color: "text-brand" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {stats.mrr > 0 || stats.arr > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
            <p className="text-lg font-bold text-blue-800">{formatBRL(stats.mrr)}</p>
            <p className="text-xs text-blue-600 mt-1">MRR (mensal)</p>
          </div>
          <div className="bg-brand-light border border-brand/20 rounded-2xl p-4 text-center">
            <p className="text-lg font-bold text-brand-dark">{formatBRL(stats.arr)}</p>
            <p className="text-xs text-brand-dark mt-1">ARR (anual)</p>
          </div>
        </div>
      ) : null}

      {/* Filtros + busca */}
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

      {/* Lista de clientes */}
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
                className={`bg-white rounded-2xl border p-4 flex items-center justify-between gap-4 ${
                  c.is_blocked ? "border-red-200 opacity-60" : "border-slate-200"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 truncate">
                      {c.business_name || c.name || "Sem nome"}
                    </p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${plan.color}`}>
                      {plan.label}
                    </span>
                    {c.is_blocked && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                        Bloqueado
                      </span>
                    )}
                    {isExpired && !c.is_blocked && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600">
                        Expirado
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 truncate mt-0.5">{c.email || "—"}</p>
                  <div className="flex gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                    {c.slug && <span>/{c.slug}</span>}
                    {c.plan_expires_at && <span>Vence: {formatDate(c.plan_expires_at)}</span>}
                    {c.plan_price_cents && <span>{formatBRL(c.plan_price_cents)}</span>}
                    <span>Cadastro: {formatDate(c.registered_at)}</span>
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
            );
          })}
        </div>
      )}

      {/* Modal confirmação de exclusão */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-xl shrink-0">
                🗑
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Excluir cliente</h3>
                <p className="text-sm text-slate-500">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              Todos os dados de <strong>{confirmDelete.business_name || confirmDelete.name || confirmDelete.email}</strong> serão
              excluídos permanentemente: agendamentos, cobranças, serviços, disponibilidade e conta de acesso.
            </div>
            <div className="flex gap-3 pt-1">
              <button
                className="flex-1 btn border border-slate-200"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                className="flex-1 btn bg-red-600 text-white hover:bg-red-700 font-semibold"
                onClick={deleteClient}
                disabled={deleting}
              >
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
              <input
                type="checkbox"
                checked={eBlocked}
                onChange={(e) => setEBlocked(e.target.checked)}
                className="w-4 h-4 accent-red-500"
              />
              <span className="text-sm text-red-600 font-medium">Bloquear acesso ao portal</span>
            </label>

            <div className="flex gap-3 pt-2">
              <button className="flex-1 btn border border-slate-200" onClick={() => setEditClient(null)}>
                Cancelar
              </button>
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
