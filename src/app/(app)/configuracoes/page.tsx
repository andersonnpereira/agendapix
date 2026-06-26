"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import {
  validatePixKey,
  normalizePixKey,
  type PixKeyType,
} from "@/lib/pix";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { slugify } from "@/lib/format";
import { DEFAULT_MSG_CONFIRMACAO, DEFAULT_MSG_PIX, DEFAULT_MSG_LEMBRETE } from "@/lib/whatsapp";

const KEY_TYPES: { value: PixKeyType; label: string }[] = [
  { value: "celular", label: "Celular" },
  { value: "email", label: "E-mail" },
  { value: "cpf_cnpj", label: "CPF / CNPJ" },
  { value: "aleatoria", label: "Chave aleatória" },
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
  const [originalSlug, setOriginalSlug] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");

  // Pix
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("celular");
  const [pixMerchantName, setPixMerchantName] = useState("");
  const [pixMerchantCity, setPixMerchantCity] = useState("");
  const [pixError, setPixError] = useState("");


  // Link de pagamento externo
  const [paymentLink, setPaymentLink] = useState("");

  // Mensagens customizadas
  const [msgConfirmacao, setMsgConfirmacao] = useState("");
  const [msgPix, setMsgPix] = useState("");
  const [msgLembrete, setMsgLembrete] = useState("");

  // Identidade visual
  const [brandColor, setBrandColor] = useState("#16A34A");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [reviewLink, setReviewLink] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Lembretes
  const [reminderHour, setReminderHour] = useState(8);

  // Regras de agendamento
  const [minNoticeHours, setMinNoticeHours] = useState(1);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(60);
  const [dailyLimit, setDailyLimit] = useState("");
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [cancelMinHours, setCancelMinHours] = useState(0);

  // QR Code WhatsApp
  const [qrStatus, setQrStatus] = useState<"idle" | "loading" | "connected" | "disconnected">("loading");
  const [qrBase64, setQrBase64] = useState("");
  const [qrError, setQrError] = useState("");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  async function uploadLogo(file: File) {
    setUploadingLogo(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploadingLogo(false); return; }
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      setError("Erro no upload: " + uploadError.message + ". Confirme que o bucket 'avatars' existe no Supabase Storage (público).");
      setUploadingLogo(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", user.id);
    setAvatarUrl(urlData.publicUrl);
    setUploadingLogo(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function removeLogo() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
    setAvatarUrl("");
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const fetchQrRef = useRef(fetchQr);
  useEffect(() => { fetchQrRef.current = fetchQr; });
  // Auto-refresh a cada 30s enquanto desconectado
  useEffect(() => {
    if (qrStatus !== "disconnected") return;
    const interval = setInterval(() => fetchQrRef.current(), 30000);
    return () => clearInterval(interval);
  }, [qrStatus]);

  async function fetchQr() {
    setQrStatus("loading");
    setQrError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setQrStatus("idle"); return; }
    try {
      const res = await fetch("/api/whatsapp-qr", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.status === "connected") {
        setQrStatus("connected");
        setQrBase64("");
      } else if (data.status === "disconnected") {
        setQrStatus("disconnected");
        setQrBase64(data.qr || "");
      } else {
        setQrError(data.error || "Erro ao carregar QR code.");
        setQrStatus("idle");
      }
    } catch {
      setQrError("Erro de conexão.");
      setQrStatus("idle");
    }
  }

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
      setOriginalSlug(p.slug || "");
      setNotificationEmail(p.notification_email || user.email || "");
      setPixKey(p.pix_key || "");
      setPixKeyType((p.pix_key_type as PixKeyType) || "celular");
      setPixMerchantName(p.pix_merchant_name || "");
      setPixMerchantCity(p.pix_merchant_city || "");
      setPaymentLink(p.payment_link || "");
      setMsgConfirmacao(p.msg_confirmacao || DEFAULT_MSG_CONFIRMACAO);
      setMsgPix(p.msg_pix || DEFAULT_MSG_PIX);
      setMsgLembrete(p.msg_lembrete || DEFAULT_MSG_LEMBRETE);
      setBrandColor(p.brand_color || "#16A34A");
      setAvatarUrl(p.avatar_url || "");
      setBio(p.bio || "");
      setReviewLink(p.review_link || "");
      setCoverUrl(p.cover_url || "");
      setReminderHour(p.reminder_hour ?? 8);
      setMinNoticeHours(p.min_notice_hours ?? 1);
      setMaxAdvanceDays(p.max_advance_days ?? 60);
      setDailyLimit(p.daily_booking_limit != null ? String(p.daily_booking_limit) : "");
      setBufferMinutes(p.booking_buffer_minutes ?? 0);
      setAutoConfirm(p.auto_confirm ?? false);
      setCancelMinHours(p.cancel_min_hours ?? 0);
    })();
    fetchQr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        whatsapp_provider: "evolution",
        payment_link: paymentLink || null,
        msg_confirmacao: msgConfirmacao || null,
        msg_pix: msgPix || null,
        msg_lembrete: msgLembrete || null,
        brand_color: brandColor || null,
        bio: bio.trim() || null,
        review_link: reviewLink.trim() || null,
        cover_url: coverUrl.trim() || null,
        reminder_hour: reminderHour,
        min_notice_hours: minNoticeHours,
        max_advance_days: maxAdvanceDays,
        daily_booking_limit: dailyLimit !== "" ? parseInt(dailyLimit) : null,
        booking_buffer_minutes: bufferMinutes,
        auto_confirm: autoConfirm,
        cancel_min_hours: cancelMinHours,
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
            {originalSlug && slug && slugify(slug) !== originalSlug && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 mt-1.5">
                ⚠️ Ao salvar, o link antigo <strong>/agendar/{originalSlug}</strong> para de funcionar. Clientes com o link salvo não conseguirão agendar.
              </p>
            )}
          </div>
        </div>
        <div>
          <label className="label">E-mail para alertas de agendamento</label>
          <input className="input" type="email" value={notificationEmail} onChange={(e) => setNotificationEmail(e.target.value)} placeholder="seu@email.com" />
          <p className="text-xs text-slate-400 mt-1">Você receberá um e-mail quando um cliente agendar.</p>
        </div>
        <div>
          <label className="label">Bio / Descrição do negócio</label>
          <textarea
            className="input resize-none text-sm"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Ex: Especialista em coloração, 10 anos de experiência. Atendo com hora marcada em espaço exclusivo."
          />
          <p className="text-xs text-slate-400 mt-1">Exibida no seu link público de agendamento.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/servicos" className="btn-ghost text-sm text-center">
            ✂️ Serviços →
          </Link>
          <Link href="/disponibilidade" className="btn-ghost text-sm text-center">
            ⏰ Horários →
          </Link>
        </div>
      </section>

      {/* Identidade visual */}
      <section className="card space-y-5">
        <h2 className="font-semibold text-slate-900">Identidade visual</h2>

        {/* Logo */}
        <div>
          <label className="label">Logo / Foto de perfil</label>
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Logo" className="w-16 h-16 rounded-full object-cover border-2 border-white shadow shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-brand-light flex items-center justify-center text-2xl shrink-0">✂️</div>
            )}
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <label className={`btn text-sm border border-slate-200 cursor-pointer inline-flex items-center gap-1.5 ${uploadingLogo ? "opacity-50 pointer-events-none" : ""}`}>
                  {uploadingLogo ? "Enviando..." : "📷 Escolher imagem"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }}
                  />
                </label>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="text-xs text-red-500 hover:text-red-700 underline"
                  >
                    Remover
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400">Aparece no seu link de agendamento público. JPG/PNG.</p>
            </div>
          </div>
        </div>

        {/* Cor principal */}
        <div>
          <label className="label">Cor principal</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
            />
            <span className="text-sm font-mono text-slate-700">{brandColor.toUpperCase()}</span>
            <button
              type="button"
              onClick={() => setBrandColor("#16A34A")}
              className="text-xs text-brand underline"
            >
              Padrão
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">Cor de destaque no seu link de agendamento. Salve para aplicar.</p>
        </div>

        <div>
          <label className="label">URL da imagem de capa</label>
          <input
            className="input"
            type="url"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="https://... (link direto de uma imagem para o banner)"
          />
          <p className="text-xs text-slate-400 mt-1">Banner exibido no topo da sua página pública.</p>
        </div>
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
      </section>

      {/* Conexão WhatsApp */}
      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">WhatsApp Automático</h2>
            <p className="text-xs text-slate-400 mt-0.5">Conecte seu WhatsApp para enviar mensagens automáticas aos clientes.</p>
          </div>
          {qrStatus === "connected" && (
            <span className="text-xs bg-green-100 text-green-700 font-semibold px-2.5 py-1 rounded-full shrink-0">● Conectado</span>
          )}
          {qrStatus === "disconnected" && (
            <span className="text-xs bg-red-100 text-red-600 font-semibold px-2.5 py-1 rounded-full shrink-0">● Desconectado</span>
          )}
        </div>

        {qrStatus === "loading" && (
          <p className="text-sm text-slate-400 text-center py-4">Carregando...</p>
        )}

        {qrStatus === "idle" && qrError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 space-y-2">
            <p>{qrError}</p>
            <button className="text-xs underline text-red-600" onClick={fetchQr}>Tentar novamente</button>
          </div>
        )}

        {qrStatus === "connected" && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 text-center space-y-2">
            <p className="text-2xl">✅</p>
            <p className="font-semibold">WhatsApp conectado!</p>
            <p>As mensagens serão enviadas automaticamente.</p>
            <button className="text-xs text-green-600 underline mt-1" onClick={fetchQr}>
              Verificar novamente
            </button>
          </div>
        )}

        {qrStatus === "disconnected" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 text-center">
              Abra o <strong>WhatsApp</strong> → <strong>Aparelhos conectados</strong> → escaneie o QR:
            </p>
            {qrBase64 ? (
              <div className="flex justify-center">
                <img
                  src={qrBase64}
                  alt="QR Code WhatsApp"
                  className="w-56 h-56 rounded-2xl border-2 border-brand/20 shadow-md"
                />
              </div>
            ) : (
              <p className="text-sm text-red-500 text-center">Erro ao gerar QR code.</p>
            )}
            <p className="text-xs text-slate-400 text-center">Atualiza automaticamente a cada 5 segundos.</p>
            <button className="btn text-sm w-full border border-slate-200" onClick={fetchQr}>
              ↺ Atualizar agora
            </button>
          </div>
        )}
      </section>

      {/* Link de pagamento */}
      <section className="card space-y-4">
        <div>
          <h2 className="font-semibold text-slate-900">Link de pagamento</h2>
          <p className="text-xs text-slate-400 mt-1">Cole aqui um link externo (Mercado Pago, PicPay, etc.) para incluir nas cobranças pelo WhatsApp.</p>
        </div>
        <div>
          <label className="label">Link</label>
          <input
            className="input"
            type="url"
            value={paymentLink}
            onChange={(e) => setPaymentLink(e.target.value)}
            placeholder="https://mpago.la/seu-link ou https://picpay.me/seunome"
          />
          {paymentLink && (
            <p className="text-xs text-brand mt-1">✓ Link configurado — aparecerá como opção ao enviar cobranças</p>
          )}
        </div>
      </section>

      {/* Link de avaliação */}
      <section className="card space-y-4">
        <div>
          <h2 className="font-semibold text-slate-900">Link de avaliação</h2>
          <p className="text-xs text-slate-400 mt-1">Cole o link do Google Meu Negócio, Reclame Aqui, Instagram ou onde preferir receber avaliações dos clientes.</p>
        </div>
        <div>
          <label className="label">Link</label>
          <input
            className="input"
            type="url"
            value={reviewLink}
            onChange={(e) => setReviewLink(e.target.value)}
            placeholder="https://g.page/r/seu-negocio/review"
          />
          {reviewLink && (
            <p className="text-xs text-brand mt-1">✓ Configurado — botão "⭐ Pedir avaliação" aparece na Agenda e página pública</p>
          )}
        </div>
      </section>

      {/* Mensagens customizadas */}
      <section className="card space-y-5">
        <div>
          <h2 className="font-semibold text-slate-900">Mensagens WhatsApp</h2>
          <p className="text-xs text-slate-400 mt-1">Edite o texto e use as variáveis destacadas para personalizar cada mensagem.</p>
        </div>

        {/* Confirmação */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="label mb-0">✅ Confirmação de agendamento</label>
            <button
              type="button"
              className="text-xs text-brand underline"
              onClick={() => setMsgConfirmacao(DEFAULT_MSG_CONFIRMACAO)}
            >
              Restaurar padrão
            </button>
          </div>
          <textarea
            className="input resize-none text-sm font-mono leading-relaxed"
            rows={5}
            value={msgConfirmacao}
            onChange={(e) => setMsgConfirmacao(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {["{nome}", "{servico}", "{data}", "{horario}", "{negocio}"].map((v) => (
              <button
                key={v}
                type="button"
                className="text-xs bg-brand-light text-brand-dark font-mono px-2 py-0.5 rounded-md hover:bg-brand hover:text-white transition-colors"
                onClick={() => setMsgConfirmacao((prev) => prev + v)}
                title={`Inserir ${v}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Pix */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="label mb-0">💳 Envio de cobrança Pix</label>
            <button
              type="button"
              className="text-xs text-brand underline"
              onClick={() => setMsgPix(DEFAULT_MSG_PIX)}
            >
              Restaurar padrão
            </button>
          </div>
          <textarea
            className="input resize-none text-sm font-mono leading-relaxed"
            rows={5}
            value={msgPix}
            onChange={(e) => setMsgPix(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {["{nome}", "{servico}", "{valor}", "{pix}"].map((v) => (
              <button
                key={v}
                type="button"
                className="text-xs bg-brand-light text-brand-dark font-mono px-2 py-0.5 rounded-md hover:bg-brand hover:text-white transition-colors"
                onClick={() => setMsgPix((prev) => prev + v)}
                title={`Inserir ${v}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Lembrete */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="label mb-0">🔔 Lembrete de pagamento</label>
            <button
              type="button"
              className="text-xs text-brand underline"
              onClick={() => setMsgLembrete(DEFAULT_MSG_LEMBRETE)}
            >
              Restaurar padrão
            </button>
          </div>
          <textarea
            className="input resize-none text-sm font-mono leading-relaxed"
            rows={5}
            value={msgLembrete}
            onChange={(e) => setMsgLembrete(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {["{nome}", "{servico}", "{valor}", "{pix}", "{data}"].map((v) => (
              <button
                key={v}
                type="button"
                className="text-xs bg-brand-light text-brand-dark font-mono px-2 py-0.5 rounded-md hover:bg-brand hover:text-white transition-colors"
                onClick={() => setMsgLembrete((prev) => prev + v)}
                title={`Inserir ${v}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </section>


      {/* Regras de agendamento */}
      <section className="card space-y-5">
        <div>
          <h2 className="font-semibold text-slate-900">Regras de agendamento</h2>
          <p className="text-xs text-slate-400 mt-1">Controle como e quando os clientes podem agendar.</p>
        </div>

        <div>
          <label className="label">Horário do lembrete automático</label>
          <select
            className="input"
            value={reminderHour}
            onChange={(e) => setReminderHour(parseInt(e.target.value))}
          >
            {[6, 7, 8, 9, 10, 11, 12].map((h) => (
              <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">
            Horário (BRT) em que o lembrete de amanhã será enviado ao cliente
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Antecedência mínima (h)</label>
            <input type="number" min={0} max={72} className="input" value={minNoticeHours}
              onChange={(e) => setMinNoticeHours(Math.max(0, parseInt(e.target.value) || 0))} />
            <p className="text-xs text-slate-400 mt-1">Horas antes do horário</p>
          </div>
          <div>
            <label className="label">Máx. dias à frente</label>
            <input type="number" min={1} max={365} className="input" value={maxAdvanceDays}
              onChange={(e) => setMaxAdvanceDays(Math.max(1, parseInt(e.target.value) || 30))} />
            <p className="text-xs text-slate-400 mt-1">Até X dias no futuro</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Limite por dia</label>
            <input type="number" min={1} max={100} className="input" value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)} placeholder="Ilimitado" />
            <p className="text-xs text-slate-400 mt-1">Vazio = ilimitado</p>
          </div>
          <div>
            <label className="label">Buffer (min)</label>
            <input type="number" min={0} max={120} step={5} className="input" value={bufferMinutes}
              onChange={(e) => setBufferMinutes(Math.max(0, parseInt(e.target.value) || 0))} />
            <p className="text-xs text-slate-400 mt-1">Intervalo entre atend.</p>
          </div>
        </div>

        <div>
          <label className="label">Prazo mínimo p/ cliente cancelar (h)</label>
          <input type="number" min={0} max={72} className="input" value={cancelMinHours}
            onChange={(e) => setCancelMinHours(Math.max(0, parseInt(e.target.value) || 0))} />
          <p className="text-xs text-slate-400 mt-1">0 = cliente pode cancelar a qualquer momento</p>
        </div>

        <div className="flex items-center justify-between py-3 border-t border-slate-100">
          <div>
            <p className="text-sm font-medium text-slate-900">Confirmação automática</p>
            <p className="text-xs text-slate-400">Novos agendamentos ficam confirmados sem revisão manual</p>
          </div>
          <button type="button" onClick={() => setAutoConfirm((v) => !v)}
            className={`relative w-12 h-6 rounded-full transition-colors ${autoConfirm ? "bg-brand" : "bg-slate-300"}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${autoConfirm ? "right-0.5" : "left-0.5"}`} />
          </button>
        </div>
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
