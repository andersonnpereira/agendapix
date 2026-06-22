"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { slugify, parseToCents } from "@/lib/format";
import { validatePixKey, generatePixBRCode, normalizePixKey, type PixKeyType } from "@/lib/pix";
import { PixDisplay } from "@/components/PixDisplay";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // dados
  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [serviceDuration, setServiceDuration] = useState("60");

  const [pixKey, setPixKey] = useState("");
  const [pixType, setPixType] = useState<PixKeyType>("celular");
  const [merchantName, setMerchantName] = useState("");
  const [merchantCity, setMerchantCity] = useState("");

  const previewCode =
    pixKey && merchantName && merchantCity
      ? generatePixBRCode({
          pixKey: normalizePixKey(pixKey, pixType),
          amount: parseToCents(servicePrice || "0") / 100 || 1,
          merchantName,
          merchantCity,
          txid: "TESTE",
        })
      : "";

  async function finish() {
    setError(null);
    const keyCheck = validatePixKey(pixKey, pixType);
    if (!keyCheck.valid) {
      setError(keyCheck.message || "Chave Pix inválida.");
      return;
    }
    if (!merchantName || !merchantCity) {
      setError("Preencha o nome e a cidade do recebedor.");
      return;
    }
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const finalSlug = slug || slugify(businessName) || `pro-${user.id.slice(0, 6)}`;

    // 1. atualiza profile
    const { error: pErr } = await supabase
      .from("profiles")
      .update({
        business_name: businessName,
        slug: finalSlug,
        pix_key: normalizePixKey(pixKey, pixType),
        pix_key_type: pixType,
        pix_merchant_name: merchantName,
        pix_merchant_city: merchantCity,
      })
      .eq("id", user.id);

    if (pErr) {
      setError(
        pErr.message.includes("duplicate")
          ? "Esse link já está em uso. Escolha outro."
          : pErr.message
      );
      setLoading(false);
      return;
    }

    // 2. cria primeiro serviço
    if (serviceName) {
      await supabase.from("services").insert({
        profile_id: user.id,
        name: serviceName,
        price_cents: parseToCents(servicePrice),
        duration_minutes: parseInt(serviceDuration) || 60,
      });
    }

    // 3. disponibilidade padrão seg-sex 9h-18h
    const blocks = [1, 2, 3, 4, 5].map((weekday) => ({
      profile_id: user.id,
      weekday,
      start_time: "09:00",
      end_time: "18:00",
    }));
    await supabase.from("availability").insert(blocks);

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen max-w-md mx-auto px-6 py-10">
      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full ${
              s <= step ? "bg-brand" : "bg-slate-200"
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">
            Vamos montar seu perfil
          </h1>
          <div>
            <label className="label">Nome do seu negócio</label>
            <input
              className="input"
              value={businessName}
              onChange={(e) => {
                setBusinessName(e.target.value);
                setSlug(slugify(e.target.value));
              }}
              placeholder="Ex: Studio da Ana"
            />
          </div>
          <div>
            <label className="label">Seu link público</label>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-slate-400">/agendar/</span>
              <input
                className="input flex-1"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="studio-da-ana"
              />
            </div>
          </div>
          <button
            className="btn-primary w-full"
            onClick={() => businessName && setStep(2)}
            disabled={!businessName}
          >
            Continuar
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">
            Seu primeiro serviço
          </h1>
          <div>
            <label className="label">Nome do serviço</label>
            <input
              className="input"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="Ex: Manicure completa"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Preço (R$)</label>
              <input
                className="input"
                value={servicePrice}
                onChange={(e) => setServicePrice(e.target.value)}
                placeholder="49,90"
                inputMode="decimal"
              />
            </div>
            <div>
              <label className="label">Duração (min)</label>
              <input
                className="input"
                value={serviceDuration}
                onChange={(e) => setServiceDuration(e.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button className="btn-ghost flex-1" onClick={() => setStep(1)}>
              Voltar
            </button>
            <button className="btn-primary flex-1" onClick={() => setStep(3)}>
              Continuar
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Sua chave Pix</h1>
          <p className="text-sm text-slate-500">
            O pagamento cai direto na sua conta. A gente só gera o código.
          </p>
          <div>
            <label className="label">Tipo de chave</label>
            <select
              className="input"
              value={pixType}
              onChange={(e) => setPixType(e.target.value as PixKeyType)}
            >
              <option value="celular">Celular</option>
              <option value="email">E-mail</option>
              <option value="cpf_cnpj">CPF / CNPJ</option>
              <option value="aleatoria">Aleatória</option>
            </select>
          </div>
          <div>
            <label className="label">Chave Pix</label>
            <input
              className="input"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder={
                pixType === "celular"
                  ? "(67) 99999-9999"
                  : pixType === "email"
                  ? "voce@email.com"
                  : pixType === "cpf_cnpj"
                  ? "000.000.000-00"
                  : "chave aleatória"
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nome do recebedor</label>
              <input
                className="input"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                placeholder="Ana Souza"
              />
            </div>
            <div>
              <label className="label">Cidade</label>
              <input
                className="input"
                value={merchantCity}
                onChange={(e) => setMerchantCity(e.target.value)}
                placeholder="Campo Grande"
              />
            </div>
          </div>

          {previewCode && (
            <div className="card bg-slate-50">
              <p className="text-sm font-medium text-slate-600 mb-3 text-center">
                Pré-visualização do seu Pix
              </p>
              <PixDisplay payload={previewCode} />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button className="btn-ghost flex-1" onClick={() => setStep(2)}>
              Voltar
            </button>
            <button
              className="btn-primary flex-1"
              onClick={finish}
              disabled={loading}
            >
              {loading ? "Salvando..." : "Concluir"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
