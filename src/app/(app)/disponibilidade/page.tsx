"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { WEEKDAYS } from "@/lib/format";

type Block = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
};

export default function DisponibilidadePage() {
  const supabase = createClient();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekday, setWeekday] = useState(1);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("availability")
      .select("*")
      .eq("profile_id", user.id)
      .order("weekday")
      .order("start_time");
    setBlocks(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
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

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Disponibilidade</h1>
      <p className="text-sm text-slate-500">
        Defina os blocos de horário em que você atende. Os clientes só
        conseguem agendar dentro deles.
      </p>

      <div className="card space-y-3">
        <div>
          <label className="label">Dia da semana</label>
          <select
            className="input"
            value={weekday}
            onChange={(e) => setWeekday(parseInt(e.target.value))}
          >
            {WEEKDAYS.map((d, i) => (
              <option key={i} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Início</label>
            <input
              type="time"
              className="input"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Fim</label>
            <input
              type="time"
              className="input"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
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
                      <button
                        onClick={() => remove(b.id)}
                        className="text-brand-dark/60 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
