import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { SignOutButton } from "@/components/SignOutButton";

const nav = [
  { href: "/dashboard", label: "Início", icon: "🏠" },
  { href: "/agenda", label: "Agenda", icon: "📅" },
  { href: "/cobrancas", label: "Cobranças", icon: "💰" },
  { href: "/servicos", label: "Serviços", icon: "✂️" },
  { href: "/configuracoes", label: "Config", icon: "⚙️" },
];


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
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-100 z-10">
        <div className="max-w-2xl mx-auto grid grid-cols-5">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center py-2.5 text-xs text-slate-500 hover:text-brand"
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="mt-0.5">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
