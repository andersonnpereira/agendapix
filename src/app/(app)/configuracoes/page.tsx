"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import {
  generatePixBRCode,
  validatePixKey,
  normalizePixKey,
  type PixKeyType,
} from "@/lib/pix";
import { PixDisplay } from "@/components/PixDisplay";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { slugify } from "@/lib/format";

const KEY_TYPES: { value: PixKeyType; label: string }[] = [
  { value: "celular", label: "Celular" },
  { value: "email", label: "E-mail" },
  { value: "cpf_cnpj", label: "CPF / CNPJ" },
  { value: "aleatoria", label: "Chave aleatória" },
];

const WA_PROVIDERS = [
  { value: "mock", label: "Nenhum (modo teste)" },
  { value: "zapi", label: "Z-API" },
  { value: "evolution", label: "Evolution API" },
  { value: "ultramsg", label: "Ultramsg" },
];

export default function ConfiguracoesPage() {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Perfil
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [slug, setSlug] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");

  // Pix
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("celular");
  const [pixMerchantName, setPixMerchantName] = useState("");
  const [pixMerchantCity, setPixMerchantCity] = useState("");
  const [pixError, setPixError] = useState("");

  // WhatsApp
  const [waProvider, setWaProvider] = useState("mock");
  const [waToken, setWaToken] = useState("");
  const [waInstanceId, setWaInstanceId] = useState("");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (!p) return;
      setName(p.name || "");
      setBusinessName(p.business_name || "");
      setPhone(p.phone || "");
      setSlug(p.slug || "");
      setNotificationEmail(p.notification_email || user.email || "");
      setPixKey(p.pix_key || "");
      setPixKeyType((p.pix_key_type as PixKeyType) || "celular");
      setPixMerchantName(p.pix_merchant_name || "");
      setPixMerchantCity(p.pix_merchant_city || "");
      setWaProvider(p.whatsapp_provider || "mock");
      setWaToken(p.whatsapp_token || "");
      setWaInstanceId(p.whatsapp_instance_id || "");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prévia do Pix ao vivo
  let pixPreview = "";
  if (pixKey && pixMerchantName && pixMerchantCity) {
    const v = validatePixKey(pixKey, pixKeyType);
    if (v.valid) {
      try {
        pixPreview = generatePixBRCode({
          pixKey: normalizePixKey(pixKey, pixKeyType),
          amount: 1,
          merchantName: pixMerchantName,
          merchantCity: pixMerchantCity,
          txid: "TESTE",
        });
      } catch {
        pixPreview = "";
      }
    }
  }

  async function save() {
    setError("");
    setSaved(false);

    if (pixKey) {
      const v = validatePixKey(pixKey, pixKeyType);
      if (!v.valid) {
        setPixError(v.message || "Chave inválida.");
        return;
      }
      setPixError("");
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error: uErr } = await supabase
      .from("profiles")
      .update({
        name,
        business_name: businessName,
        phone,
        slug: slug ? slugify(slug) : undefined,
        notification_email: notificationEmail,
        pix_key: pixKey ? normalizePixKey(pixKey, pixKeyType) : null,
        pix_key_type: pixKeyType,
        pix_merchant_name: pixMerchantName,
        pix_merchant_city: pixMerchantCity,
        whatsapp_provider: waProvider,
        whatsapp_token: waToken || null,
        whatsapp_instance_id: waInstanceId || null,
      })
      .eq("id", user.id);

    setSaving(false);
    if (uErr) {
      setError(uErr.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  const publicLink = slug ? `${siteUrl}/agendar/${slugify(slug)}` : "";

  return (
    <div className="space-y-6 pb-4">
      <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>

      {/* Link público */}
      {publicLink && (
        <div className="card bg-brand-light border-brand/20">
          <p className="text-sm font-medium text-brand-dark mb-2">
            Seu link de agendamento
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={publicLink}
              className="input text-sm bg-white flex-1 truncate"
            />
            <CopyLinkButton text={publicLink} />
          </div>
        </div>
      )}

      {/* Perfil */}
      <section className="card space-y-4">
        <h2 className="font-semibold text-slate-900">Perfil</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Seu nome</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ana Souza" />
          </div>
          <div>
            <label className="label">Nome do negócio</label>
            <input className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Studio da Ana" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">WhatsApp</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-8888" inputMode="tel" />
          </div>
          <div>
            <label className="label">Link (slug)</label>
            <input
              className="input"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="studio-da-ana"
            />
          </div>
        </div>
        <div>
          <label className="label">E-mail para alertas de agendamento</label>
          <input className="input" type="email" value={notificationEmail} onChange={(e) => setNotificationEmail(e.target.value)} placeholder="seu@email.com" />
          <p className="text-xs text-slate-400 mt-1">Você receberá um e-mail quando um cliente agendar.</p>
        </div>
        <Link href="/disponibilidade" className="btn-ghost text-sm inline-block text-center">
          ⏰ Gerenciar horários de atendimento →
        </Link>
      </section>

      {/* Chave Pix */}
      <section className="card space-y-4">
        <h2 className="font-semibold text-slate-900">Chave Pix</h2>
        <div>
          <label className="label">Tipo de chave</label>
          <select
            className="input"
            value={pixKeyType}
            onChange={(e) => setPixKeyType(e.target.value as PixKeyType)}
          >
            {KEY_TYPES.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Chave Pix</label>
          <input
            className="input"
            value={pixKey}
            onChange={(e) => { setPixKey(e.target.value); setPixError(""); }}
            placeholder={pixKeyType === "celular" ? "(11) 99999-8888" : pixKeyType === "email" ? "seu@email.com" : pixKeyType === "cpf_cnpj" ? "000.000.000-00" : "UUID aleatório"}
          />
          {pixError && <p className="text-xs text-red-500 mt-1">{pixError}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Nome do recebedor</label>
            <input className="input" value={pixMerchantName} onChange={(e) => setPixMerchantName(e.target.value)} placeholder="ANA SOUZA" />
          </div>
          <div>
            <label className="label">Cidade</label>
            <input className="input" value={pixMerchantCity} onChange={(e) => setPixMerchantCity(e.target.value)} placeholder="SAO PAULO" />
          </div>
        </div>
        {pixPreview && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-3 text-center">Prévia — código de teste (R$ 1,00)</p>
            <PixDisplay payload={pixPreview} />
          </div>
        )}
      </section>

      {/* WhatsApp API */}
      <section className="card space-y-4">
        <h2 className="font-semibold text-slate-900">WhatsApp Automático</h2>
        <p className="text-sm text-slate-500">
          Configure para que a confirmação de agendamento seja enviada automaticamente ao cliente.
        </p>
        <div>
          <label className="label">Provedor</label>
          <select className="input" value={waProvider} onChange={(e) => setWaProvider(e.target.value)}>
            {WA_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        {waProvider !== "mock" && (
          <>
            <div>
              <label className="label">ID da instância</label>
              <input className="input" value={waInstanceId} onChange={(e) => setWaInstanceId(e.target.value)} placeholder="Ex: 3D1234..." />
            </div>
            <div>
              <label className="label">Token</label>
              <input className="input" type="password" value={waToken} onChange={(e) => setWaToken(e.target.value)} placeholder="Seu token da API" />
            </div>
            <p className="text-xs text-slate-400">
              {waProvider === "zapi" && "Z-API: Dashboard > Instâncias > Copiar Token. Também defina ZAPI_CLIENT_TOKEN no .env."}
              {waProvider === "evolution" && "Evolution API: informe o nome da instância e a apikey global. Defina EVOLUTION_API_URL no .env."}
              {waProvider === "ultramsg" && "Ultramsg: Dashboard > Instance ID e Token."}
            </p>
          </>
        )}
        {waProvider === "mock" && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">
            Modo teste: as mensagens serão apenas registradas no log do servidor. Nenhum WhatsApp será enviado.
          </p>
        )}
      </section>

      {error && <p className="text-sm text-red-600 text-center">{error}</p>}

      <button
        className="btn-primary w-full"
        onClick={save}
        disabled={saving}
      >
        {saving ? "Salvando..." : saved ? "✓ Salvo!" : "Salvar configurações"}
      </button>
    </div>
  );
}
