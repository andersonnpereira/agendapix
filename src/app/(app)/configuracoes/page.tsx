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
import {
  DEFAULT_MSG_CONFIRMACAO,
  DEFAULT_MSG_PIX,
  DEFAULT_MSG_LEMBRETE,
  DEFAULT_MSG_LEMBRETE_HOJE,
  DEFAULT_MSG_LEMBRETE_AMANHA,
  DEFAULT_MSG_COBRANCA_VENCIDA,
} from "@/lib/whatsapp";
import { type BotMenuItem, type BotMenuAction, BOT_DEFAULTS, DEFAULT_MENU_ITEMS } from "@/lib/whatsapp-bot";

// Rodar no Supabase SQL Editor se as colunas ainda não existirem:
// ALTER TABLE public.profiles
//   ADD COLUMN IF NOT EXISTS msg_lembrete_hoje text,
//   ADD COLUMN IF NOT EXISTS msg_lembrete_amanha text,
//   ADD COLUMN IF NOT EXISTS msg_cobranca_vencida text,
//   ADD COLUMN IF NOT EXISTS bot_enabled boolean NOT NULL DEFAULT false;
//
// CREATE TABLE IF NOT EXISTS public.bot_conversations (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
//   phone text NOT NULL,
//   state text NOT NULL DEFAULT 'idle',
//   last_message_at timestamptz DEFAULT now(),
//   UNIQUE(profile_id, phone)
// );
// ALTER TABLE public.bot_conversations ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "bot_conv_service" ON public.bot_conversations
//   USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

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

  // Chatbot — básico
  const [botEnabled, setBotEnabled] = useState(false);
  const [userId, setUserId] = useState("");
  // Chatbot — avançado
  const [botWelcomeMessage, setBotWelcomeMessage] = useState(BOT_DEFAULTS.welcome);
  const [botMenuHeader, setBotMenuHeader] = useState(BOT_DEFAULTS.menuHeader);
  const [botFallbackMessage, setBotFallbackMessage] = useState(BOT_DEFAULTS.fallback);
  const [botFallbackMaxTries, setBotFallbackMaxTries] = useState(BOT_DEFAULTS.fallbackMaxTries);
  const [botTypingDelayMs, setBotTypingDelayMs] = useState(BOT_DEFAULTS.typingDelayMs);
  const [botSessionTimeoutMin, setBotSessionTimeoutMin] = useState(BOT_DEFAULTS.sessionTimeoutMin);
  const [botBusinessHoursEnabled, setBotBusinessHoursEnabled] = useState(false);
  const [botHoursStart, setBotHoursStart] = useState(8);
  const [botHoursEnd, setBotHoursEnd] = useState(18);
  const [botBusinessDays, setBotBusinessDays] = useState<string[]>(["seg","ter","qua","qui","sex"]);
  const [botAwayMessage, setBotAwayMessage] = useState(BOT_DEFAULTS.away);
  const [botHumanMessage, setBotHumanMessage] = useState(BOT_DEFAULTS.human);
  const [botNotifyPhone, setBotNotifyPhone] = useState("");
  const [botMenuItems, setBotMenuItems] = useState<BotMenuItem[]>(DEFAULT_MENU_ITEMS);

  // Mensagens customizadas
  const [msgConfirmacao, setMsgConfirmacao] = useState("");
  const [msgPix, setMsgPix] = useState("");
  const [msgLembrete, setMsgLembrete] = useState("");
  const [msgLembreteHoje, setMsgLembreteHoje] = useState("");
  const [msgLembreteAmanha, setMsgLembreteAmanha] = useState("");
  const [msgCobrancaVencida, setMsgCobrancaVencida] = useState("");

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
      setUserId(user.id);
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
      setMsgLembreteHoje((p as Record<string, unknown>).msg_lembrete_hoje as string || DEFAULT_MSG_LEMBRETE_HOJE);
      setMsgLembreteAmanha((p as Record<string, unknown>).msg_lembrete_amanha as string || DEFAULT_MSG_LEMBRETE_AMANHA);
      setMsgCobrancaVencida((p as Record<string, unknown>).msg_cobranca_vencida as string || DEFAULT_MSG_COBRANCA_VENCIDA);
      setBotEnabled((p as Record<string, unknown>).bot_enabled as boolean ?? false);
      setBotWelcomeMessage((p as Record<string, unknown>).bot_welcome_message as string || BOT_DEFAULTS.welcome);
      setBotMenuHeader((p as Record<string, unknown>).bot_menu_header as string || BOT_DEFAULTS.menuHeader);
      setBotFallbackMessage((p as Record<string, unknown>).bot_fallback_message as string || BOT_DEFAULTS.fallback);
      setBotFallbackMaxTries((p as Record<string, unknown>).bot_fallback_max_tries as number ?? BOT_DEFAULTS.fallbackMaxTries);
      setBotTypingDelayMs((p as Record<string, unknown>).bot_typing_delay_ms as number ?? BOT_DEFAULTS.typingDelayMs);
      setBotSessionTimeoutMin((p as Record<string, unknown>).bot_session_timeout_min as number ?? BOT_DEFAULTS.sessionTimeoutMin);
      setBotBusinessHoursEnabled((p as Record<string, unknown>).bot_business_hours_enabled as boolean ?? false);
      setBotHoursStart((p as Record<string, unknown>).bot_hours_start as number ?? 8);
      setBotHoursEnd((p as Record<string, unknown>).bot_hours_end as number ?? 18);
      setBotBusinessDays((p as Record<string, unknown>).bot_business_days as string[] || ["seg","ter","qua","qui","sex"]);
      setBotAwayMessage((p as Record<string, unknown>).bot_away_message as string || BOT_DEFAULTS.away);
      setBotHumanMessage((p as Record<string, unknown>).bot_human_message as string || BOT_DEFAULTS.human);
      setBotNotifyPhone((p as Record<string, unknown>).bot_notify_phone as string || "");
      const rawMenu = (p as Record<string, unknown>).bot_menu_items;
      setBotMenuItems(Array.isArray(rawMenu) && (rawMenu as BotMenuItem[]).length > 0 ? rawMenu as BotMenuItem[] : DEFAULT_MENU_ITEMS);
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
        msg_lembrete_hoje: msgLembreteHoje || null,
        msg_lembrete_amanha: msgLembreteAmanha || null,
        msg_cobranca_vencida: msgCobrancaVencida || null,
        bot_enabled: botEnabled,
        bot_welcome_message: botWelcomeMessage || null,
        bot_menu_header: botMenuHeader || null,
        bot_fallback_message: botFallbackMessage || null,
        bot_fallback_max_tries: botFallbackMaxTries,
        bot_typing_delay_ms: botTypingDelayMs,
        bot_session_timeout_min: botSessionTimeoutMin,
        bot_business_hours_enabled: botBusinessHoursEnabled,
        bot_hours_start: botHoursStart,
        bot_hours_end: botHoursEnd,
        bot_business_days: botBusinessDays,
        bot_away_message: botAwayMessage || null,
        bot_human_message: botHumanMessage || null,
        bot_notify_phone: botNotifyPhone.trim() || null,
        bot_menu_items: botMenuItems,
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
      return;
    }

    // Configura/remove webhook no Evolution API automaticamente (não bloqueia o save)
    fetch("/api/bot-webhook-setup", { method: "POST" }).catch(() => {});

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
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
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Mensagens WhatsApp</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Personalize cada mensagem enviada automaticamente. Clique nas variáveis para inserir no cursor.
          </p>
        </div>

        {/* 1 — Confirmação de agendamento */}
        <MsgCard
          icon="✅"
          title="Confirmação de agendamento"
          description="Enviada quando um novo agendamento é confirmado."
          value={msgConfirmacao}
          onChange={setMsgConfirmacao}
          onReset={() => setMsgConfirmacao(DEFAULT_MSG_CONFIRMACAO)}
          vars={["{nome}", "{servico}", "{data}", "{horario}", "{negocio}"]}
          varLabels={{ "{nome}": "Nome do cliente", "{servico}": "Serviço", "{data}": "Data", "{horario}": "Horário", "{negocio}": "Nome do negócio" }}
        />

        {/* 2 — Lembrete de agenda (amanhã) */}
        <MsgCard
          icon="📅"
          title="Lembrete de agenda — amanhã"
          description="Enviada automaticamente no dia anterior ao agendamento, no horário configurado em Regras."
          value={msgLembreteAmanha}
          onChange={setMsgLembreteAmanha}
          onReset={() => setMsgLembreteAmanha(DEFAULT_MSG_LEMBRETE_AMANHA)}
          vars={["{nome}", "{servico}", "{data}", "{horario}", "{negocio}"]}
          varLabels={{ "{nome}": "Nome do cliente", "{servico}": "Serviço", "{data}": "Data", "{horario}": "Horário", "{negocio}": "Nome do negócio" }}
        />

        {/* 3 — Envio de cobrança Pix */}
        <MsgCard
          icon="💳"
          title="Envio de cobrança Pix"
          description="Enviada ao clicar em 'Enviar cobrança' na tela de Cobranças."
          value={msgPix}
          onChange={setMsgPix}
          onReset={() => setMsgPix(DEFAULT_MSG_PIX)}
          vars={["{nome}", "{servico}", "{valor}", "{pix}"]}
          varLabels={{ "{nome}": "Nome do cliente", "{servico}": "Serviço", "{valor}": "Valor (R$)", "{pix}": "Chave Pix" }}
        />

        {/* 4 — Lembrete de pagamento agendado */}
        <MsgCard
          icon="🔔"
          title="Lembrete de pagamento"
          description="Enviada ao clicar em 'Lembrete' ou pelo automático (inclui 1 dia antes do vencimento e envios antecipados)."
          value={msgLembrete}
          onChange={setMsgLembrete}
          onReset={() => setMsgLembrete(DEFAULT_MSG_LEMBRETE)}
          vars={["{nome}", "{servico}", "{valor}", "{pix}", "{data}"]}
          varLabels={{ "{nome}": "Nome do cliente", "{servico}": "Serviço", "{valor}": "Valor (R$)", "{pix}": "Chave Pix", "{data}": "Vencimento" }}
        />

        {/* 5 — Cobrança vence hoje */}
        <MsgCard
          icon="⏰"
          title="Cobrança vence hoje"
          description="Enviada automaticamente no dia do vencimento da cobrança (cron diário)."
          value={msgLembreteHoje}
          onChange={setMsgLembreteHoje}
          onReset={() => setMsgLembreteHoje(DEFAULT_MSG_LEMBRETE_HOJE)}
          vars={["{nome}", "{servico}", "{valor}", "{pix}", "{data}"]}
          varLabels={{ "{nome}": "Nome do cliente", "{servico}": "Serviço", "{valor}": "Valor (R$)", "{pix}": "Chave Pix", "{data}": "Vencimento" }}
        />

        {/* 6 — Cobrança vencida */}
        <MsgCard
          icon="💸"
          title="Cobrança vencida"
          description="Enviada automaticamente pelo cron e ao clicar em '💸 Cobrar vencido' para cobranças em atraso."
          value={msgCobrancaVencida}
          onChange={setMsgCobrancaVencida}
          onReset={() => setMsgCobrancaVencida(DEFAULT_MSG_COBRANCA_VENCIDA)}
          vars={["{nome}", "{servico}", "{valor}", "{pix}", "{data}"]}
          varLabels={{ "{nome}": "Nome do cliente", "{servico}": "Serviço", "{valor}": "Valor (R$)", "{pix}": "Chave Pix", "{data}": "Vencimento" }}
        />
      </section>


      {/* Chatbot WhatsApp */}
      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Chatbot WhatsApp</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Responde automaticamente quando o cliente envia qualquer mensagem.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBotEnabled((v) => !v)}
            className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${botEnabled ? "bg-brand" : "bg-slate-300"}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${botEnabled ? "right-0.5" : "left-0.5"}`} />
          </button>
        </div>

        {!botEnabled && (
          <p className="text-xs text-slate-400">
            Ative e salve — o webhook é configurado automaticamente na conexão WhatsApp existente.
          </p>
        )}

        {botEnabled && (
          <div className="space-y-3 pt-1">

            {/* Fluxo visual */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2 flex-wrap">
              <span className="font-medium text-slate-700">Cliente escreve</span>
              <span>→</span>
              <span>Bot envia boas‑vindas + menu</span>
              <span>→</span>
              <span>Cliente digita o número</span>
              <span>→</span>
              <span>Bot executa a ação</span>
            </div>

            {/* ── Menu ── sempre visível */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">📋 Opções do menu</p>
              <p className="text-xs text-slate-400">Adicione quantas quiser (máx. 9). O cliente digita o número para escolher.</p>
              <BotMenuEditor items={botMenuItems} onChange={setBotMenuItems} />
            </div>

            {/* ── Mensagens — colapsável ── */}
            <details className="group border border-slate-200 rounded-xl overflow-hidden">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none list-none bg-white hover:bg-slate-50 transition-colors">
                <span className="text-sm font-semibold text-slate-800">💬 Mensagens</span>
                <span className="text-slate-400 text-xs group-open:hidden">▶ expandir</span>
                <span className="text-slate-400 text-xs hidden group-open:inline">▼ recolher</span>
              </summary>
              <div className="px-4 pb-4 pt-3 space-y-4 border-t border-slate-100">
                <div>
                  <label className="label">Boas-vindas <span className="text-slate-400 font-normal">— use <code className="bg-slate-100 px-1 rounded">{"{negocio}"}</code> para o nome do negócio</span></label>
                  <textarea className="input resize-none text-sm font-mono" rows={3} value={botWelcomeMessage} onChange={(e) => setBotWelcomeMessage(e.target.value)} />
                  <button type="button" className="text-xs text-brand underline mt-1" onClick={() => setBotWelcomeMessage(BOT_DEFAULTS.welcome)}>Restaurar padrão</button>
                </div>
                <div>
                  <label className="label">Cabeçalho do menu</label>
                  <input className="input text-sm" value={botMenuHeader} onChange={(e) => setBotMenuHeader(e.target.value)} />
                  <button type="button" className="text-xs text-brand underline mt-1" onClick={() => setBotMenuHeader(BOT_DEFAULTS.menuHeader)}>Restaurar padrão</button>
                </div>
                <div>
                  <label className="label">Opção inválida</label>
                  <input className="input text-sm" value={botFallbackMessage} onChange={(e) => setBotFallbackMessage(e.target.value)} />
                  <button type="button" className="text-xs text-brand underline mt-1" onClick={() => setBotFallbackMessage(BOT_DEFAULTS.fallback)}>Restaurar padrão</button>
                </div>
                <div>
                  <label className="label">Atendimento humano</label>
                  <textarea className="input resize-none text-sm" rows={2} value={botHumanMessage} onChange={(e) => setBotHumanMessage(e.target.value)} />
                  <button type="button" className="text-xs text-brand underline mt-1" onClick={() => setBotHumanMessage(BOT_DEFAULTS.human)}>Restaurar padrão</button>
                </div>
              </div>
            </details>

            {/* ── Horário — colapsável ── */}
            <details className="group border border-slate-200 rounded-xl overflow-hidden">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none list-none bg-white hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">🕐 Horário de atendimento</span>
                  {botBusinessHoursEnabled && <span className="text-[10px] bg-brand text-white px-1.5 py-0.5 rounded-full font-semibold">ATIVO</span>}
                </div>
                <span className="text-slate-400 text-xs group-open:hidden">▶ expandir</span>
                <span className="text-slate-400 text-xs hidden group-open:inline">▼ recolher</span>
              </summary>
              <div className="px-4 pb-4 pt-3 space-y-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-700">Fora do horário, enviar mensagem de ausência</p>
                  <button type="button" onClick={() => setBotBusinessHoursEnabled((v) => !v)}
                    className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${botBusinessHoursEnabled ? "bg-brand" : "bg-slate-300"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${botBusinessHoursEnabled ? "right-0.5" : "left-0.5"}`} />
                  </button>
                </div>
                {botBusinessHoursEnabled && (
                  <div className="space-y-3">
                    <div>
                      <label className="label text-xs">Dias</label>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {[["seg","Seg"],["ter","Ter"],["qua","Qua"],["qui","Qui"],["sex","Sex"],["sab","Sáb"],["dom","Dom"]].map(([val, lbl]) => (
                          <button key={val} type="button"
                            onClick={() => setBotBusinessDays((d) => d.includes(val) ? d.filter((x) => x !== val) : [...d, val])}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${botBusinessDays.includes(val) ? "bg-brand text-white border-brand" : "bg-white text-slate-600 border-slate-200"}`}>
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label text-xs">Abertura</label>
                        <select className="input text-sm" value={botHoursStart} onChange={(e) => setBotHoursStart(parseInt(e.target.value))}>
                          {Array.from({length: 24}, (_, i) => <option key={i} value={i}>{String(i).padStart(2,"0")}:00</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label text-xs">Fechamento</label>
                        <select className="input text-sm" value={botHoursEnd} onChange={(e) => setBotHoursEnd(parseInt(e.target.value))}>
                          {Array.from({length: 24}, (_, i) => <option key={i} value={i}>{String(i).padStart(2,"0")}:00</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="label text-xs">Mensagem fora do horário</label>
                      <textarea className="input resize-none text-sm" rows={3} value={botAwayMessage} onChange={(e) => setBotAwayMessage(e.target.value)} />
                      <button type="button" className="text-xs text-brand underline mt-1" onClick={() => setBotAwayMessage(BOT_DEFAULTS.away)}>Restaurar padrão</button>
                    </div>
                  </div>
                )}
              </div>
            </details>

            {/* ── Avançado — colapsável ── */}
            <details className="group border border-slate-200 rounded-xl overflow-hidden">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none list-none bg-white hover:bg-slate-50 transition-colors">
                <span className="text-sm font-semibold text-slate-800">⚙️ Configurações avançadas</span>
                <span className="text-slate-400 text-xs group-open:hidden">▶ expandir</span>
                <span className="text-slate-400 text-xs hidden group-open:inline">▼ recolher</span>
              </summary>
              <div className="px-4 pb-4 pt-3 space-y-4 border-t border-slate-100">
                <div>
                  <label className="label">Simulação de digitação</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={0} max={4000} step={200} value={botTypingDelayMs}
                      onChange={(e) => setBotTypingDelayMs(parseInt(e.target.value))} className="flex-1" />
                    <span className="text-sm font-mono text-slate-700 w-16 text-right shrink-0">
                      {botTypingDelayMs === 0 ? "Desligado" : `${(botTypingDelayMs / 1000).toFixed(1)}s`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Aparece como "digitando..." antes de cada resposta.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Timeout de sessão</label>
                    <select className="input text-sm" value={botSessionTimeoutMin} onChange={(e) => setBotSessionTimeoutMin(parseInt(e.target.value))}>
                      {[5,10,15,30,60,120].map((m) => <option key={m} value={m}>{m} min</option>)}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Inatividade reinicia o menu</p>
                  </div>
                  <div>
                    <label className="label">Erros antes de escalar</label>
                    <select className="input text-sm" value={botFallbackMaxTries} onChange={(e) => setBotFallbackMaxTries(parseInt(e.target.value))}>
                      {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}x</option>)}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Opções inválidas até atendente</p>
                  </div>
                </div>
                <div>
                  <label className="label">WhatsApp para notificações</label>
                  <input className="input text-sm" type="tel" inputMode="tel" value={botNotifyPhone}
                    onChange={(e) => setBotNotifyPhone(e.target.value)}
                    placeholder="5511999998888 (DDI+DDD, sem espaços)" />
                  <p className="text-xs text-slate-400 mt-1">
                    Avisa esse número quando um cliente pede atendente. Use um número <strong>diferente</strong> do conectado.
                  </p>
                </div>
              </div>
            </details>

            <p className="text-xs text-brand-dark font-semibold bg-brand-light px-3 py-2 rounded-xl border border-brand/20">
              ✅ Ao salvar, o webhook é configurado automaticamente.
            </p>
          </div>
        )}
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

// ── Editor de menu do bot ────────────────────────────────────────────────────
const BOT_ACTION_OPTIONS = [
  { value: "custom",   label: "✏️  Resposta personalizada", hint: "Você escreve o texto que o bot vai enviar (pode incluir links, preços, endereço, FAQ...)" },
  { value: "schedule", label: "📅  Enviar link de agendamento", hint: null },
  { value: "charges",  label: "💳  Consultar cobranças",       hint: null },
  { value: "human",    label: "👤  Encaminhar ao atendente",   hint: null },
] as const;

function BotMenuEditor({ items, onChange }: { items: BotMenuItem[]; onChange: (v: BotMenuItem[]) => void }) {
  function update(index: number, patch: Partial<BotMenuItem>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }
  function move(index: number, dir: -1 | 1) {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }
  function add() {
    if (items.length >= 9) return;
    onChange([...items, { emoji: "✨", title: "Nova opção", action: "custom", value: "" }]);
  }

  const isCustom = (a: string) => a === "custom" || a === "link" || a === "message";

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="border border-slate-200 rounded-xl bg-white overflow-hidden">
          {/* Linha do título */}
          <div className="flex items-center gap-2 p-2.5">
            <span className="text-xs text-slate-400 font-mono w-5 text-center shrink-0">{i + 1}</span>
            <input
              className="input text-base w-10 text-center px-0 shrink-0"
              maxLength={2}
              value={item.emoji}
              onChange={(e) => update(i, { emoji: e.target.value })}
              placeholder="😊"
              title="Emoji"
            />
            <input
              className="input text-sm flex-1 min-w-0"
              value={item.title}
              onChange={(e) => update(i, { title: e.target.value })}
              placeholder="Título da opção"
            />
            <div className="flex gap-0 shrink-0">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-25 text-xs leading-none">▲</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1}
                className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-25 text-xs leading-none">▼</button>
              <button type="button" onClick={() => remove(i)}
                className="p-1.5 text-red-400 hover:text-red-600 text-xs leading-none ml-0.5">✕</button>
            </div>
          </div>
          {/* Ação */}
          <div className="border-t border-slate-100 px-2.5 py-2 space-y-2">
            <select
              className="input text-xs w-full"
              value={isCustom(item.action) ? "custom" : item.action}
              onChange={(e) => update(i, { action: e.target.value as BotMenuAction, value: "" })}
            >
              {BOT_ACTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {/* Resposta personalizada */}
            {isCustom(item.action) && (
              <textarea
                className="input text-sm resize-none w-full"
                rows={3}
                value={item.value || ""}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder={"Escreva o que o bot vai responder ao cliente...\n\nPode incluir links, preços, endereço, horários, FAQ — qualquer texto."}
              />
            )}
          </div>
        </div>
      ))}

      {items.length < 9 ? (
        <button type="button" onClick={add}
          className="w-full border-2 border-dashed border-slate-200 rounded-xl py-3 text-sm text-slate-400 hover:border-brand hover:text-brand transition-colors">
          + Adicionar opção ({items.length}/9)
        </button>
      ) : (
        <p className="text-xs text-slate-400 text-center">Máximo de 9 opções atingido.</p>
      )}
    </div>
  );
}

// ── Componente reutilizável de card de mensagem ──────────────────────────────
function MsgCard({
  icon,
  title,
  description,
  value,
  onChange,
  onReset,
  vars,
  varLabels,
}: {
  icon: string;
  title: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
  vars: string[];
  varLabels: Record<string, string>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertVar(v: string) {
    const el = textareaRef.current;
    if (!el) { onChange(value + v); return; }
    const start = el.selectionStart ?? value.length;
    const end   = el.selectionEnd   ?? value.length;
    const next  = value.slice(0, start) + v + value.slice(end);
    onChange(next);
    // restaura cursor após a variável inserida
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + v.length, start + v.length);
    });
  }

  return (
    <div className="card space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0">{icon}</span>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 text-sm leading-tight">{title}</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-snug">{description}</p>
          </div>
        </div>
        <button
          type="button"
          className="text-xs text-brand underline shrink-0 mt-0.5"
          onClick={onReset}
        >
          Restaurar padrão
        </button>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        className="input resize-none text-sm font-mono leading-relaxed w-full"
        rows={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      {/* Variáveis */}
      <div>
        <p className="text-[11px] text-slate-400 mb-1.5 font-medium uppercase tracking-wide">Variáveis disponíveis</p>
        <div className="flex flex-wrap gap-1.5">
          {vars.map((v) => (
            <button
              key={v}
              type="button"
              title={varLabels[v] || v}
              className="group relative text-xs bg-brand-light text-brand-dark font-mono px-2 py-1 rounded-lg border border-brand/20 hover:bg-brand hover:text-white hover:border-brand transition-colors"
              onClick={() => insertVar(v)}
            >
              {v}
              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded-lg bg-slate-800 px-2 py-1 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity z-10">
                {varLabels[v]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      {value && (
        <details className="group">
          <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 select-none list-none flex items-center gap-1">
            <span className="group-open:hidden">▶ Ver prévia</span>
            <span className="hidden group-open:inline">▼ Ocultar prévia</span>
          </summary>
          <pre className="mt-2 text-xs bg-green-50 border border-green-200 rounded-xl p-3 whitespace-pre-wrap font-sans leading-relaxed text-slate-700 max-h-44 overflow-y-auto">
            {value
              .replace(/\{nome\}/g, "João Silva")
              .replace(/\{servico\}/g, "Corte + Barba")
              .replace(/\{data\}/g, "02/07/2026")
              .replace(/\{horario\}/g, "14:00")
              .replace(/\{negocio\}/g, "Studio do Max")
              .replace(/\{valor\}/g, "R$ 80,00")
              .replace(/\{pix\}/g, "11999998888")
            }
          </pre>
        </details>
      )}
    </div>
  );
}
