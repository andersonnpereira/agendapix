"use client";

import { useState } from "react";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      setStatus(res.ok ? "ok" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "ok") {
    return (
      <div className="bg-brand-light border border-brand/20 rounded-2xl p-6 text-center space-y-2">
        <p className="text-3xl">✅</p>
        <p className="font-semibold text-brand-dark">Mensagem enviada!</p>
        <p className="text-sm text-slate-600">Recebemos sua mensagem e responderemos em breve.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Seu nome</label>
          <input
            className="input"
            placeholder="Ana Souza"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Seu e-mail</label>
          <input
            className="input"
            type="email"
            placeholder="ana@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <label className="label">Mensagem</label>
        <textarea
          className="input resize-none"
          rows={4}
          placeholder="Descreva sua dúvida ou problema..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
        />
      </div>
      {status === "error" && (
        <p className="text-sm text-red-500">Erro ao enviar. Tente novamente.</p>
      )}
      <button
        type="submit"
        className="btn-primary w-full"
        disabled={status === "sending"}
      >
        {status === "sending" ? "Enviando..." : "Enviar mensagem"}
      </button>
    </form>
  );
}
