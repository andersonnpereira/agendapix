import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { SignOutButton } from "@/components/SignOutButton";
import { BottomNav } from "@/components/BottomNav";


export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const isAdmin = user.email === process.env.ADMIN_EMAIL;

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

      if (isBlocked || isExpired) {
        redirect("/plano");
      }
    }
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-2xl mx-auto px-5 h-14 flex items-center justify-between">
          <span className="font-bold text-brand">Agendou</span>
          <div className="flex items-center gap-3">
            <Link href="/ajuda" className="text-xs text-slate-500 hover:text-brand">Ajuda</Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6">{children}</main>

      {/* Bottom nav (mobile-first) */}
      <BottomNav />
    </div>
  );
}
