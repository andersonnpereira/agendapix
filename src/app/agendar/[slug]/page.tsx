import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import BookingForm from "./BookingForm";
import { AvatarImg } from "./AvatarImg";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, business_name, avatar_url, bio")
    .eq("slug", params.slug)
    .single();

  if (!profile) return { title: "Agendamento" };

  const name = profile.business_name || profile.name || "Profissional";
  const title = `Agendar com ${name}`;
  const description = (profile as Record<string, unknown>).bio as string || `Agende seu horário com ${name} de forma rápida e fácil.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(profile.avatar_url ? { images: [{ url: profile.avatar_url }] } : {}),
      type: "website",
    },
    twitter: { card: "summary", title, description },
  };
}

function hexToRgb(hex: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : { r: 22, g: 163, b: 74 };
}
function darkenHex(hex: string, amt = 0.15) {
  const { r, g, b } = hexToRgb(hex);
  const d = (c: number) => Math.max(0, Math.floor(c * (1 - amt))).toString(16).padStart(2, "0");
  return `#${d(r)}${d(g)}${d(b)}`;
}
function lightenRgba(hex: string, opacity = 0.15) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${opacity})`;
}

export const dynamic = "force-dynamic";
type Props = { params: { slug: string } };

export default async function AgendarPage({ params }: Props) {
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, business_name, avatar_url, brand_color, pix_key, pix_merchant_name, pix_merchant_city, bio, review_link, cover_url, min_notice_hours, max_advance_days, daily_booking_limit, booking_buffer_minutes, auto_confirm, cancel_min_hours")
    .eq("slug", params.slug)
    .single();

  if (!profile) notFound();

  const p = profile as Record<string, unknown>;
  const displayName = profile.business_name || profile.name || "Profissional";
  const rawColor = (p.brand_color as string | null) || "#16A34A";
  const brandColor = /^#[0-9A-Fa-f]{6}$/.test(rawColor) ? rawColor : "#16A34A";
  const brandDark  = darkenHex(brandColor);
  const brandLight = lightenRgba(brandColor, 0.12);
  const brandBorder = lightenRgba(brandColor, 0.3);
  const coverUrl   = p.cover_url as string | null;
  const bio        = p.bio as string | null;
  const reviewLink = p.review_link as string | null;
  const autoConfirm    = !!(p.auto_confirm);
  const cancelMinHours = (p.cancel_min_hours as number) ?? 0;

  if (!profile.pix_key) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-3xl">🔧</div>
          <h1 className="text-xl font-bold text-slate-900">{displayName}</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Este profissional ainda está configurando o perfil de agendamento.
            <br />Tente novamente em breve!
          </p>
          <p className="text-xs text-slate-400">
            Dono desta página? Acesse o portal e configure sua chave Pix em{" "}
            <span className="font-medium">Configurações</span>.
          </p>
        </div>
      </div>
    );
  }

  const [{ data: services }, { data: availability }, { data: dateOverrides }] = await Promise.all([
    supabase.from("services").select("id, name, duration_minutes, price_cents, image_url, extra_questions").eq("profile_id", profile.id).eq("active", true).order("name"),
    supabase.from("availability").select("weekday, start_time, end_time").eq("profile_id", profile.id).order("weekday").order("start_time"),
    supabase.from("date_overrides").select("date, date_end").eq("profile_id", profile.id),
  ]);

  const blockedDates = (dateOverrides || []).map((o: { date: string; date_end: string | null }) => ({
    start: o.date,
    end: o.date_end || o.date,
  }));

  const serviceCount = services?.length ?? 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .bp .bg-brand          { background-color: ${brandColor} !important; }
        .bp .text-brand        { color: ${brandColor} !important; }
        .bp .border-brand      { border-color: ${brandColor} !important; }
        .bp .bg-brand-light    { background-color: ${brandLight} !important; }
        .bp .text-brand-dark   { color: ${brandDark} !important; }
        .bp .border-brand\\/20 { border-color: ${brandBorder} !important; }
        .bp .hover\\:bg-brand:hover     { background-color: ${brandColor} !important; }
        .bp .hover\\:text-brand:hover   { color: ${brandColor} !important; }
        .bp .hover\\:border-brand:hover { border-color: ${brandColor} !important; }
        .bp .btn-primary        { background-color: ${brandColor} !important; border-color: ${brandColor} !important; }
        .bp .btn-primary:hover  { background-color: ${brandDark} !important; }
        .bp .ring-brand         { --tw-ring-color: ${brandColor} !important; }
        .bp input[type=radio]:checked { accent-color: ${brandColor}; }
        .bp .brand-badge { background-color:${lightenRgba(brandColor,0.1)}; color:${brandColor}; border-color:${brandBorder}; }
      ` }} />
      <div className="bp min-h-screen bg-slate-50">

        {/* ── Cover ─────────────────────────────────────────── */}
        {coverUrl ? (
          <div className="w-full h-44 sm:h-60 relative overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl} alt="Capa" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/35" />
          </div>
        ) : (
          <div
            className="w-full h-28"
            style={{ background: `linear-gradient(135deg, ${lightenRgba(brandColor, 0.3)} 0%, ${lightenRgba(brandColor, 0.08)} 100%)` }}
          />
        )}

        <div className="max-w-xl mx-auto px-4">

          {/* ── Avatar sobreposto ─────────────────────────── */}
          <div className="flex justify-center -mt-10 mb-4">
            <div className="ring-4 ring-white rounded-full shadow-xl">
              {profile.avatar_url ? (
                <AvatarImg src={profile.avatar_url} alt={displayName} className="w-20 h-20" />
              ) : (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-3xl border-2 border-white"
                  style={{ backgroundColor: lightenRgba(brandColor, 0.2) }}
                >
                  ✂️
                </div>
              )}
            </div>
          </div>

          {/* ── Perfil ────────────────────────────────────── */}
          <div className="text-center space-y-2 mb-7">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {displayName}
            </h1>
            {profile.name && profile.business_name && (
              <p className="text-sm text-slate-500">{profile.name}</p>
            )}
            {bio && (
              <p className="text-sm text-slate-600 leading-relaxed max-w-xs mx-auto mt-1 px-2">
                {bio}
              </p>
            )}

            {reviewLink && (
              <div className="pt-1">
                <a
                  href={reviewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full hover:bg-amber-100 transition-colors"
                >
                  ⭐ Deixar avaliação
                </a>
              </div>
            )}

            {/* Trust badges */}
            <div className="flex justify-center flex-wrap gap-2 pt-2">
              <span className="brand-badge inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border">
                {autoConfirm ? "⚡ Confirmação automática" : "⏳ Confirmado em breve"}
              </span>
              {cancelMinHours > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full">
                  ↩️ Cancele com {cancelMinHours}h de antecedência
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full">
                🔒 Seguro
              </span>
            </div>
          </div>

          {/* ── Divisor ──────────────────────────────────── */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
              {serviceCount > 0
                ? `${serviceCount} serviço${serviceCount !== 1 ? "s" : ""} disponíve${serviceCount !== 1 ? "is" : "l"}`
                : "Agendamento"}
            </span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* ── Form ─────────────────────────────────────── */}
          {serviceCount === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center space-y-3">
              <p className="text-4xl">📅</p>
              <p className="font-semibold text-slate-700">Nenhum serviço disponível</p>
              <p className="text-sm text-slate-400">Este profissional ainda não cadastrou serviços. Tente em breve.</p>
            </div>
          ) : (
            <BookingForm
              profileId={profile.id}
              services={services!}
              availability={availability || []}
              blockedDates={blockedDates}
              bookingSettings={{
                minNoticeHours:   (p.min_notice_hours   as number) ?? 1,
                maxAdvanceDays:   (p.max_advance_days   as number) ?? 60,
                dailyBookingLimit:(p.daily_booking_limit as number | null) ?? null,
                bufferMinutes:    (p.booking_buffer_minutes as number) ?? 0,
                autoConfirm,
                cancelMinHours,
              }}
              businessName={displayName}
            />
          )}

          {/* ── Footer ───────────────────────────────────── */}
          <div className="text-center py-10">
            <p className="text-xs text-slate-400">
              Agendamento gerenciado por{" "}
              <a href="/" className="text-brand font-semibold hover:underline">
                Agendou
              </a>
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
