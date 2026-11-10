"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase-browser";
import { formatBRL } from "@/lib/format";

type Charge = {
  id: string;
  client_name: string | null;
  description: string | null;
  amount_cents: number;
  status: "pendente" | "pago" | "atrasado";
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  recurrence: "none" | "weekly" | "biweekly" | "monthly";
};

type PeriodMode = "semana" | "mes" | "mes_passado" | "custom";
type View = "lancamentos" | "pessoas";
type StatusFilter = "todos" | "pago" | "pendente" | "atrasado";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pago:     { label: "Pago",     color: "bg-brand-light text-brand-dark" },
  pendente: { label: "Pendente", color: "bg-amber-100 text-amber-700" },
  atrasado: { label: "Atrasado", color: "bg-red-100 text-red-600" },
};

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtBR(d: string | null): string {
  if (!d) return "";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

export default function FinanceiroPage() {
  const supabase = createClient();
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);

  const [periodMode, setPeriodMode] = useState<PeriodMode>("mes");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [view, setView] = useState<View>("lancamentos");
  const [statusFilter, setStatusFilter] = useState<"todos" | "pago" | "a_vencer" | "atrasado">("todos");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(50);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Pagina em blocos de 1000 — o Supabase limita cada consulta a 1000 linhas
    // por padrão, então sem isso cobranças ficavam de fora e o filtro mostrava
    // menos do que existe de verdade.
    const PAGE = 1000;
    const all: Charge[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("charges")
        .select("id, client_name, description, amount_cents, status, due_date, paid_at, created_at, recurrence")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      all.push(...(data as Charge[]));
      if (data.length < PAGE) break;
    }
    setCharges(all);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const todayKey = toKey(now);

  // ─── Período que comanda a tela ────────────────────────────────────────────
  const period = useMemo(() => {
    if (periodMode === "semana") {
      const dow = (now.getDay() + 6) % 7; // 0 = segunda
      const mon = new Date(now); mon.setDate(now.getDate() - dow);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { start: toKey(mon), end: toKey(sun), label: "esta semana" };
    }
    if (periodMode === "mes_passado") {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: toKey(s), end: toKey(e), label: "mês passado" };
    }
    if (periodMode === "custom") {
      const s = customFrom || "0000-01-01";
      const e = customTo || "9999-12-31";
      return { start: s <= e ? s : e, end: s <= e ? e : s, label: "período" };
    }
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: toKey(s), end: toKey(e), label: "este mês" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodMode, customFrom, customTo]);

  const inPeriod = (d: string | null) => {
    if (!d) return false;
    const k = d.slice(0, 10);
    return k >= period.start && k <= period.end;
  };

  // ─── Números do período (por COMPETÊNCIA = data de vencimento) ──────────────
  // "Cobranças do período" = todas que VENCEM no período (sem due_date, usa a
  // data de criação como âncora), divididas em pagas × a receber. Assim toda
  // cobrança do mês é contada uma vez e nenhuma some (nem as pagas adiantado).
  const periodChargesAll = charges.filter((c) => inPeriod(c.due_date || c.created_at));
  const recebidas = periodChargesAll.filter((c) => c.status === "pago");
  const aReceber  = periodChargesAll.filter((c) => c.status !== "pago");
  const aVencer   = aReceber.filter((c) => (c.due_date || "9999-12-31") >= todayKey);
  const vencidas  = aReceber.filter((c) => (c.due_date || "9999-12-31") < todayKey);

  // Bucket exibido na lista/filtro (coerente com os cards acima).
  const bucket = (c: Charge): "pago" | "atrasado" | "a_vencer" =>
    c.status === "pago" ? "pago" : (c.due_date || "9999-12-31") < todayKey ? "atrasado" : "a_vencer";

  const sum = (list: Charge[]) => list.reduce((s, c) => s + (c.amount_cents || 0), 0);
  const recebidoTotal = sum(recebidas);
  const aReceberTotal = sum(aReceber);
  const aVencerTotal  = sum(aVencer);
  const vencidoTotal  = sum(vencidas);

  const ticketMedio = recebidas.length > 0 ? Math.round(recebidoTotal / recebidas.length) : 0;
  const totalPrevisto = recebidoTotal + aReceberTotal;
  const pctRecebido = totalPrevisto > 0 ? Math.round((recebidoTotal / totalPrevisto) * 100) : 0;

  // MRR (independe do período — assinaturas ativas agora)
  const MONTHLY_FACTOR: Record<string, number> = { weekly: 52 / 12, biweekly: 26 / 12, monthly: 1 };
  const recurringOpen = charges.filter((c) => c.recurrence !== "none" && c.status !== "pago");
  const mrr = Math.round(recurringOpen.reduce((s, c) => s + c.amount_cents * (MONTHLY_FACTOR[c.recurrence] || 1), 0));

  // ─── Lista do período (lançamentos) ────────────────────────────────────────
  // Todos os lançamentos que vencem no período (bate com os cards).
  const s = search.trim().toLowerCase();
  const periodCharges = periodChargesAll;
  const matched = periodCharges
    .filter((c) => statusFilter === "todos" || bucket(c) === statusFilter)
    .filter((c) => !s || (c.client_name || "").toLowerCase().includes(s) || (c.description || "").toLowerCase().includes(s))
    .sort((a, b) => (b.paid_at || b.due_date || b.created_at).localeCompare(a.paid_at || a.due_date || a.created_at));
  const visible = matched.slice(0, visibleCount);

  // ─── Visão por pessoa ──────────────────────────────────────────────────────
  const pessoas = useMemo(() => {
    const map: Record<string, { nome: string; pago: number; aReceber: number; vencido: number; qtd: number }> = {};
    for (const c of periodCharges) {
      const nome = (c.client_name || "—").trim();
      if (!map[nome]) map[nome] = { nome, pago: 0, aReceber: 0, vencido: 0, qtd: 0 };
      map[nome].qtd++;
      if (c.status === "pago") {
        map[nome].pago += c.amount_cents;
      } else {
        map[nome].aReceber += c.amount_cents;
        if ((c.due_date || "9999-12-31") < todayKey) map[nome].vencido += c.amount_cents;
      }
    }
    return Object.values(map)
      .filter((p) => !s || p.nome.toLowerCase().includes(s))
      .sort((a, b) => (b.aReceber - a.aReceber) || (b.pago - a.pago) || a.nome.localeCompare(b.nome, "pt-BR"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodCharges, s, todayKey]);

  function exportCSV() {
    const header = ["Cliente", "Descrição", "Valor (R$)", "Status", "Vencimento", "Pago em"];
    const rows = matched.map((c) => [
      c.client_name || "", c.description || "",
      ((c.amount_cents || 0) / 100).toFixed(2).replace(".", ","),
      STATUS_LABEL[c.status]?.label || c.status, fmtBR(c.due_date), fmtBR(c.paid_at),
    ]);
    const csv = [header, ...rows].map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `financeiro_${period.start}_a_${period.end}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (loading) return <p className="text-slate-400 text-sm pt-4">Carregando...</p>;

  const resetPaging = () => setVisibleCount(50);

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Financeiro</h1>
        <button onClick={exportCSV} className="btn border border-slate-200 text-sm px-3 py-2">⬇ CSV</button>
      </div>

      {/* Filtro de período — comanda toda a tela */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: "semana", label: "Esta semana" },
          { key: "mes", label: "Este mês" },
          { key: "mes_passado", label: "Mês passado" },
          { key: "custom", label: "Personalizado" },
        ] as const).map((f) => (
          <button
            key={f.key}
            onClick={() => { setPeriodMode(f.key); resetPaging(); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              periodMode === f.key ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {periodMode === "custom" && (
        <div className="flex items-center gap-2">
          <input type="date" className="input text-sm" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); resetPaging(); }} />
          <span className="text-slate-400 text-sm">até</span>
          <input type="date" className="input text-sm" value={customTo} onChange={(e) => { setCustomTo(e.target.value); resetPaging(); }} />
        </div>
      )}

      {/* Os 2 números que importam no período */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card py-4 space-y-1 bg-brand-light border-brand/20">
          <p className="text-xs text-brand-dark font-medium">✅ Já recebido ({period.label})</p>
          <p className="text-2xl font-bold text-brand-dark">{formatBRL(recebidoTotal)}</p>
          <p className="text-xs text-brand-dark/70">{recebidas.length} de {periodChargesAll.length} cobrança{periodChargesAll.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="card py-4 space-y-1 bg-amber-50 border-amber-200">
          <p className="text-xs text-amber-700 font-medium">⏳ A receber ({period.label})</p>
          <p className="text-2xl font-bold text-amber-700">{formatBRL(aReceberTotal)}</p>
          <p className="text-xs text-amber-700/70">{aReceber.length} em aberto</p>
        </div>
      </div>

      {/* Quebra do "a receber" + barra de progresso */}
      <div className="card py-3 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="text-xs text-slate-500">A vencer</p>
            <p className="text-base font-bold text-slate-900">{formatBRL(aVencerTotal)}</p>
            <p className="text-[11px] text-slate-400">{aVencer.length} cobrança{aVencer.length !== 1 ? "s" : ""}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Vencido</p>
            <p className="text-base font-bold text-red-600">{formatBRL(vencidoTotal)}</p>
            <p className="text-[11px] text-slate-400">{vencidas.length} atrasada{vencidas.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        {totalPrevisto > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Recebido de {formatBRL(totalPrevisto)} previsto</span>
              <span className="font-semibold text-brand">{pctRecebido}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand rounded-full" style={{ width: `${pctRecebido}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* KPIs secundários */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card py-3 text-center">
          <p className="text-sm font-bold text-slate-900">{formatBRL(ticketMedio)}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Ticket médio</p>
        </div>
        <div className="card py-3 text-center">
          <p className="text-sm font-bold text-blue-700">{mrr > 0 ? formatBRL(mrr) : "—"}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Recorrente/mês</p>
        </div>
        <div className="card py-3 text-center">
          <p className="text-sm font-bold text-slate-900">{new Set(periodCharges.map((c) => (c.client_name || "—").trim())).size}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Pessoas</p>
        </div>
      </div>

      {/* Lista: alternar Lançamentos × Por pessoa */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setView("lancamentos")}
              className={`px-3 py-1.5 text-xs font-medium ${view === "lancamentos" ? "bg-brand text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              Lançamentos
            </button>
            <button
              onClick={() => setView("pessoas")}
              className={`px-3 py-1.5 text-xs font-medium border-l border-slate-200 ${view === "pessoas" ? "bg-brand text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              Por pessoa
            </button>
          </div>
          <span className="ml-auto text-xs text-slate-400">
            {view === "pessoas" ? `${pessoas.length} pessoa${pessoas.length !== 1 ? "s" : ""}` : `${matched.length} lançamento${matched.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        <input
          className="input text-sm"
          placeholder="Buscar por pessoa ou descrição..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); resetPaging(); }}
        />

        {view === "lancamentos" && (
          <div className="flex flex-wrap gap-2">
            {([
              { key: "todos", label: "Todas" },
              { key: "pago", label: "Pagas" },
              { key: "a_vencer", label: "A vencer" },
              { key: "atrasado", label: "Atrasadas" },
            ] as const).map((f) => (
              <button
                key={f.key}
                onClick={() => { setStatusFilter(f.key); resetPaging(); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === f.key ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Lançamentos ── */}
        {view === "lancamentos" && (
          matched.length === 0 ? (
            <div className="card text-center text-slate-500 text-sm py-8">
              <p className="text-2xl mb-2">💰</p>
              <p>Nenhuma movimentação neste período.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {visible.map((c) => {
                  const st = STATUS_LABEL[c.status];
                  return (
                    <div key={c.id} className="card py-3 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {c.client_name || "—"}
                          {c.description ? <span className="text-slate-400"> · {c.description}</span> : null}
                        </p>
                        <p className="text-xs text-slate-400">
                          {c.status === "pago" && c.paid_at ? `Pago em ${fmtBR(c.paid_at)}` : c.due_date ? `Vence ${fmtBR(c.due_date)}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`font-bold text-sm ${c.status === "pago" ? "text-brand" : c.status === "atrasado" ? "text-red-600" : "text-slate-900"}`}>
                          {formatBRL(c.amount_cents)}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {matched.length > visible.length && (
                <button onClick={() => setVisibleCount((v) => v + 50)} className="btn border border-slate-200 text-sm w-full py-2.5 text-slate-600 hover:bg-slate-50">
                  Ver mais ({matched.length - visible.length} restante{matched.length - visible.length !== 1 ? "s" : ""})
                </button>
              )}
            </>
          )
        )}

        {/* ── Por pessoa ── */}
        {view === "pessoas" && (
          pessoas.length === 0 ? (
            <div className="card text-center text-slate-500 text-sm py-8">Nenhuma pessoa neste período.</div>
          ) : (
            <div className="space-y-2">
              {pessoas.map((p) => (
                <div key={p.nome} className="card py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 truncate">{p.nome}</p>
                    <span className="text-[11px] text-slate-400 shrink-0">{p.qtd} cobrança{p.qtd !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs">
                    {p.pago > 0 && <span className="text-brand font-semibold">✅ {formatBRL(p.pago)}</span>}
                    {p.aReceber > 0 && <span className="text-amber-600 font-semibold">⏳ {formatBRL(p.aReceber)}</span>}
                    {p.vencido > 0 && <span className="text-red-600 font-semibold">🔴 {formatBRL(p.vencido)} vencido</span>}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
