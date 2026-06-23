import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import BookingForm from "./BookingForm";

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
    .select("id, name, business_name, avatar_url, brand_color, pix_key, pix_merchant_name, pix_merchant_city")
    .eq("slug", params.slug)
    .single();

  if (!profile || !profile.pix_key) notFound();

  const { data: services } = await supabase
    .from("services")
    .select("id, name, duration_minutes, price_cents")
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

  const brandColor = (profile as { brand_color?: string | null }).brand_color || "#16A34A";
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
      .bp .btn-primary { background-color: ${brandColor} !important; border-color: ${brandColor} !important; }
      .bp .btn-primary:hover { background-color: ${brandDark} !important; }
      .bp .ring-brand { --tw-ring-color: ${brandColor} !important; }
      .bp input[type=radio]:checked { accent-color: ${brandColor}; }
    ` }} />
    <div className="bp min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Header do profissional */}
        <div className="text-center space-y-2">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={profile.business_name || ""}
              className="w-20 h-20 rounded-full object-cover mx-auto border-2 border-white shadow"
            />
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
          />
        )}
      </div>
    </div>
    </>
  );
}
