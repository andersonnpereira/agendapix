"use client";

import { useState } from "react";

type Props = {
  bookingId: string;
  token: string;
  status: string;
  clientName: string;
};

export default function CancelForm({ bookingId, token, status, clientName }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(status === "cancelado");
  const [error, setError] = useState("");

  if (status === "concluido") {
    return (
      <div className="text-center space-y-2">
        <p className="text-2xl">✅</p>
        <p className="font-semibold text-slate-900">Atendimento já concluído</p>
        <p className="text-sm text-slate-500">Este agendamento já foi realizado e não pode ser cancelado.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto text-3xl">❌</div>
        <p className="font-semibold text-slate-900">Agendamento cancelado</p>
        <p className="text-sm text-slate-500">Seu agendamento foi cancelado com sucesso, {clientName}.</p>
      </div>
    );
  }

  async function handleCancel() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/cancelar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, token }),
      });
      if (res.ok) {
        setDone(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Erro ao cancelar. Tente novamente.");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 text-center">
        Tem certeza que deseja cancelar este agendamento, <strong>{clientName}</strong>?
      </p>
      {error && <p className="text-sm text-red-500 text-center">{error}</p>}
      <button
        onClick={handleCancel}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors disabled:opacity-60"
      >
        {loading ? "Cancelando..." : "Confirmar cancelamento"}
      </button>
      <p className="text-xs text-slate-400 text-center">Esta ação não pode ser desfeita.</p>
    </div>
  );
}
