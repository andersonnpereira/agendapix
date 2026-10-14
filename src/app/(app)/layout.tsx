import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { SignOutButton } from "@/components/SignOutButton";
import { BottomNav } from "@/components/BottomNav";
import { SideNav } from "@/components/SideNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Desktop sidebar ───────────────────────────────── */}
      <SideNav />

      {/* ── Mobile header ─────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-100">
        <div className="px-5 h-14 flex items-center justify-between">
          <span className="font-bold text-lg text-brand tracking-tight">Agendou</span>
          <div className="flex items-center gap-3">
            <Link
              href="/ajuda"
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand bg-brand/10 hover:bg-brand/20 px-2.5 py-1.5 rounded-full transition-colors"
            >
              <span>❓</span> Ajuda
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* ── Content area ──────────────────────────────────── */}
      <div className="lg:pl-64 pb-24 lg:pb-10">
        <main className="px-5 py-6 lg:px-10 lg:py-8 max-w-5xl">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom nav ─────────────────────────────── */}
      <BottomNav />

    </div>
  );
}
