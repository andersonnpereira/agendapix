import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import BookingForm from "./BookingForm";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

export default async function AgendarPage({ params }: Props) {
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, business_name, avatar_url, pix_key, pix_merchant_name, pix_merchant_city")
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

  return (
    <div className="min-h-screen bg-slate-50">
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
          />
        )}
      </div>
    </div>
  );
}
