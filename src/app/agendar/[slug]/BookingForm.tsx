"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { formatBRL } from "@/lib/format";

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
};

type AvailBlock = {
  weekday: number;
  start_time: string;
  end_time: string;
};

type Props = {
  profileId: string;
  services: Service[];
  availability: AvailBlock[];
};

function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minToTime(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// Gera os slots disponíveis para um dia, excluindo os já agendados
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
  return slots;
}

// Gera lista de datas disponíveis para os próximos 60 dias
function getAvailableDates(blocks: AvailBlock[]): string[] {
  const availableWeekdays = new Set(blocks.map((b) => b.weekday));
  const dates: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // começa amanhã
  const start = new Date(today);
  start.setDate(start.getDate() + 1);

  for (let i = 0; i < 60; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const wd = d.getDay(); // 0=domingo
    if (availableWeekdays.has(wd)) {
      dates.push(d.toISOString().slice(0, 10));
    }
  }
  return dates.slice(0, 30); // máx 30 datas
}

type Step = "service" | "datetime" | "contact" | "confirm" | "success";

export default function BookingForm({ profileId, services, availability }: Props) {
  const supabase = createClient();
  const [step, setStep] = useState<Step>("service");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const availableDates = getAvailableDates(availability);

  async function onDateChange(date: string) {
    setSelectedDate(date);
    setSelectedTime("");
    if (!date || !selectedService) return;

    setLoadingSlots(true);
    const weekday = new Date(date + "T00:00:00").getDay();

    const { data: booked } = await supabase
      .from("bookings")
      .select("time, services(duration_minutes)")
      .eq("profile_id", profileId)
      .eq("date", date)
      .in("status", ["pendente", "confirmado"]);

    const bookedForCalc = (booked || []).map((b) => ({
      time: b.time as string,
      // @ts-expect-error join
      duration_minutes: b.services?.duration_minutes || selectedService.duration_minutes,
    }));

    const slots = calcSlots(availability, weekday, selectedService.duration_minutes, bookedForCalc);
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

  // ── Step: success ──────────────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="card text-center space-y-4 py-8">
        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-bold text-slate-900">Agendamento recebido!</h2>
        <p className="text-slate-600">
          Obrigado, <strong>{clientName}</strong>! Seu agendamento foi registrado com sucesso.
        </p>
        <div className="bg-brand-light rounded-xl p-4 text-left space-y-1.5">
          <p className="text-sm font-semibold text-brand-dark">Resumo do agendamento</p>
          <p className="text-sm text-slate-700">📋 {selectedService?.name}</p>
          <p className="text-sm text-slate-700">📅 {formatDate(selectedDate)} às {selectedTime}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">⏳ Aguarde a confirmação</p>
          <p>Você receberá a confirmação pelo <strong>WhatsApp</strong> em breve.</p>
          <p className="mt-1 text-xs text-amber-600">O pagamento só será necessário após a realização do serviço.</p>
        </div>
      </div>
    );
  }

  // ── Progress bar ───────────────────────────────────────────────────
  const steps: Step[] = ["service", "datetime", "contact", "confirm"];
  const currentIdx = steps.indexOf(step);

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="flex gap-1.5">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= currentIdx ? "bg-brand" : "bg-slate-200"
            }`}
          />
        ))}
      </div>

      {/* ── Step 1: Escolher serviço ── */}
      {step === "service" && (
        <div className="space-y-3">
          <h2 className="font-bold text-slate-900">Escolha o serviço</h2>
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSelectedService(s); setSelectedDate(""); setSelectedTime(""); setStep("datetime"); }}
              className="card w-full text-left py-4 flex items-center justify-between hover:border-brand transition-colors"
            >
              <div>
                <p className="font-semibold text-slate-900">{s.name}</p>
                <p className="text-sm text-slate-500">{s.duration_minutes} minutos</p>
              </div>
              <span className="text-brand font-bold text-lg">{formatBRL(s.price_cents)}</span>
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
            <select
              className="input"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
            >
              <option value="">Selecione uma data</option>
              {availableDates.map((d) => {
                const [y, m, day] = d.split("-");
                const weekday = new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short" });
                return (
                  <option key={d} value={d}>
                    {weekday.charAt(0).toUpperCase() + weekday.slice(1, -1)}. {day}/{m}/{y}
                  </option>
                );
              })}
            </select>
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
                      className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                        selectedTime === t
                          ? "bg-brand text-white border-brand"
                          : "border-slate-200 text-slate-700 hover:border-brand hover:text-brand"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            className="btn-primary w-full"
            disabled={!selectedDate || !selectedTime}
            onClick={() => setStep("contact")}
          >
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
            <input
              className="input"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="(11) 99999-8888"
              inputMode="tel"
            />
            <p className="text-xs text-slate-400 mt-1">A confirmação chegará aqui.</p>
          </div>
          <button
            className="btn-primary w-full"
            disabled={!clientName || !clientPhone}
            onClick={() => setStep("confirm")}
          >
            Revisar agendamento →
          </button>
        </div>
      )}

      {/* ── Step 4: Confirmar ── */}
      {step === "confirm" && selectedService && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setStep("contact")} className="text-slate-400 hover:text-slate-600 text-xl">←</button>
            <h2 className="font-bold text-slate-900">Confirmar agendamento</h2>
          </div>
          <div className="card space-y-2.5 py-4">
            <Row label="Serviço" value={selectedService.name} />
            <Row label="Data" value={formatDate(selectedDate)} />
            <Row label="Horário" value={selectedTime} />
            <Row label="Nome" value={clientName} />
            <Row label="WhatsApp" value={clientPhone} />
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-sm text-slate-500">Valor do serviço</span>
              <span className="font-bold text-slate-900">{formatBRL(selectedService.price_cents)}</span>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
            💬 O pagamento é feito <strong>após o serviço</strong>, diretamente com o profissional via Pix.
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
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}
