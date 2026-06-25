"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { WEEKDAYS, getTodayBR } from "@/lib/format";

type Block = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
};

type DateOverride = {
  id: string;
  date: string;
  date_end: string | null;
  reason: string | null;
};

export default function DisponibilidadePage() {
  const supabase = createClient();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [dateOverrides, setDateOverrides] = useState<DateOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekday, setWeekday] = useState(1);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [templating, setTemplating] = useState(false);

  // Período indisponível
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [savingBlock, setSavingBlock] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: avail }, { data: overrides }] = await Promise.all([
      supabase
        .from("availability")
        .select("*")
        .eq("profile_id", user.id)
        .order("weekday")
        .order("start_time"),
      supabase
        .from("date_overrides")
        .select("*")
        .eq("profile_id", user.id)
        .order("date"),
    ]);

    setBlocks(avail || []);
    setDateOverrides((overrides as DateOverride[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const alreadyExists = blocks.some(
      (b) => b.weekday === weekday && b.start_time.slice(0, 5) === start && b.end_time.slice(0, 5) === end
    );
    if (alreadyExists) return;
    await supabase.from("availability").insert({
      profile_id: user.id,
      weekday,
      start_time: start,
      end_time: end,
    });
    load();
  }

  async function remove(id: string) {
    await supabase.from("availability").delete().eq("id", id);
    load();
  }

  async function addBlockedPeriod() {
    if (!blockStart) return;
    const end = blockEnd || blockStart;
    if (end < blockStart) {
      alert("A data final não pode ser anterior à data inicial.");
      return;
    }
    setSavingBlock(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingBlock(false); return; }

    await supabase.from("date_overrides").insert({
      profile_id: user.id,
      date: blockStart,
      date_end: end,
      reason: blockReason || null,
    });

    setBlockStart("");
    setBlockEnd("");
    setBlockReason("");
    setSavingBlock(false);
    load();
  }

  async function removeBlockedPeriod(id: string) {
    await supabase.from("date_overrides").delete().eq("id", id);
    load();
  }

  async function addTemplate(tpl: "padrao" | "sabado" | "todos") {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setTemplating(true);
    const configs = {
      padrao: { days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00" },
      sabado: { days: [1, 2, 3, 4, 5, 6], start: "08:00", end: "17:00" },
      todos:  { days: [0, 1, 2, 3, 4, 5, 6], start: "10:00", end: "20:00" },
    };
    const { days, start: s, end: e } = configs[tpl];
    for (const day of days) {
      const alreadyExists = blocks.some((b) => b.weekday === day && b.start_time.slice(0, 5) === s && b.end_time.slice(0, 5) === e);
      if (!alreadyExists) {
        await supabase.from("availability").insert({ profile_id: user.id, weekday: day, start_time: s, end_time: e });
      }
    }
    setTemplating(false);
    load();
  }

  const fmt = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  const periodLabel = (o: DateOverride) => {
    const end = o.date_end || o.date;
    return end === o.date ? fmt(o.date) : `${fmt(o.date)} até ${fmt(end)}`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Disponibilidade</h1>
      <p className="text-sm text-slate-500">
        Defina os blocos de horário em que você atende. Os clientes só
        conseguem agendar dentro deles.
      </p>

      {/* Templates rápidos */}
      <div className="card bg-brand-light border-brand/20 py-3 px-4 space-y-2">
        <p className="text-xs font-semibold text-brand-dark">⚡ Templates rápidos</p>
        <div className="flex flex-wrap gap-2">
          {([
            { key: "padrao", label: "Seg–Sex · 9h–18h" },
            { key: "sabado", label: "Seg–Sáb · 8h–17h" },
            { key: "todos",  label: "Todos os dias · 10h–20h" },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => addTemplate(t.key)}
              disabled={templating}
              className="btn text-xs border border-brand/30 text-brand-dark hover:bg-brand hover:text-white px-3 py-1.5 disabled:opacity-50"
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">Adiciona os blocos sem apagar os já existentes.</p>
      </div>

      {/* Horários semanais */}
      <div className="card space-y-3">
        <div>
          <label className="label">Dia da semana</label>
          <select
            className="input"
            value={weekday}
            onChange={(e) => setWeekday(parseInt(e.target.value))}
          >
            {WEEKDAYS.map((d, i) => (
              <option key={i} value={i}>{d}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Início</label>
            <input type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="label">Fim</label>
            <input type="time" className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <button className="btn-primary w-full" onClick={add}>
          + Adicionar bloco
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Carregando...</p>
      ) : (
        <div className="space-y-2">
          {WEEKDAYS.map((day, i) => {
            const dayBlocks = blocks.filter((b) => b.weekday === i);
            if (dayBlocks.length === 0) return null;
            return (
              <div key={i} className="card py-3">
                <p className="font-medium text-slate-900 mb-2">{day}</p>
                <div className="flex flex-wrap gap-2">
                  {dayBlocks.map((b) => (
                    <span
                      key={b.id}
                      className="inline-flex items-center gap-2 bg-brand-light text-brand-dark text-sm px-3 py-1 rounded-full"
                    >
                      {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                      <button onClick={() => remove(b.id)} className="text-brand-dark/60 hover:text-red-600">✕</button>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && blocks.length > 0 && (() => {
        const closedDays = WEEKDAYS.filter((_, i) => !blocks.some((b) => b.weekday === i));
        if (closedDays.length === 0) return null;
        return (
          <div className="border border-dashed border-slate-200 rounded-2xl p-3 text-center">
            <p className="text-xs text-slate-400">Dias fechados: <span className="font-medium">{closedDays.join(", ")}</span></p>
          </div>
        );
      })()}

      {/* Períodos indisponíveis */}
      <div className="space-y-3">
        <div>
          <h2 className="font-semibold text-slate-900">Períodos indisponíveis</h2>
          <p className="text-xs text-slate-400 mt-1">
            Bloqueie um dia ou período (férias, feriados, folgas). Para um único dia, deixe o final igual ao início.
          </p>
        </div>

        <div className="card space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">De</label>
              <input
                type="date"
                className="input"
                value={blockStart}
                onChange={(e) => {
                  setBlockStart(e.target.value);
                  if (!blockEnd || blockEnd < e.target.value) setBlockEnd(e.target.value);
                }}
                min={getTodayBR()}
              />
            </div>
            <div>
              <label className="label">Até</label>
              <input
                type="date"
                className="input"
                value={blockEnd}
                onChange={(e) => setBlockEnd(e.target.value)}
                min={blockStart || getTodayBR()}
              />
            </div>
          </div>
          <div>
            <label className="label">Motivo (opcional)</label>
            <input
              className="input"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Ex: Férias, Feriado, Folga..."
            />
          </div>
          <button
            className="btn-primary w-full"
            onClick={addBlockedPeriod}
            disabled={!blockStart || savingBlock}
          >
            {savingBlock ? "Salvando..." : "Bloquear período"}
          </button>
        </div>

        {!loading && dateOverrides.length > 0 && (
          <div className="space-y-2">
            {dateOverrides.map((o) => (
              <div key={o.id} className="card py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900 text-sm">🚫 {periodLabel(o)}</p>
                  {o.reason && <p className="text-xs text-slate-500 mt-0.5">{o.reason}</p>}
                </div>
                <button
                  onClick={() => removeBlockedPeriod(o.id)}
                  className="text-sm text-red-500 hover:text-red-700 font-medium px-2"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}

        {!loading && dateOverrides.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">Nenhum período bloqueado.</p>
        )}
      </div>
    </div>
  );
}
