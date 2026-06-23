"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) {
        setMsg(error.message);
        setLoading(false);
        return;
      }
      // tenta logar direto (caso confirmação de email esteja desligada)
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInErr) {
        setMsg("Conta criada! Confirme seu e-mail para entrar.");
        setLoading(false);
        return;
      }
      router.push("/onboarding");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
  }

  async function magicLink() {
    if (!email) {
      setMsg("Digite seu e-mail primeiro.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/dashboard`,
      },
    });
    setLoading(false);
    setMsg(error ? error.message : "Link de acesso enviado para seu e-mail!");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="block text-center text-xl font-bold text-brand mb-6">
          Agendou
        </Link>
        <div className="card">
          <h1 className="text-xl font-bold text-slate-900 mb-1">
            {mode === "login" ? "Entrar" : "Criar conta"}
          </h1>
          <p className="text-sm text-slate-500 mb-5">
            {mode === "login"
              ? "Acesse sua agenda e cobranças."
              : "Comece a receber agendamentos hoje."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className="label">Seu nome</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Ana Souza"
                />
              </div>
            )}
            <div>
              <label className="label">E-mail</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                required
              />
            </div>
            <div>
              <label className="label">Senha</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {msg && (
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                {msg}
              </p>
            )}

            <button className="btn-primary w-full" disabled={loading}>
              {loading
                ? "Aguarde..."
                : mode === "login"
                ? "Entrar"
                : "Criar conta"}
            </button>
          </form>

          <button
            onClick={magicLink}
            disabled={loading}
            className="btn-ghost w-full mt-3 text-sm"
          >
            Entrar com link mágico (sem senha)
          </button>

          <p className="text-center text-sm text-slate-500 mt-5">
            {mode === "login" ? "Não tem conta?" : "Já tem conta?"}{" "}
            <button
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setMsg(null);
              }}
              className="text-brand font-semibold"
            >
              {mode === "login" ? "Criar conta" : "Entrar"}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
