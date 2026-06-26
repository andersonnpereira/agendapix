"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import { formatBRL, getTodayBR, addDaysBR } from "@/lib/format";
import { generatePixBRCode, normalizePixKey, type PixKeyType } from "@/lib/pix";
import WeekCalendar from "./WeekCalendar";

type Booking = {
  id: string;
  client_name: string;
  client_phone: string;
  date: string;
  time: string;
  status: "pendente" | "confirmado" | "concluido" | "cancelado";
  whatsapp_sent: boolean;
  notes: string | null;
  services: { name: string; price_cents: number; duration_minutes: number } | null;
};

type Profile = {
  id: string;
  pix_key: string | null;
  pix_key_type: string | null;
  pix_merchant_name: string | null;
  pix_merchant_city: string | null;
  whatsapp_provider: string;
  review_link: string | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pendente:   { label: "Pendente",   color: "bg-amber-100 text-amber-700" },
  confirmado: { label: "Confirmado", color: "bg-blue-100 text-blue-700" },
  concluido:  { label: "Concluído",  color: "bg-brand-light text-brand-dark" },
  cancelado:  { label: "Cancelado",  color: "bg-red-100 text-red-500" },
};

type Filter = "hoje" | "proximos" | "todos";

function calcEndTime(time: string, durationMinutes: number): string {
  const [hStr, mStr] = time.slice(0, 5).split(":");
  const totalMinutes = parseInt(hStr, 10) * 60 + parseInt(mStr, 10) + durationMinutes;
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

export default function AgendaPage() {
  const supabase = createClient();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("hoje");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [chargeModal, setChargeModal] = useState<Booking | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"lista" | "semana">("lista");
  const [weekStart, setWeekStart] = useState<string>(() => {
    // Monday of current week (BR timezone)
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const [calendarDetail, setCalendarDetail] = useState<Booking | null>(null);

  // Reagendamento
  const [rescheduleModal, setRescheduleModal] = useState<Booking | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  function addDaysToDate(dateStr: string, n: number): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d + n);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: p } = await supabase
      .from("profiles")
      .select("id, pix_key, pix_key_type, pix_merchant_name, pix_merchant_city, whatsapp_provider, review_link")
      .eq("id", user.id)
      .single();
    setProfile(p);

    const today = getTodayBR();
    let query = supabase
      .from("bookings")
      .select("*, services(name, price_cents, duration_minutes)")
      .eq("profile_id", user.id)
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (viewMode === "semana") {
      const weekEnd = addDaysToDate(weekStart, 6);
      query = query.gte("date", weekStart).lte("date", weekEnd);
    } else if (filter === "hoje") {
      query = query.eq("date", today);
    } else if (filter === "proximos") {
      query = query.gt("date", today).lte("date", addDaysBR(7));
    }

    const { data } = await query;
    setBookings((data as Booking[]) ?? []);
    setLoading(false);
  }, [supabase, filter, viewMode, weekStart]);

  useEffect(() => { load(); }, [load]);

  // Realtime: nova reserva = toast de notificação
  // Bug fix: salva referência do canal e usa channel.unsubscribe() no cleanup
  // para não remover canais de outros componentes.
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel>;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      channel = supabase
        .channel("agenda-realtime-" + user.id)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "bookings", filter: `profile_id=eq.${user.id}` },
          (payload) => {
            const b = payload.new as Booking;
            showToast(`🔔 Novo agendamento de ${b.client_name}!`);
            load();
          }
        )
        .subscribe();
    })();

    return () => { channel?.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirmar(booking: Booking) {
    setActionLoading(booking.id + "-confirmar");
    try {
      const { error: dbErr } = await supabase
        .from("bookings")
        .update({ status: "confirmado" })
        .eq("id", booking.id);

      if (dbErr) {
        showToast("Erro ao confirmar agendamento. Tente novamente.");
        return;
      }

      setBookings((prev) =>
        prev.map((b) =>
          b.id === booking.id ? { ...b, status: "confirmado" } : b
        )
      );

      fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: booking.id }),
      })
        .then((res) => {
          if (res.ok) {
            setBookings((prev) =>
              prev.map((b) =>
                b.id === booking.id ? { ...b, whatsapp_sent: true } : b
              )
            );
            showToast("✅ Confirmado! WhatsApp enviado ao cliente.");
          } else {
            showToast("Confirmado! (WhatsApp não pôde ser enviado — verifique configurações)");
          }
        })
        .catch(() => {
          showToast("Confirmado! (Falha ao enviar WhatsApp)");
        });
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

  async function excluirAgendamento(id: string) {
    setActionLoading(id + "-excluir");
    await supabase.from("bookings").delete().eq("id", id);
    setActionLoading(null);
    setConfirmDeleteId(null);
    load();
    showToast("Agendamento excluído.");
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

  async function reagendar() {
    if (!rescheduleModal) return;
    if (rescheduleDate < getTodayBR()) {
      showToast("Não é possível reagendar para uma data passada.");
      setActionLoading(null);
      return;
    }
    setActionLoading(rescheduleModal.id + "-reagendar");
    const { error } = await supabase
      .from("bookings")
      .update({ date: rescheduleDate, time: rescheduleTime })
      .eq("id", rescheduleModal.id);
    setActionLoading(null);
    if (error) {
      showToast("Erro ao reagendar. Tente novamente.");
      return;
    }
    setRescheduleModal(null);
    load();
    showToast("Agendamento reagendado!");
  }

  function openReschedule(b: Booking) {
    setRescheduleDate(b.date);
    setRescheduleTime(b.time?.slice(0, 5) ?? "");
    setRescheduleModal(b);
  }

  const formatDate = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  const filtered = search.trim()
    ? bookings.filter((b) =>
        b.client_name.toLowerCase().includes(search.toLowerCase()) ||
        b.client_phone.includes(search)
      )
    : bookings;

  // Contagem por filtro para badges
  const today = getTodayBR();
  const countHoje = bookings.filter((b) => b.date === today).length;

  const filterLabel = (f: Filter) => {
    if (f === "hoje") return countHoje > 0 ? `Hoje (${countHoje})` : "Hoje";
    if (f === "proximos") return "Próximos 7 dias";
    return "Todos";
  };

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Agenda</h1>
        <div className="flex gap-2 items-center">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setViewMode("lista")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "lista" ? "bg-brand text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              ☰ Lista
            </button>
            <button
              onClick={() => setViewMode("semana")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-slate-200 ${viewMode === "semana" ? "bg-brand text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              📅 Semana
            </button>
          </div>
          <a
            href="/api/ical"
            download="agenda.ics"
            className="text-xs text-slate-500 hover:text-brand border border-slate-200 rounded-lg px-3 py-1.5 transition-colors"
            title="Exportar para Google Calendar, iPhone ou Outlook"
          >
            ↓ .ics
          </a>
        </div>
      </div>

      {/* Busca (only in list mode) */}
      {viewMode === "lista" && (
        <input
          className="input text-sm"
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      {/* Filtros com badge de contagem (only in list mode) */}
      {viewMode === "lista" && (
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
              {filterLabel(f)}
            </button>
          ))}
        </div>
      )}

      {/* ── Visão de semana ── */}
      {viewMode === "semana" && (
        <WeekCalendar
          bookings={bookings}
          weekStart={weekStart}
          onPrev={() => setWeekStart((ws) => addDaysToDate(ws, -7))}
          onNext={() => setWeekStart((ws) => addDaysToDate(ws, 7))}
          onBookingClick={(b) => setCalendarDetail(b)}
        />
      )}

      {/* ── Visão de lista ── */}
      {viewMode === "lista" && (loading ? (
        <p className="text-slate-400 text-sm">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="card text-center text-slate-500 text-sm py-10">
          <p className="text-3xl mb-3">📅</p>
          <p>
            {search
              ? `Nenhum resultado para "${search}".`
              : `Nenhum agendamento${filter === "hoje" ? " para hoje" : filter === "proximos" ? " nos próximos 7 dias" : ""}.`}
          </p>
          {!search && <p className="mt-1 text-xs">Compartilhe seu link na bio para receber clientes.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => {
            const st = STATUS_LABELS[b.status];
            const isLoading = (suf: string) => actionLoading === `${b.id}-${suf}`;
            const startTime = b.time?.slice(0, 5) ?? "";
            const timeDisplay =
              b.services?.duration_minutes && startTime
                ? `${startTime} – ${calcEndTime(startTime, b.services.duration_minutes)}`
                : startTime;

            return (
              <div key={b.id} className="card py-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{b.client_name}</p>
                    <p className="text-sm text-slate-500">
                      {b.services?.name || "Serviço"} · {formatDate(b.date)} às {timeDisplay}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{b.client_phone}</p>
                    {b.notes && (
                      <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-0.5 mt-1 italic">
                        📝 {b.notes}
                      </p>
                    )}
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
                        className="btn text-sm px-3 py-1.5 border border-slate-200 hover:bg-slate-50"
                        onClick={() => openReschedule(b)}
                      >
                        Reagendar
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
                        className="btn text-sm px-3 py-1.5 border border-slate-200 hover:bg-slate-50"
                        onClick={() => openReschedule(b)}
                      >
                        Reagendar
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
                    <>
                      <button
                        className="btn-primary text-sm px-3 py-1.5"
                        onClick={() => criarCobranca(b)}
                        disabled={!!isLoading("cobrar")}
                      >
                        {isLoading("cobrar") ? "Criando..." : "💰 Gerar cobrança Pix"}
                      </button>
                      {profile?.review_link && (
                        <a
                          href={`https://wa.me/${b.client_phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                            "Olá " + b.client_name + "! Obrigado pelo atendimento 😊\nSe puder, deixe uma avaliação: " + profile.review_link
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn text-sm px-3 py-1.5 border border-amber-200 text-amber-600 hover:bg-amber-50"
                        >
                          ⭐ Pedir avaliação
                        </a>
                      )}
                      <button
                        className="btn text-sm px-3 py-1.5 text-red-500 border border-red-200 hover:bg-red-50"
                        onClick={() => setConfirmDeleteId(b.id)}
                        disabled={!!isLoading("excluir")}
                      >
                        🗑 Excluir
                      </button>
                    </>
                  )}
                  {b.status === "cancelado" && (
                    <button
                      className="btn text-sm px-3 py-1.5 text-red-500 border border-red-200 hover:bg-red-50"
                      onClick={() => setConfirmDeleteId(b.id)}
                      disabled={!!isLoading("excluir")}
                    >
                      🗑 Excluir da agenda
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Modal detalhe agendamento (calendário semana) */}
      {calendarDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4" onClick={() => setCalendarDetail(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">{calendarDetail.client_name}</h3>
              <button onClick={() => setCalendarDetail(null)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <p className="text-sm text-slate-600">{calendarDetail.services?.name || "Serviço"}</p>
            <p className="text-sm text-slate-500">
              {formatDate(calendarDetail.date)} às {calendarDetail.time?.slice(0, 5)}
            </p>
            <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-full ${STATUS_LABELS[calendarDetail.status]?.color}`}>
              {STATUS_LABELS[calendarDetail.status]?.label}
            </span>
            <button
              className="w-full mt-2 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
              onClick={() => { setCalendarDetail(null); setViewMode("lista"); setFilter("todos"); }}
            >
              Ver na lista →
            </button>
          </div>
        </div>
      )}

      {/* Modal confirmação de exclusão */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-lg">Excluir agendamento?</h3>
            <p className="text-sm text-slate-500">
              Esta ação não pode ser desfeita. O horário ficará livre na agenda.
            </p>
            <div className="flex gap-3">
              <button
                className="btn flex-1 border border-slate-200"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancelar
              </button>
              <button
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors"
                onClick={() => excluirAgendamento(confirmDeleteId)}
                disabled={!!actionLoading?.endsWith("-excluir")}
              >
                {actionLoading?.endsWith("-excluir") ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de reagendamento */}
      {rescheduleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-lg">Reagendar</h3>
            <p className="text-sm text-slate-500">
              {rescheduleModal.client_name} · {rescheduleModal.services?.name || "Serviço"}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                <input
                  type="date"
                  className="input text-sm w-full"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Horário</label>
                <input
                  type="time"
                  className="input text-sm w-full"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                className="btn flex-1 border border-slate-200"
                onClick={() => setRescheduleModal(null)}
              >
                Voltar
              </button>
              <button
                className="flex-1 btn-primary py-2.5"
                onClick={reagendar}
                disabled={!rescheduleDate || !rescheduleTime || !!actionLoading?.endsWith("-reagendar")}
              >
                {actionLoading?.endsWith("-reagendar") ? "Salvando..." : "Confirmar reagendamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
