"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { formatBRL } from "@/lib/format";

type ExtraQuestion = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select";
  options: string[];
  required: boolean;
};

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  image_url?: string | null;
  extra_questions?: ExtraQuestion[];
};

type AvailBlock = { weekday: number; start_time: string; end_time: string };
type BlockedPeriod = { start: string; end: string };

type BookingSettings = {
  minNoticeHours: number;
  maxAdvanceDays: number;
  dailyBookingLimit: number | null;
  bufferMinutes: number;
  autoConfirm: boolean;
  cancelMinHours: number;
};

type Props = {
  profileId: string;
  services: Service[];
  availability: AvailBlock[];
  blockedDates?: BlockedPeriod[];
  bookingSettings?: BookingSettings;
  businessName?: string;
};

function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minToTime(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
function getTodayBrasilia(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getCurrentMinutesBrasilia(): number {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return d.getHours() * 60 + d.getMinutes();
}

function calcSlots(
  blocks: AvailBlock[],
  weekday: number,
  duration: number,
  booked: { time: string; duration_minutes: number }[],
  bufferMinutes = 0
): string[] {
  const dayBlocks = blocks.filter((b) => b.weekday === weekday);
  const slots: string[] = [];
  for (const block of dayBlocks) {
    const start = timeToMin(block.start_time);
    const end = timeToMin(block.end_time);
    for (let t = start; t + duration <= end; t += duration) {
      const slotEnd = t + duration;
      const conflict = booked.some((bk) => {
        const bs = timeToMin(bk.time);
        const be = bs + bk.duration_minutes + bufferMinutes;
        return t < be && slotEnd > bs;
      });
      if (!conflict) slots.push(minToTime(t));
    }
  }
  return [...new Set(slots)].sort();
}

function getMinutesUntilSlot(date: string, slotTime: string): number {
  const todayBR = getTodayBrasilia();
  const [ty, tm, td] = todayBR.split("-").map(Number);
  const [sy, sm, sd] = date.split("-").map(Number);
  const daysDiff = Math.round(
    (new Date(sy, sm - 1, sd).getTime() - new Date(ty, tm - 1, td).getTime()) / (1000 * 60 * 60 * 24)
  );
  return daysDiff * 1440 + timeToMin(slotTime) - getCurrentMinutesBrasilia();
}

function getAvailableDates(blocks: AvailBlock[], blockedPeriods: BlockedPeriod[] = [], maxDays = 60): string[] {
  const availableWeekdays = new Set(blocks.map((b) => b.weekday));
  const dates: string[] = [];
  for (let i = 0; i < maxDays; i++) {
    const base = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    base.setDate(base.getDate() + i);
    const dateStr = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
    const isBlocked = blockedPeriods.some((p) => dateStr >= p.start && dateStr <= p.end);
    if (availableWeekdays.has(base.getDay()) && !isBlocked) dates.push(dateStr);
  }
  return dates;
}

function buildGoogleCalendarUrl({
  title,
  date,
  time,
  duration,
  description,
}: {
  title: string;
  date: string;
  time: string;
  duration: number;
  description?: string;
}): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, m] = time.split(":").map(Number);
  const start = new Date(y, mo - 1, d, h, m);
  const end = new Date(start.getTime() + duration * 60 * 1000);
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, "0")}${String(dt.getDate()).padStart(2, "0")}T${String(dt.getHours()).padStart(2, "0")}${String(dt.getMinutes()).padStart(2, "0")}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${fmt(start)}/${fmt(end)}`,
    ...(description ? { details: description } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

type Step = "service" | "datetime" | "contact" | "extras" | "confirm" | "success";

const STEP_LABELS: Record<string, string> = {
  service: "Serviço",
  datetime: "Data",
  contact: "Contato",
  extras: "Detalhes",
  confirm: "Revisar",
};

function CalendarPicker({
  availableDates,
  selectedDate,
  onSelect,
}: {
  availableDates: string[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const availableSet = new Set(availableDates);
  const today = getTodayBrasilia();
  const initStr = availableDates[0] || today;
  const [viewYear, setViewYear] = useState(() => parseInt(initStr.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => parseInt(initStr.slice(5, 7)) - 1);

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm select-none">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <button
          type="button"
          onClick={prevMonth}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 text-lg transition-colors"
          aria-label="Mês anterior"
        >
          ‹
        </button>
        <span className="font-semibold text-slate-800 capitalize text-sm">{monthLabel}</span>
        <button
          type="button"
          onClick={nextMonth}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 text-lg transition-colors"
          aria-label="Próximo mês"
        >
          ›
        </button>
      </div>
      <div className="px-3 pt-3 pb-2">
        <div className="grid grid-cols-7 mb-2">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
            <div key={i} className="text-center text-xs text-slate-400 font-semibold py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((dateStr, i) => {
            if (!dateStr) return <div key={i} className="h-9" />;
            const isAvailable = availableSet.has(dateStr);
            const isSelected = dateStr === selectedDate;
            const isPast = dateStr < today;
            const isToday = dateStr === today;
            return (
              <button
                key={dateStr}
                type="button"
                disabled={!isAvailable}
                onClick={() => onSelect(dateStr)}
                className={[
                  "h-9 w-full rounded-xl text-sm font-medium transition-all",
                  isSelected
                    ? "bg-brand text-white shadow scale-105"
                    : isAvailable
                    ? "bg-brand-light text-brand-dark hover:bg-brand hover:text-white"
                    : isPast
                    ? "text-slate-200 cursor-default"
                    : "text-slate-300 cursor-default",
                  isToday && !isSelected ? "ring-2 ring-brand ring-offset-1" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {parseInt(dateStr.slice(8))}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function BookingForm({
  profileId,
  services,
  availability,
  blockedDates = [],
  bookingSettings,
  businessName,
}: Props) {
  const formTopRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>("service");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientNotes, setClientNotes] = useState("");
  const [extraAnswers, setExtraAnswers] = useState<Record<string, string>>({});
  const [extrasError, setExtrasError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (step !== "service") {
      setTimeout(() => {
        formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  }, [step]);

  const availableDates = getAvailableDates(availability, blockedDates, bookingSettings?.maxAdvanceDays ?? 60);
  const slotRequestRef = useRef(0);

  const serviceQuestions: ExtraQuestion[] = selectedService?.extra_questions?.length
    ? selectedService.extra_questions
    : [];

  function goFromContactToNext() {
    if (serviceQuestions.length > 0) {
      setExtrasError("");
      setStep("extras");
    } else {
      setStep("confirm");
    }
  }

  function validateExtras(): boolean {
    for (const q of serviceQuestions) {
      if (q.required && !extraAnswers[q.id]?.trim()) {
        setExtrasError(`"${q.label}" é obrigatória.`);
        return false;
      }
    }
    setExtrasError("");
    return true;
  }

  async function onDateChange(date: string) {
    setSelectedDate(date);
    setSelectedTime("");
    if (!date || !selectedService) return;

    setLoadingSlots(true);
    const requestId = ++slotRequestRef.current;
    const weekday = new Date(date + "T00:00:00").getDay();

    // Horários ocupados via endpoint server-side (sem PII) — a tabela
    // bookings não é mais lida diretamente pelo navegador.
    let booked: Array<{ time: string; duration_minutes: number }> = [];
    try {
      const res = await fetch(`/api/slots?profileId=${encodeURIComponent(profileId)}&date=${encodeURIComponent(date)}`);
      if (res.ok) booked = (await res.json()).booked || [];
    } catch { /* rede — trata como sem ocupação conhecida */ }

    if (requestId !== slotRequestRef.current) return;

    const bookedForCalc = booked.map((b) => ({
      time: b.time,
      duration_minutes: b.duration_minutes || selectedService.duration_minutes,
    }));

    const bufferMins = bookingSettings?.bufferMinutes ?? 0;
    let slots = calcSlots(availability, weekday, selectedService.duration_minutes, bookedForCalc, bufferMins);
    const baseNotice = date === getTodayBrasilia() ? 30 : 0;
    const minNoticeMinutes = Math.max((bookingSettings?.minNoticeHours ?? 0) * 60, baseNotice);
    slots = slots.filter((s) => getMinutesUntilSlot(date, s) >= minNoticeMinutes);
    setAvailableSlots(slots);
    setLoadingSlots(false);
  }

  async function submit() {
    if (!selectedService || !selectedDate || !selectedTime || !clientName || !clientPhone) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: profileId,
          service_id: selectedService.id,
          client_name: clientName,
          client_phone: clientPhone,
          client_email: clientEmail || null,
          client_notes: clientNotes,
          extra_answers: Object.keys(extraAnswers).length > 0 ? extraAnswers : null,
          date: selectedDate,
          time: selectedTime + ":00",
        }),
      });

      if (!res.ok) {
        const { error: e } = await res.json();
        // 409 = horário acabou de ser ocupado — volta para a seleção de horário
        // e recarrega os slots para o cliente escolher outro.
        if (res.status === 409) {
          setError(e || "Este horário acabou de ser reservado. Escolha outro, por favor.");
          setSelectedTime("");
          await onDateChange(selectedDate);
          setStep("datetime");
          setSubmitting(false);
          return;
        }
        setError(e || "Erro ao agendar. Tente novamente.");
        setSubmitting(false);
        return;
      }

      setStep("success");
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setSubmitting(false);
    }
  }

  const formatDate = (d: string) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    const dt = new Date(Number(y), Number(m) - 1, Number(day));
    return dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  };

  function resetForm() {
    setStep("service");
    setSelectedService(null);
    setSelectedDate("");
    setSelectedTime("");
    setClientName("");
    setClientPhone("");
    setClientEmail("");
    setClientNotes("");
    setExtraAnswers({});
    setError("");
  }

  // ── Step: success ────────────────────────────────────────────────────────────
  if (step === "success" && selectedService) {
    const gcalUrl = buildGoogleCalendarUrl({
      title: `${selectedService.name}${businessName ? ` — ${businessName}` : ""}`,
      date: selectedDate,
      time: selectedTime,
      duration: selectedService.duration_minutes,
      description: businessName ? `Agendado com ${businessName}` : undefined,
    });

    const dateFormatted = selectedDate.split("-").reverse().join("/");

    return (
      <div ref={formTopRef} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
        <div className="bg-brand px-6 pt-8 pb-10 text-center text-white">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-4xl">🎉</span>
          </div>
          <h2 className="text-xl font-extrabold">Agendamento solicitado!</h2>
          <p className="text-white/80 text-sm mt-1">
            {bookingSettings?.autoConfirm ? "Confirmado automaticamente." : "Você receberá a confirmação em breve."}
          </p>
        </div>

        <div className="-mt-4 mx-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Resumo</p>
          <SummaryRow icon="✂️" label={selectedService.name} />
          <SummaryRow icon="📅" label={`${formatDate(selectedDate)} às ${selectedTime}`} />
          <SummaryRow icon="👤" label={clientName} />
          <SummaryRow icon="📱" label={clientPhone} />
          {selectedService.price_cents > 0 && (
            <SummaryRow icon="💰" label={formatBRL(selectedService.price_cents)} />
          )}
        </div>

        <div className="px-4 pt-4 pb-6 space-y-3">
          <a
            href={gcalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <CalendarIcon />
            Adicionar ao Google Agenda
          </a>
          <button
            onClick={resetForm}
            className="w-full py-3 rounded-2xl bg-brand-light text-brand-dark text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            + Fazer outro agendamento
          </button>
        </div>

        {bookingSettings?.cancelMinHours && bookingSettings.cancelMinHours > 0 ? (
          <p className="text-center text-xs text-slate-400 pb-5 px-4">
            Se precisar cancelar, faça com pelo menos <strong>{bookingSettings.cancelMinHours}h</strong> de antecedência.
          </p>
        ) : null}
      </div>
    );
  }

  // ── Step progress ────────────────────────────────────────────────────────────
  const allSteps: Step[] = serviceQuestions.length > 0
    ? ["service", "datetime", "contact", "extras", "confirm"]
    : ["service", "datetime", "contact", "confirm"];
  const currentIdx = allSteps.indexOf(step);

  return (
    <div ref={formTopRef} className="scroll-mt-4">
      {/* Progress indicator */}
      {step !== "success" && (
        <div className="flex items-center mb-5 gap-0">
          {allSteps.map((s, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <div key={s} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center shrink-0">
                  <div
                    className={[
                      "w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-all",
                      done
                        ? "bg-brand text-white"
                        : active
                        ? "bg-brand text-white ring-4 ring-brand/20"
                        : "bg-slate-200 text-slate-400",
                    ].join(" ")}
                  >
                    {done ? "✓" : i + 1}
                  </div>
                  <span
                    className={`text-[10px] mt-0.5 font-medium whitespace-nowrap ${
                      active ? "text-brand-dark" : "text-slate-400"
                    }`}
                  >
                    {STEP_LABELS[s]}
                  </span>
                </div>
                {i < allSteps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 mb-4 transition-colors ${done ? "bg-brand" : "bg-slate-200"}`} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Step 1: Escolher serviço ─────────────────────────────────────────── */}
      {step === "service" && (
        <div className="space-y-3 pb-6">
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSelectedService(s);
                setSelectedDate("");
                setSelectedTime("");
                setExtraAnswers({});
                setStep("datetime");
              }}
              className="group w-full bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-brand hover:shadow-md transition-all text-left overflow-hidden"
            >
              {s.image_url && (
                <div className="relative w-full h-36 overflow-hidden">
                  <Image
                    src={s.image_url}
                    alt={s.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 100vw, 576px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </div>
              )}
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                {!s.image_url && (
                  <div className="w-11 h-11 rounded-xl bg-brand-light flex items-center justify-center text-xl shrink-0">✂️</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-base">{s.name}</p>
                  <p className="text-sm text-slate-500">{s.duration_minutes} min</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-extrabold text-brand text-lg leading-none">{formatBRL(s.price_cents)}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Agendar →</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Step 2: Data e horário ──────────────────────────────────────────── */}
      {step === "datetime" && selectedService && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-5 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep("service")}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"
              aria-label="Voltar"
            >
              ←
            </button>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Escolha data e horário</h2>
              <p className="text-xs text-slate-400">{selectedService.name}</p>
            </div>
          </div>

          <CalendarPicker
            availableDates={availableDates}
            selectedDate={selectedDate}
            onSelect={(d) => onDateChange(d)}
          />

          {selectedDate && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-slate-700">Horários disponíveis</label>
                {!loadingSlots && availableSlots.length > 0 && (
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {availableSlots.length} horário{availableSlots.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {loadingSlots ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-10 rounded-xl bg-slate-100 animate-pulse" />
                  ))}
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-center">
                  <p className="text-sm text-red-600 font-medium">Sem horários neste dia</p>
                  <p className="text-xs text-red-400 mt-0.5">Escolha outra data no calendário.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {availableSlots.map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectedTime(t)}
                      className={[
                        "py-2.5 rounded-xl text-sm font-semibold border transition-all",
                        selectedTime === t
                          ? "bg-brand text-white border-brand shadow"
                          : "border-slate-200 text-slate-700 hover:border-brand hover:text-brand bg-white",
                      ].join(" ")}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            className="btn-primary w-full py-3 rounded-2xl text-sm font-bold disabled:opacity-40"
            disabled={!selectedDate || !selectedTime}
            onClick={() => setStep("contact")}
          >
            Continuar →
          </button>
        </div>
      )}

      {/* ── Step 3: Dados de contato ─────────────────────────────────────────── */}
      {step === "contact" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep("datetime")}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"
            >
              ←
            </button>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Seus dados</h2>
              <p className="text-xs text-slate-400">{formatDate(selectedDate)} às {selectedTime}</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nome completo <span className="text-red-400">*</span></label>
            <input
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="João da Silva"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">WhatsApp <span className="text-red-400">*</span></label>
            <input
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="(11) 99999-8888"
              inputMode="tel"
            />
            <p className="text-xs text-slate-400 mt-1">Você receberá a confirmação aqui.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">E-mail <span className="text-slate-400 font-normal">(opcional)</span></label>
            <input
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="joao@email.com"
              inputMode="email"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Observação <span className="text-slate-400 font-normal">(opcional)</span></label>
            <textarea
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors resize-none"
              rows={3}
              value={clientNotes}
              onChange={(e) => setClientNotes(e.target.value)}
              placeholder="Ex: prefiro franja curta, alergia a produto X..."
            />
          </div>

          <button
            className="btn-primary w-full py-3 rounded-2xl text-sm font-bold disabled:opacity-40"
            disabled={!clientName || !clientPhone}
            onClick={goFromContactToNext}
          >
            {serviceQuestions.length > 0 ? "Próximo →" : "Revisar agendamento →"}
          </button>
        </div>
      )}

      {/* ── Step 4 (opcional): Perguntas extras ──────────────────────────────── */}
      {step === "extras" && selectedService && serviceQuestions.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep("contact")}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"
            >
              ←
            </button>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Mais informações</h2>
              <p className="text-xs text-slate-400">Sobre o serviço</p>
            </div>
          </div>

          {serviceQuestions.map((q) => (
            <div key={q.id}>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                {q.label}
                {q.required && <span className="text-red-400 ml-1">*</span>}
              </label>
              {q.type === "select" ? (
                <select
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors bg-white"
                  value={extraAnswers[q.id] || ""}
                  onChange={(e) => setExtraAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                >
                  <option value="">Selecione...</option>
                  {q.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : q.type === "textarea" ? (
                <textarea
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors resize-none"
                  rows={3}
                  value={extraAnswers[q.id] || ""}
                  onChange={(e) => setExtraAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                />
              ) : (
                <input
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors"
                  value={extraAnswers[q.id] || ""}
                  onChange={(e) => setExtraAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                />
              )}
            </div>
          ))}

          {extrasError && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{extrasError}</p>
          )}

          <button
            className="btn-primary w-full py-3 rounded-2xl text-sm font-bold"
            onClick={() => { if (validateExtras()) setStep("confirm"); }}
          >
            Revisar agendamento →
          </button>
        </div>
      )}

      {/* ── Step: Confirmar ──────────────────────────────────────────────────── */}
      {step === "confirm" && selectedService && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
          <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center gap-2">
            <button
              onClick={() => setStep(serviceQuestions.length > 0 ? "extras" : "contact")}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"
            >
              ←
            </button>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Confirmar agendamento</h2>
              <p className="text-xs text-slate-400">Verifique os dados antes de confirmar</p>
            </div>
          </div>

          <div className="px-5 py-4 space-y-3">
            {selectedService.image_url && (
              <div className="relative w-full h-28 rounded-xl overflow-hidden mb-2">
                <Image
                  src={selectedService.image_url}
                  alt={selectedService.name}
                  fill
                  className="object-cover"
                  sizes="576px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              </div>
            )}

            <ConfirmRow icon="✂️" label="Serviço" value={selectedService.name} highlight />
            <ConfirmRow icon="📅" label="Data" value={formatDate(selectedDate)} />
            <ConfirmRow icon="🕐" label="Horário" value={selectedTime} />
            <ConfirmRow icon="👤" label="Nome" value={clientName} />
            <ConfirmRow icon="📱" label="WhatsApp" value={clientPhone} />
            {clientEmail && <ConfirmRow icon="📧" label="E-mail" value={clientEmail} />}
            {serviceQuestions.map((q) =>
              extraAnswers[q.id] ? (
                <ConfirmRow key={q.id} icon="📋" label={q.label} value={extraAnswers[q.id]} />
              ) : null
            )}

            {selectedService.price_cents > 0 && (
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className="text-sm text-slate-500">Valor do serviço</span>
                <span className="font-extrabold text-xl text-brand">{formatBRL(selectedService.price_cents)}</span>
              </div>
            )}
          </div>

          {bookingSettings?.cancelMinHours && bookingSettings.cancelMinHours > 0 && (
            <div className="mx-5 mb-4 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 text-xs text-amber-700">
              ℹ️ Para cancelar, faça com pelo menos <strong>{bookingSettings.cancelMinHours}h</strong> de antecedência.
            </div>
          )}

          {error && (
            <div className="mx-5 mb-3 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="px-5 pb-5">
            <button
              className="btn-primary w-full py-3.5 rounded-2xl text-sm font-bold disabled:opacity-50"
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Agendando...
                </span>
              ) : (
                "Confirmar agendamento"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfirmRow({ icon, label, value, highlight }: { icon: string; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-base w-5 shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className={`text-sm ${highlight ? "font-bold text-slate-900" : "font-medium text-slate-700"} truncate`}>{value}</p>
      </div>
    </div>
  );
}

function SummaryRow({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-base w-5 shrink-0 text-center">{icon}</span>
      <span className="text-sm text-slate-700 font-medium">{label}</span>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
