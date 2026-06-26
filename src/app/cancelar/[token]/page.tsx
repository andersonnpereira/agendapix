import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import CancelForm from "./CancelForm";

export const metadata: Metadata = { title: "Cancelar agendamento — Agendou" };
export const dynamic = "force-dynamic";

type Props = { params: { token: string } };

export default async function CancelarPage({ params }: Props) {
  const supabase = createClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, client_name, date, time, status, services(name), profiles(business_name, name)")
    .eq("cancel_token", params.token)
    .single();

  if (!booking) notFound();

  const svc = Array.isArray(booking.services)
    ? (booking.services[0] as { name: string } | undefined)?.name
    : (booking.services as { name: string } | null)?.name;

  const prof = Array.isArray(booking.profiles)
    ? (booking.profiles[0] as { business_name?: string; name?: string } | undefined)
    : (booking.profiles as { business_name?: string; name?: string } | null);

  const [y, m, d] = booking.date.split("-");
  const dateFormatted = `${d}/${m}/${y}`;

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 space-y-6">
        <div className="text-center">
          <div className="text-5xl mb-3">📅</div>
          <h1 className="text-xl font-bold text-slate-900">Cancelar agendamento</h1>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Serviço</span>
            <span className="font-medium">{svc || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Data</span>
            <span className="font-medium">{dateFormatted}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Horário</span>
            <span className="font-medium">{booking.time?.slice(0, 5)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Profissional</span>
            <span className="font-medium">{prof?.business_name || prof?.name || "—"}</span>
          </div>
        </div>

        <CancelForm
          bookingId={booking.id}
          token={params.token}
          status={booking.status}
          clientName={booking.client_name}
        />
      </div>
    </main>
  );
}
