"use client";

import { useState, useCallback, useEffect } from "react";
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
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pago:     { label: "Pago",     color: "bg-brand-light text-brand-dark" },
  pendente: { label: "Pendente", color: "bg-amber-100 text-amber-700" },
  atrasado: { label: "Atrasado", color: "bg-red-100 text-red-600" },
};

export default function FinanceiroPage() {
  const supabase = createClient();
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"mes" | "trimestre" | "semestre" | "ano">("mes");
  const [hoverBar, setHoverBar] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("charges")
      .select("id, client_name, description, amount_cents, status, due_date, paid_at, created_at")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false });
    setCharges((data as Charge[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

  const paid = charges.filter((c) => c.status === "pago");
  const pending = charges.filter((c) => c.status === "pendente");
  const overdue = charges.filter((c) => c.status === "atrasado");

  const thisMonthRevenue = paid
    .filter((c) => (c.paid_at || "").startsWith(thisMonthKey))
    .reduce((s, c) => s + c.amount_cents, 0);

  const lastMonthRevenue = paid
    .filter((c) => (c.paid_at || "").startsWith(lastMonthKey))
    .reduce((s, c) => s + c.amount_cents, 0);

  const pendingTotal = pending.reduce((s, c) => s + c.amount_cents, 0);
  const overdueTotal = overdue.reduce((s, c) => s + c.amount_cents, 0);
  const totalReceived = paid.reduce((s, c) => s + c.amount_cents, 0);

  // Ticket médio
  const ticketMedio = paid.length > 0 ? Math.round(totalReceived / paid.length) : 0;

  // Taxa de inadimplência
  const totalBase = totalReceived + pendingTotal + overdueTotal;
  const inadimplencia = totalBase > 0 ? (overdueTotal / totalBase) * 100 : 0;

  // 6-month chart
  const monthChart = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const revenue = paid
      .filter((c) => (c.paid_at || "").startsWith(key))
      .reduce((s, c) => s + c.amount_cents, 0);
    const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    return { key, label, revenue, isCurrent: key === thisMonthKey };
  });
  const maxRevenue = Math.max(...monthChart.map((m) => m.revenue), 1);

  // Previsão próximo mês: média dos últimos 3 meses
  const last3 = monthChart.slice(-3);
  const avgLast3 = last3.length > 0
    ? Math.round(last3.reduce((s, m) => s + m.revenue, 0) / last3.length)
    : 0;

  // Transaction list filter
  const periodMonths = period === "mes" ? 1 : period === "trimestre" ? 3 : period === "semestre" ? 6 : 12;
  const fromDate = new Date(now.getFullYear(), now.getMonth() - (periodMonths - 1), 1);
  const fromStr = fromDate.toISOString().slice(0, 10);
  const filtered = charges
    .filter((c) => (c.paid_at || c.due_date || c.created_at) >= fromStr)
    .slice(0, 100);

  const periodPaid = filtered.filter((c) => c.status === "pago").reduce((s, c) => s + c.amount_cents, 0);

  const growth =
    lastMonthRevenue > 0
      ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : null;

  const fmt = (d: string | null) => {
    if (!d) return "";
    const [y, m, day] = d.slice(0, 10).split("-");
    return `${day}/${m}/${y}`;
  };

  // CSV export
  const exportCSV = () => {
    const header = ["Cliente", "Descrição", "Valor (R$)", "Status", "Vencimento", "Pago em"];
    const rows = filtered.map((c) => [
      c.client_name || "",
      c.description || "",
      ((c.amount_cents || 0) / 100).toFixed(2).replace(".", ","),
      STATUS_LABEL[c.status]?.label || c.status,
      fmt(c.due_date),
      fmt(c.paid_at),
    ]);
    const csvContent = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `financeiro_${period}_${now.toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className="text-slate-400 text-sm pt-4">Carregando...</p>;

  return (
    <div className="space-y-5 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Financeiro</h1>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12v6m0 0l-3-3m3 3l3-3M12 3v9" />
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* Summary cards — grid 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total recebido — full width */}
        <div className="card py-3 space-y-1 col-span-2 bg-brand-light border-brand/20">
          <p className="text-xs text-brand-dark font-medium">Total recebido (histórico)</p>
          <p className="text-3xl font-bold text-brand-dark">{formatBRL(totalReceived)}</p>
          <p className="text-xs text-brand-dark/70">
            {paid.length} pagamento{paid.length !== 1 ? "s" : ""} confirmado{paid.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Este mês */}
        <div className="card py-3 space-y-1">
          <p className="text-xs text-slate-500">Este mês</p>
          <p className="text-lg font-bold text-slate-900">{formatBRL(thisMonthRevenue)}</p>
          {growth !== null && (
            <p className={`text-xs font-semibold ${growth >= 0 ? "text-brand" : "text-red-500"}`}>
              {growth >= 0 ? "▲" : "▼"} {Math.abs(growth)}% vs anterior
            </p>
          )}
        </div>

        {/* Mês anterior */}
        <div className="card py-3 space-y-1">
          <p className="text-xs text-slate-500">Mês anterior</p>
          <p className="text-lg font-bold text-slate-900">{formatBRL(lastMonthRevenue)}</p>
          <p className="text-xs text-slate-400">
            {paid.filter((c) => (c.paid_at || "").startsWith(lastMonthKey)).length}{" "}
            pagamento{paid.filter((c) => (c.paid_at || "").startsWith(lastMonthKey)).length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* A receber */}
        <div className="card py-3 space-y-1">
          <p className="text-xs text-slate-500">A receber</p>
          <p className="text-lg font-bold text-amber-600">{formatBRL(pendingTotal)}</p>
          <p className="text-xs text-slate-400">{pending.length} pendente{pending.length !== 1 ? "s" : ""}</p>
        </div>

        {/* Em atraso */}
        <div className="card py-3 space-y-1">
          <p className="text-xs text-slate-500">Em atraso</p>
          <p className="text-lg font-bold text-red-600">{formatBRL(overdueTotal)}</p>
          <p className="text-xs text-slate-400">{overdue.length} atrasada{overdue.length !== 1 ? "s" : ""}</p>
        </div>

        {/* Ticket médio */}
        <div className="card py-3 space-y-1">
          <p className="text-xs text-slate-500">Ticket médio</p>
          <p className="text-lg font-bold text-slate-900">{formatBRL(ticketMedio)}</p>
          <p className="text-xs text-slate-400">por pagamento</p>
        </div>

        {/* Taxa de inadimplência */}
        <div className="card py-3 space-y-1">
          <p className="text-xs text-slate-500">Inadimplência</p>
          <p className={`text-lg font-bold ${inadimplencia > 15 ? "text-red-600" : inadimplencia > 5 ? "text-amber-600" : "text-slate-900"}`}>
            {inadimplencia.toFixed(1).replace(".", ",")}%
          </p>
          <p className="text-xs text-slate-400">sobre total geral</p>
        </div>
      </div>

      {/* Previsão próximo mês */}
      <div className="card py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Previsão próximo mês</p>
          <p className="text-xs text-slate-400">Média dos últimos 3 meses</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
            Estimativa
          </span>
          <p className="text-lg font-bold text-slate-900">{formatBRL(avgLast3)}</p>
        </div>
      </div>

      {/* 6-month chart */}
      <div className="card py-4 space-y-4">
        <p className="text-sm font-semibold text-slate-900">Receita mensal — últimos 6 meses</p>
        <div className="flex items-end gap-2" style={{ height: "120px" }}>
          {monthChart.map((m) => {
            const isHovered = hoverBar === m.key;
            const barHeight = Math.max((m.revenue / maxRevenue) * 80, m.revenue > 0 ? 6 : 0);
            return (
              <div
                key={m.key}
                className="flex-1 flex flex-col items-center justify-end gap-1 relative"
                onMouseEnter={() => setHoverBar(m.key)}
                onMouseLeave={() => setHoverBar(null)}
              >
                {/* Tooltip */}
                {isHovered && m.revenue > 0 && (
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                    <div className="bg-slate-800 text-white text-xs font-semibold px-2 py-1 rounded-md whitespace-nowrap shadow-lg">
                      {formatBRL(m.revenue)}
                    </div>
                    <div className="w-2 h-2 bg-slate-800 rotate-45 mx-auto -mt-1" />
                  </div>
                )}

                {/* Value label (non-hover) */}
                {!isHovered && m.revenue > 0 && (
                  <span className="text-xs text-slate-500 text-center leading-none">
                    {formatBRL(m.revenue).replace("R$ ", "R$")}
                  </span>
                )}

                <div
                  className={`w-full rounded-t-lg transition-all cursor-default ${
                    isHovered
                      ? m.isCurrent
                        ? "bg-brand/80"
                        : "bg-slate-400"
                      : m.isCurrent
                      ? "bg-brand"
                      : "bg-slate-200"
                  }`}
                  style={{ height: `${barHeight}px` }}
                />
                <span className="text-xs text-slate-400 capitalize">{m.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transactions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-slate-900">Movimentações</p>
          <select
            className="input text-sm py-1.5 w-auto"
            value={period}
            onChange={(e) => setPeriod(e.target.value as typeof period)}
          >
            <option value="mes">Este mês</option>
            <option value="trimestre">Últimos 3 meses</option>
            <option value="semestre">Últimos 6 meses</option>
            <option value="ano">Último ano</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="card text-center text-slate-500 text-sm py-8">
            <p className="text-2xl mb-2">💰</p>
            <p>Nenhuma movimentação neste período.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {filtered.map((c) => {
                const st = STATUS_LABEL[c.status];
                return (
                  <div key={c.id} className="card py-3 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {c.client_name || "—"}
                        {c.description ? <span className="text-slate-400"> · {c.description}</span> : null}
                      </p>
                      <p className="text-xs text-slate-400">
                        {c.status === "pago" && c.paid_at
                          ? `Pago em ${fmt(c.paid_at)}`
                          : c.due_date
                          ? `Vence ${fmt(c.due_date)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`font-bold text-sm ${c.status === "pago" ? "text-brand" : c.status === "atrasado" ? "text-red-600" : "text-slate-900"}`}>
                        {formatBRL(c.amount_cents)}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="card bg-brand-light border-brand/20 py-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-brand-dark">Total recebido no período</p>
              <p className="font-bold text-brand text-lg">{formatBRL(periodPaid)}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
