import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { SignOutButton } from "@/components/SignOutButton";
import { BottomNav } from "@/components/BottomNav";
import { SideNav } from "@/components/SideNav";

const PLAN_LABELS: Record<string, string> = {
  trial:    "Trial",
  monthly:  "Mensal",
  annual:   "Anual",
  lifetime: "Vitalício",
};

function formatDateBR(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const isAdmin = user.email === process.env.ADMIN_EMAIL;

  let planType: string | null = null;
  let planExpiresAt: string | null = null;
  let daysLeft: number | null = null;
  let expiryWarning: string | null = null;

  if (!isAdmin) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_type, plan_expires_at, is_blocked")
      .eq("id", user.id)
      .single();

    if (profile) {
      const now = new Date();
      const isBlocked = profile.is_blocked === true;
      const isExpired =
        profile.plan_type !== "lifetime" &&
        profile.plan_expires_at !== null &&
        new Date(profile.plan_expires_at) < now;

      if (isBlocked || isExpired) redirect("/plano");

      planType      = profile.plan_type;
      planExpiresAt = profile.plan_expires_at;

      if (planExpiresAt && planType !== "lifetime") {
        daysLeft = Math.ceil(
          (new Date(planExpiresAt).getTime() - now.getTime()) / 86400000
        );

        const warnDays = planType === "annual" ? 15 : 7;
        if (daysLeft !== null && daysLeft <= warnDays && daysLeft >= 0) {
          expiryWarning = daysLeft === 0
            ? `Seu plano ${PLAN_LABELS[planType] ?? planType} vence hoje!`
            : `Seu plano ${PLAN_LABELS[planType] ?? planType} vence em ${daysLeft} dia${daysLeft !== 1 ? "s" : ""} (${formatDateBR(planExpiresAt)}).`;
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Desktop sidebar ───────────────────────────────── */}
      <SideNav isAdmin={isAdmin} planType={planType} planExpiresAt={planExpiresAt} daysLeft={daysLeft} />

      {/* ── Mobile header ─────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-100">
        <div className="px-5 h-14 flex items-center justify-between">
          <span className="font-bold text-lg text-brand tracking-tight">Agendou</span>
          <div className="flex items-center gap-3">
            <Link href="/ajuda" className="text-xs text-slate-400 hover:text-brand transition-colors">
              Ajuda
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* ── Content area ──────────────────────────────────── */}
      <div className="lg:pl-64 pb-24 lg:pb-10">
        {/* Banner de aviso de expiração */}
        {expiryWarning && (
          <div className="mx-5 mt-5 lg:mx-10 lg:mt-6 bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-xl shrink-0">⚠️</span>
            <p className="text-sm text-amber-800 flex-1">
              {expiryWarning}{" "}
              <Link href="/plano" className="font-semibold underline underline-offset-2 hover:text-amber-900">
                Renovar agora →
              </Link>
            </p>
          </div>
        )}
        <main className="px-5 py-6 lg:px-10 lg:py-8 max-w-5xl">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom nav ─────────────────────────────── */}
      <BottomNav />

    </div>
  );
}
