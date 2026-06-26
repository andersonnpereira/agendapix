"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase-browser";
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

type Props = {
  profileId: string;
  services: Service[];
  availability: AvailBlock[];
  blockedDates?: BlockedPeriod[];
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
  booked: { time: string; duration_minutes: number }[]
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
        const be = bs + bk.duration_minutes;
        return t < be && slotEnd > bs;
      });
      if (!conflict) slots.push(minToTime(t));
    }
  }
  return [...new Set(slots)].sort();
}

function getAvailableDates(blocks: AvailBlock[], blockedPeriods: BlockedPeriod[] = []): string[] {
  const availableWeekdays = new Set(blocks.map((b) => b.weekday));
  const dates: string[] = [];
  for (let i = 0; i < 60; i++) {
    const base = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    base.setDate(base.getDate() + i);
    const dateStr = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
    const isBlocked = blockedPeriods.some((p) => dateStr >= p.start && dateStr <= p.end);
    if (availableWeekdays.has(base.getDay()) && !isBlocked) dates.push(dateStr);
  }
  return dates.slice(0, 30);
}

type Step = "service" | "datetime" | "contact" | "extras" | "confirm" | "success";

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
    <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-sm select-none">
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 text-xl font-light">‹</button>
        <span className="font-semibold text-slate-900 capitalize text-sm">{monthLabel}</span>
        <button type="button" onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 text-xl font-light">›</button>
      </div>
      <div className="grid grid-cols-7 mb-2">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="text-center text-xs text-slate-400 font-medium py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={i} />;
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
                isSelected ? "bg-brand text-white shadow-md scale-105"
                  : isAvailable ? "bg-brand-light text-brand-dark hover:bg-brand hover:text-white"
                  : isPast ? "text-slate-200 cursor-default"
                  : "text-slate-300 cursor-default",
                isToday && !isSelected ? "ring-2 ring-brand ring-offset-1" : "",
              ].filter(Boolean).join(" ")}
            >
              {parseInt(dateStr.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function BookingForm({ profileId, services, availability, blockedDates = [] }: Props) {
  const supabase = createClient();
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

  const availableDates = getAvailableDates(availability, blockedDates);
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

    const { data: booked } = await supabase
      .from("bookings")
      .select("time, services(duration_minutes)")
      .eq("profile_id", profileId)
      .eq("date", date)
      .in("status", ["pendente", "confirmado"]);

    if (requestId !== slotRequestRef.current) return;

    const bookedForCalc = (booked || []).map((b) => {
      const svc = b.services as unknown;
      const dur = Array.isArray(svc)
        ? (svc[0] as { duration_minutes: number } | undefined)?.duration_minutes
        : (svc as { duration_minutes: number } | null)?.duration_minutes;
      return { time: b.time as string, duration_minutes: dur || selectedService.duration_minutes };
    });

    let slots = calcSlots(availability, weekday, selectedService.duration_minutes, bookedForCalc);
    if (date === getTodayBrasilia()) {
      const currentMin = getCurrentMinutesBrasilia();
      slots = slots.filter((s) => timeToMin(s) > currentMin + 30);
    }
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
    return `${day}/${m}/${y}`;
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
  }

  // ── Step: success ──────────────────────────────────────────────────
  if (step === "success" && selectedService) {
    return (
      <div className="card text-center space-y-5 py-4">
        <div className="w-20 h-20 rounded-full bg-brand/10 flex items-center justify-center mx-auto">
          <span className="text-4xl">✅</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Agendamento solicitado!</h2>
          <p className="text-sm text-slate-500 mt-1">
            {clientEmail ? "Confirmação enviada para seu e-mail. 📧" : "Você receberá a confirmação pelo WhatsApp em breve. 📲"}
          </p>
        </div>
        <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Resumo do agendamento</p>
          <div className="space-y-2">
            <SummaryRow icon="✂️" label={selectedService.name} />
            <SummaryRow icon="📅" label={formatDate(selectedDate) + " às " + selectedTime} />
            <SummaryRow icon="👤" label={clientName} />
            <SummaryRow icon="📱" label={clientPhone} />
            {selectedService.price_cents > 0 && <SummaryRow icon="💰" label={formatBRL(selectedService.price_cents)} />}
          </div>
        </div>
        <button onClick={resetForm} className="w-full py-3 rounded-2xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
          ← Fazer outro agendamento
        </button>
      </div>
    );
  }

  // ── Progress bar ───────────────────────────────────────────────────
  const allSteps: Step[] = serviceQuestions.length > 0
    ? ["service", "datetime", "contact", "extras", "confirm"]
    : ["service", "datetime", "contact", "confirm"];
  const currentIdx = allSteps.indexOf(step);

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="flex gap-1.5">
        {allSteps.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= currentIdx ? "bg-brand" : "bg-slate-200"}`} />
        ))}
      </div>

      {/* ── Step 1: Escolher serviço ── */}
      {step === "service" && (
        <div className="space-y-3">
          <h2 className="font-bold text-slate-900">Escolha o serviço</h2>
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSelectedService(s); setSelectedDate(""); setSelectedTime(""); setExtraAnswers({}); setStep("datetime"); }}
              className="card w-full text-left py-3 flex items-center gap-3 hover:border-brand transition-colors"
            >
              {s.image_url && (
                <Image src={s.image_url} alt={s.name} width={56} height={56} className="rounded-xl object-cover w-14 h-14 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900">{s.name}</p>
                <p className="text-sm text-slate-500">{s.duration_minutes} minutos</p>
              </div>
              <span className="text-brand font-bold text-lg shrink-0">{formatBRL(s.price_cents)}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Step 2: Data e horário ── */}
      {step === "datetime" && selectedService && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setStep("service")} className="text-slate-400 hover:text-slate-600 text-xl">←</button>
            <h2 className="font-bold text-slate-900">Escolha data e horário</h2>
          </div>
          <div className="card bg-brand-light border-brand/20 py-2 px-3">
            <p className="text-sm text-brand-dark font-medium">{selectedService.name} · {formatBRL(selectedService.price_cents)}</p>
          </div>
          <div>
            <label className="label">Data</label>
            <CalendarPicker availableDates={availableDates} selectedDate={selectedDate} onSelect={(d) => onDateChange(d)} />
          </div>
          {selectedDate && (
            <div>
              <label className="label">Horário disponível</label>
              {loadingSlots ? (
                <p className="text-slate-400 text-sm">Verificando horários...</p>
              ) : availableSlots.length === 0 ? (
                <p className="text-sm text-red-500">Nenhum horário disponível nesta data. Escolha outro dia.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {availableSlots.map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectedTime(t)}
                      className={`py-2 rounded-lg text-sm font-medium border transition-colors ${selectedTime === t ? "bg-brand text-white border-brand" : "border-slate-200 text-slate-700 hover:border-brand hover:text-brand"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button className="btn-primary w-full" disabled={!selectedDate || !selectedTime} onClick={() => setStep("contact")}>
            Continuar →
          </button>
        </div>
      )}

      {/* ── Step 3: Dados de contato ── */}
      {step === "contact" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setStep("datetime")} className="text-slate-400 hover:text-slate-600 text-xl">←</button>
            <h2 className="font-bold text-slate-900">Seus dados</h2>
          </div>
          <div>
            <label className="label">Seu nome completo</label>
            <input className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="João da Silva" autoFocus />
          </div>
          <div>
            <label className="label">Seu WhatsApp</label>
            <input className="input" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="(11) 99999-8888" inputMode="tel" />
            <p className="text-xs text-slate-400 mt-1">A confirmação chegará aqui.</p>
          </div>
          <div>
            <label className="label">Seu e-mail (opcional)</label>
            <input className="input" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="joao@email.com" inputMode="email" autoComplete="email" />
            <p className="text-xs text-slate-400 mt-1">Receba a confirmação por e-mail com link para cancelar.</p>
          </div>
          <div>
            <label className="label">Observação (opcional)</label>
            <textarea className="input resize-none text-sm" rows={3} value={clientNotes} onChange={(e) => setClientNotes(e.target.value)} placeholder="Ex: prefiro franja curta, alergia a produto X..." />
          </div>
          <button className="btn-primary w-full" disabled={!clientName || !clientPhone} onClick={goFromContactToNext}>
            {serviceQuestions.length > 0 ? "Próximo →" : "Revisar agendamento →"}
          </button>
        </div>
      )}

      {/* ── Step 4 (opcional): Perguntas do serviço ── */}
      {step === "extras" && selectedService && serviceQuestions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setStep("contact")} className="text-slate-400 hover:text-slate-600 text-xl">←</button>
            <h2 className="font-bold text-slate-900">Mais informações</h2>
          </div>
          <p className="text-xs text-slate-500">O profissional precisa de algumas informações sobre o serviço:</p>
          {serviceQuestions.map((q) => (
            <div key={q.id}>
              <label className="label">
                {q.label}
                {q.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {q.type === "select" ? (
                <select
                  className="input"
                  value={extraAnswers[q.id] || ""}
                  onChange={(e) => setExtraAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                >
                  <option value="">Selecione...</option>
                  {q.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : q.type === "textarea" ? (
                <textarea
                  className="input resize-none text-sm"
                  rows={3}
                  value={extraAnswers[q.id] || ""}
                  onChange={(e) => setExtraAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                />
              ) : (
                <input
                  className="input"
                  value={extraAnswers[q.id] || ""}
                  onChange={(e) => setExtraAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                />
              )}
            </div>
          ))}
          {extrasError && <p className="text-sm text-red-500">{extrasError}</p>}
          <button
            className="btn-primary w-full"
            onClick={() => { if (validateExtras()) setStep("confirm"); }}
          >
            Revisar agendamento →
          </button>
        </div>
      )}

      {/* ── Step: Confirmar ── */}
      {step === "confirm" && selectedService && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setStep(serviceQuestions.length > 0 ? "extras" : "contact")} className="text-slate-400 hover:text-slate-600 text-xl">←</button>
            <h2 className="font-bold text-slate-900">Confirmar agendamento</h2>
          </div>
          <div className="card space-y-2.5 py-4">
            <Row label="Serviço" value={selectedService.name} />
            <Row label="Data" value={formatDate(selectedDate)} />
            <Row label="Horário" value={selectedTime} />
            <Row label="Nome" value={clientName} />
            <Row label="WhatsApp" value={clientPhone} />
            {clientEmail && <Row label="E-mail" value={clientEmail} />}
            {serviceQuestions.map((q) => (
              extraAnswers[q.id]
                ? <Row key={q.id} label={q.label} value={extraAnswers[q.id]} />
                : null
            ))}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-sm text-slate-500">Valor do serviço</span>
              <span className="font-bold text-slate-900">{formatBRL(selectedService.price_cents)}</span>
            </div>
          </div>
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <button className="btn-primary w-full" onClick={submit} disabled={submitting}>
            {submitting ? "Agendando..." : "Confirmar agendamento"}
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-sm text-slate-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-slate-900 text-right">{value}</span>
    </div>
  );
}

function SummaryRow({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-base w-6 text-center">{icon}</span>
      <span className="text-sm text-slate-700">{label}</span>
    </div>
  );
}
