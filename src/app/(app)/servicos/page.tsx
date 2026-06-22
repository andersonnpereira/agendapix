"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { formatBRL, parseToCents } from "@/lib/format";

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  active: boolean;
};

export default function ServicosPage() {
  const supabase = createClient();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("60");

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false });
    setServices(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addService() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !name) return;
    await supabase.from("services").insert({
      profile_id: user.id,
      name,
      price_cents: parseToCents(price),
      duration_minutes: parseInt(duration) || 60,
    });
    setName("");
    setPrice("");
    setDuration("60");
    setShowForm(false);
    load();
  }

  async function toggleActive(s: Service) {
    await supabase
      .from("services")
      .update({ active: !s.active })
      .eq("id", s.id);
    load();
  }

  async function remove(id: string) {
    await supabase.from("services").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Serviços</h1>
        <button
          className="btn-primary px-4 py-2 text-sm"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Fechar" : "+ Novo"}
        </button>
      </div>

      {showForm && (
        <div className="card space-y-3">
          <div>
            <label className="label">Nome do serviço</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Corte feminino"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Preço (R$)</label>
              <input
                className="input"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="80,00"
                inputMode="decimal"
              />
            </div>
            <div>
              <label className="label">Duração (min)</label>
              <input
                className="input"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>
          <button className="btn-primary w-full" onClick={addService}>
            Salvar serviço
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-slate-400 text-sm">Carregando...</p>
      ) : services.length === 0 ? (
        <div className="card text-center text-slate-500 text-sm py-8">
          Você ainda não cadastrou serviços.
        </div>
      ) : (
        <div className="space-y-2">
          {services.map((s) => (
            <div key={s.id} className="card flex items-center justify-between py-3">
              <div>
                <p
                  className={`font-medium ${
                    s.active ? "text-slate-900" : "text-slate-400 line-through"
                  }`}
                >
                  {s.name}
                </p>
                <p className="text-sm text-slate-500">
                  {formatBRL(s.price_cents)} · {s.duration_minutes} min
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="text-xs text-slate-500 hover:text-slate-800"
                  onClick={() => toggleActive(s)}
                >
                  {s.active ? "Pausar" : "Ativar"}
                </button>
                <button
                  className="text-xs text-red-500 hover:text-red-700"
                  onClick={() => remove(s.id)}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
