import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import BookingForm from "./BookingForm";
import { AvatarImg } from "./AvatarImg";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, business_name, avatar_url")
    .eq("slug", params.slug)
    .single();

  if (!profile) return { title: "Agendamento" };

  const name = profile.business_name || profile.name || "Profissional";
  const title = `Agendar com ${name}`;
  const description = `Agende seu horário com ${name} de forma rápida e fácil.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(profile.avatar_url ? { images: [{ url: profile.avatar_url }] } : {}),
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
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

  if (!profile.pix_key) {
    const name = profile.business_name || profile.name || "Este profissional";
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4">
          <div className="text-5xl">🔧</div>
          <h1 className="text-xl font-bold text-slate-900">{name}</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Este profissional ainda está configurando o perfil de agendamento.
            <br />Tente novamente em breve!
          </p>
          <p className="text-xs text-slate-400">Se você é o dono desta página, acesse o portal e configure sua chave Pix em Configurações.</p>
        </div>
      </div>
    );
  }

  const { data: services } = await supabase
    .from("services")
    .select("id, name, duration_minutes, price_cents, image_url, extra_questions")
    .eq("profile_id", profile.id)
    .eq("active", true)
    .order("name");

  const { data: availability } = await supabase
    .from("availability")
    .select("weekday, start_time, end_time")
    .eq("profile_id", profile.id)
    .order("weekday")
    .order("start_time");

  const { data: dateOverrides } = await supabase
    .from("date_overrides")
    .select("date, date_end")
    .eq("profile_id", profile.id);

  const blockedDates = (dateOverrides || []).map(
    (o: { date: string; date_end: string | null }) => ({
      start: o.date,
      end: o.date_end || o.date,
    })
  );

  const rawColor = (profile as { brand_color?: string | null }).brand_color || "#16A34A";
  const brandColor = /^#[0-9A-Fa-f]{6}$/.test(rawColor) ? rawColor : "#16A34A";
  const brandDark = darkenHex(brandColor);
  const brandLight = lightenRgba(brandColor, 0.12);
  const brandBorder = lightenRgba(brandColor, 0.3);

  return (
    <>
    <style dangerouslySetInnerHTML={{ __html: `
      .bp .bg-brand { background-color: ${brandColor} !important; }
      .bp .text-brand { color: ${brandColor} !important; }
      .bp .border-brand { border-color: ${brandColor} !important; }
      .bp .bg-brand-light { background-color: ${brandLight} !important; }
      .bp .text-brand-dark { color: ${brandDark} !important; }
      .bp .border-brand\\/20 { border-color: ${brandBorder} !important; }
      .bp .hover\\:bg-brand:hover { background-color: ${brandColor} !important; }
      .bp .hover\\:text-brand:hover { color: ${brandColor} !important; }
      .bp .hover\\:border-brand:hover { border-color: ${brandColor} !important; }
      .bp .btn-primary { background-color: ${brandColor} !important; border-color: ${brandColor} !important; }
      .bp .btn-primary:hover { background-color: ${brandDark} !important; }
      .bp .ring-brand { --tw-ring-color: ${brandColor} !important; }
      .bp input[type=radio]:checked { accent-color: ${brandColor}; }
    ` }} />
    <div className="bp min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Header do profissional */}
        <div className="text-center space-y-2">
          {(profile as { cover_url?: string | null }).cover_url && (
            <div className="w-full h-36 overflow-hidden rounded-2xl mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={(profile as { cover_url?: string | null }).cover_url!}
                alt="Capa"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          {profile.avatar_url ? (
            <AvatarImg src={profile.avatar_url} alt={profile.business_name || ""} />
          ) : (
            <div className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center mx-auto text-3xl">
              ✂️
            </div>
          )}
          <h1 className="text-xl font-bold text-slate-900">
            {profile.business_name || profile.name || "Profissional"}
          </h1>
          {profile.name && profile.business_name && (
            <p className="text-sm text-slate-500">{profile.name}</p>
          )}
          {(profile as { bio?: string | null }).bio && (
            <p className="text-sm text-slate-600 text-center leading-relaxed mt-1 px-2">
              {(profile as { bio?: string | null }).bio}
            </p>
          )}
          {(profile as { review_link?: string | null }).review_link && (
            <a
              href={(profile as { review_link?: string | null }).review_link!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full hover:bg-amber-100 transition-colors mt-2"
            >
              ⭐ Deixar avaliação
            </a>
          )}
        </div>

        {!services || services.length === 0 ? (
          <div className="card text-center text-slate-500 text-sm py-10">
            <p className="text-3xl mb-3">😔</p>
            <p>Nenhum serviço disponível no momento.</p>
          </div>
        ) : (
          <BookingForm
            profileId={profile.id}
            services={services}
            availability={availability || []}
            blockedDates={blockedDates}
            bookingSettings={{
              minNoticeHours: (profile as Record<string, unknown>).min_notice_hours as number ?? 1,
              maxAdvanceDays: (profile as Record<string, unknown>).max_advance_days as number ?? 60,
              dailyBookingLimit: (profile as Record<string, unknown>).daily_booking_limit as number | null ?? null,
              bufferMinutes: (profile as Record<string, unknown>).booking_buffer_minutes as number ?? 0,
              autoConfirm: (profile as Record<string, unknown>).auto_confirm as boolean ?? false,
              cancelMinHours: (profile as Record<string, unknown>).cancel_min_hours as number ?? 0,
            }}
          />
        )}
      </div>
    </div>
    </>
  );
}
