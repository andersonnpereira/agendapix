"use client";

type Booking = {
  id: string;
  client_name: string;
  date: string;
  time: string;
  status: string;
  services: { name: string; duration_minutes: number } | null;
};

type Props = {
  bookings: Booking[];
  weekStart: string; // "YYYY-MM-DD" — Monday
  onPrev: () => void;
  onNext: () => void;
  onBookingClick: (b: Booking) => void;
};

const HOUR_START = 7;
const HOUR_END = 21;
const SLOT_PX = 48; // px per 30 min block
const TOTAL_SLOTS = (HOUR_END - HOUR_START) * 2; // 30-min slots

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const STATUS_COLORS: Record<string, string> = {
  pendente:   "bg-amber-100 border-amber-400 text-amber-800",
  confirmado: "bg-blue-100 border-blue-400 text-blue-800",
  concluido:  "bg-green-100 border-green-400 text-green-800",
  cancelado:  "bg-red-100 border-red-300 text-red-700 opacity-60",
};

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function getTodayBR(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeToSlot(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h - HOUR_START) * 2 + (m >= 30 ? 1 : 0);
}

export default function WeekCalendar({ bookings, weekStart, onPrev, onNext, onBookingClick }: Props) {
  const today = getTodayBR();

  // Build week days array (Mon–Sun)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Week label
  const weekLabel = (() => {
    const [y, m, d] = weekStart.split("-").map(Number);
    const end = addDays(weekStart, 6);
    const [ey, em, ed] = end.split("-").map(Number);
    const startLabel = new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    const endLabel = new Date(ey, em - 1, ed).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    return `${startLabel} – ${endLabel}`;
  })();

  // Group bookings by date
  const byDate = new Map<string, Booking[]>();
  for (const b of bookings) {
    if (!byDate.has(b.date)) byDate.set(b.date, []);
    byDate.get(b.date)!.push(b);
  }

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      {/* Header navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <button onClick={onPrev} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-500 text-lg">‹</button>
        <span className="text-sm font-semibold text-slate-700 capitalize">{weekLabel}</span>
        <button onClick={onNext} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-500 text-lg">›</button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="flex min-w-[560px]">
          {/* Time column */}
          <div className="w-10 shrink-0 border-r border-slate-100">
            <div className="h-10 border-b border-slate-100" /> {/* header spacer */}
            {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
              <div key={i} style={{ height: SLOT_PX * 2 }} className="border-b border-slate-100 flex items-start justify-end pr-1 pt-1">
                <span className="text-[10px] text-slate-400">{String(HOUR_START + i).padStart(2, "0")}h</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((date, di) => {
            const [, m, d] = date.split("-").map(Number);
            const isToday = date === today;
            const dayBookings = byDate.get(date) || [];

            return (
              <div key={date} className="flex-1 border-r border-slate-100 last:border-r-0 relative">
                {/* Day header */}
                <div className={`h-10 border-b border-slate-100 flex flex-col items-center justify-center ${isToday ? "bg-brand/5" : ""}`}>
                  <span className={`text-[10px] font-medium ${isToday ? "text-brand" : "text-slate-400"}`}>{DAY_LABELS[di]}</span>
                  <span className={`text-xs font-bold ${isToday ? "text-brand" : "text-slate-700"}`}>
                    {String(d).padStart(2, "0")}/{String(m).padStart(2, "0")}
                  </span>
                </div>

                {/* Hour slots background */}
                <div className="relative" style={{ height: TOTAL_SLOTS * SLOT_PX }}>
                  {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
                    <div
                      key={i}
                      style={{ height: SLOT_PX }}
                      className={`border-b ${i % 2 === 0 ? "border-slate-100" : "border-dashed border-slate-50"} ${isToday ? "bg-brand/[0.02]" : ""}`}
                    />
                  ))}

                  {/* Bookings */}
                  {dayBookings.map((b) => {
                    const slotIdx = timeToSlot(b.time);
                    if (slotIdx < 0 || slotIdx >= TOTAL_SLOTS) return null;
                    const duration = b.services?.duration_minutes || 60;
                    const heightSlots = Math.max(1, Math.ceil(duration / 30));
                    const top = slotIdx * SLOT_PX;
                    const height = heightSlots * SLOT_PX - 3;
                    const colorClass = STATUS_COLORS[b.status] || "bg-slate-100 border-slate-300 text-slate-700";

                    return (
                      <button
                        key={b.id}
                        onClick={() => onBookingClick(b)}
                        style={{ top, height, left: 2, right: 2 }}
                        className={`absolute rounded-md border-l-2 px-1.5 py-0.5 text-left overflow-hidden transition-opacity hover:opacity-80 ${colorClass}`}
                      >
                        <p className="text-[10px] font-semibold leading-tight truncate">{b.time.slice(0, 5)}</p>
                        <p className="text-[10px] leading-tight truncate">{b.client_name}</p>
                        {b.services?.name && (
                          <p className="text-[9px] leading-tight truncate opacity-70">{b.services.name}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
