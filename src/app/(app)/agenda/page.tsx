"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import { formatBRL } from "@/lib/format";
import { generatePixBRCode, normalizePixKey, type PixKeyType } from "@/lib/pix";

type Booking = {
  id: string;
  client_name: string;
  client_phone: string;
  date: string;
  time: string;
  status: "pendente" | "confirmado" | "concluido" | "cancelado";
  whatsapp_sent: boolean;
  services: { name: string; price_cents: number; duration_minutes: number } | null;
};

type Profile = {
  id: string;
  pix_key: string | null;
  pix_key_type: string | null;
  pix_merchant_name: string | null;
  pix_merchant_city: string | null;
  whatsapp_provider: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pendente:   { label: "Pendente",   color: "bg-amber-100 text-amber-700" },
  confirmado: { label: "Confirmado", color: "bg-blue-100 text-blue-700" },
  concluido:  { label: "Concluído",  color: "bg-brand-light text-brand-dark" },
  cancelado:  { label: "Cancelado",  color: "bg-red-100 text-red-500" },
};

type Filter = "hoje" | "proximos" | "todos";

export default function AgendaPage() {
  const supabase = createClient();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("hoje");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [chargeModal, setChargeModal] = useState<Booking | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: p } = await supabase
      .from("profiles")
      .select("id, pix_key, pix_key_type, pix_merchant_name, pix_merchant_city, whatsapp_provider")
      .eq("id", user.id)
      .single();
    setProfile(p);

    const today = new Date().toISOString().slice(0, 10);
    let query = supabase
      .from("bookings")
      .select("*, services(name, price_cents, duration_minutes)")
      .eq("profile_id", user.id)
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (filter === "hoje") query = query.eq("date", today);
    else if (filter === "proximos") query = query.gt("date", today).lte("date", new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));

    const { data } = await query;
    setBookings((data as Booking[]) || []);
    setLoading(false);
  }, [supabase, filter]);

  useEffect(() => { load(); }, [load]);

  // Realtime: nova reserva = toast de notificação
  useEffect(() => {
    let profileId: string;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      profileId = user.id;

      supabase
        .channel("agenda-realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "bookings", filter: `profile_id=eq.${profileId}` },
          (payload) => {
            const b = payload.new as Booking;
            showToast(`🔔 Novo agendamento de ${b.client_name}!`);
            load();
          }
        )
        .subscribe();
    })();

    return () => { supabase.removeAllChannels(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirmar(booking: Booking) {
    setActionLoading(booking.id + "-confirmar");
    try {
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: booking.id }),
      });
      if (res.ok) {
        showToast("✅ Confirmado! WhatsApp enviado ao cliente.");
      } else {
        // mesmo com erro no WA, confirma o status
        await supabase.from("bookings").update({ status: "confirmado" }).eq("id", booking.id);
        showToast("Confirmado, mas WhatsApp não foi enviado. Verifique as configurações.");
      }
      load();
    } finally {
      setActionLoading(null);
    }
  }

  async function cancelar(id: string) {
    setActionLoading(id + "-cancelar");
    await supabase.from("bookings").update({ status: "cancelado" }).eq("id", id);
    setActionLoading(null);
    load();
    showToast("Agendamento cancelado.");
  }

  async function concluir(id: string) {
    setActionLoading(id + "-concluir");
    await supabase.from("bookings").update({ status: "concluido" }).eq("id", id);
    setActionLoading(null);
    load();
  }

  async function criarCobranca(booking: Booking) {
    if (!profile?.pix_key) {
      showToast("Cadastre sua chave Pix nas Configurações antes de cobrar.");
      return;
    }
    setActionLoading(booking.id + "-cobrar");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const amount = booking.services?.price_cents || 0;
    let pix_payload: string | null = null;
    try {
      pix_payload = generatePixBRCode({
        pixKey: normalizePixKey(profile.pix_key, profile.pix_key_type as PixKeyType || "celular"),
        amount: amount / 100,
        merchantName: profile.pix_merchant_name || "PROFISSIONAL",
        merchantCity: profile.pix_merchant_city || "BR",
        txid: booking.id.replace(/-/g, "").slice(0, 25),
      });
    } catch {
      showToast("Erro ao gerar Pix. Verifique sua chave nas Configurações.");
      setActionLoading(null);
      return;
    }

    await supabase.from("charges").insert({
      booking_id: booking.id,
      profile_id: user.id,
      client_name: booking.client_name,
      client_phone: booking.client_phone,
      description: booking.services?.name || "Serviço",
      amount_cents: amount,
      pix_payload,
      due_date: new Date().toISOString().slice(0, 10),
    });

    setActionLoading(null);
    showToast("Cobrança criada! Acesse Cobranças para enviar pelo WhatsApp.");
    setChargeModal(null);
  }

  const formatDate = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      <h1 className="text-2xl font-bold text-slate-900">Agenda</h1>

      {/* Filtros */}
      <div className="flex gap-2">
        {(["hoje", "proximos", "todos"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f
                ? "bg-brand text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f === "hoje" ? "Hoje" : f === "proximos" ? "Próximos 7 dias" : "Todos"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Carregando...</p>
      ) : bookings.length === 0 ? (
        <div className="card text-center text-slate-500 text-sm py-10">
          <p className="text-3xl mb-3">📅</p>
          <p>Nenhum agendamento{filter === "hoje" ? " para hoje" : filter === "proximos" ? " nos próximos 7 dias" : ""}.</p>
          <p className="mt-1 text-xs">Compartilhe seu link na bio para receber clientes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const st = STATUS_LABELS[b.status];
            const isLoading = (suf: string) => actionLoading === `${b.id}-${suf}`;
            return (
              <div key={b.id} className="card py-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{b.client_name}</p>
                    <p className="text-sm text-slate-500">
                      {b.services?.name || "Serviço"} · {formatDate(b.date)} às {b.time?.slice(0, 5)}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{b.client_phone}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${st.color}`}>
                    {st.label}
                  </span>
                </div>

                {b.services?.price_cents ? (
                  <p className="text-sm text-slate-600">
                    Valor: <strong>{formatBRL(b.services.price_cents)}</strong>
                  </p>
                ) : null}

                {/* Ações */}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
                  {b.status === "pendente" && (
                    <>
                      <button
                        className="btn-primary text-sm px-3 py-1.5"
                        onClick={() => confirmar(b)}
                        disabled={!!isLoading("confirmar")}
                      >
                        {isLoading("confirmar") ? "Enviando..." : "✓ Confirmar + WhatsApp"}
                      </button>
                      <button
                        className="btn text-sm px-3 py-1.5 text-red-500 border border-red-200 hover:bg-red-50"
                        onClick={() => cancelar(b.id)}
                        disabled={!!isLoading("cancelar")}
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                  {b.status === "confirmado" && (
                    <>
                      <button
                        className="btn-primary text-sm px-3 py-1.5"
                        onClick={() => concluir(b.id)}
                        disabled={!!isLoading("concluir")}
                      >
                        ✓ Marcar concluído
                      </button>
                      <button
                        className="btn text-sm px-3 py-1.5 text-red-500 border border-red-200 hover:bg-red-50"
                        onClick={() => cancelar(b.id)}
                        disabled={!!isLoading("cancelar")}
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                  {b.status === "concluido" && (
                    <button
                      className="btn-primary text-sm px-3 py-1.5"
                      onClick={() => criarCobranca(b)}
                      disabled={!!isLoading("cobrar")}
                    >
                      {isLoading("cobrar") ? "Criando..." : "💰 Gerar cobrança Pix"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
