"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/dashboard",     label: "Início",     icon: "🏠" },
  { href: "/agenda",        label: "Agenda",     icon: "📅" },
  { href: "/clientes",      label: "Clientes",   icon: "👥" },
  { href: "/cobrancas",     label: "Cobranças",  icon: "💰" },
  { href: "/financeiro",    label: "Financeiro", icon: "📊" },
  { href: "/configuracoes", label: "Config",     icon: "⚙️" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-100 z-10">
      <div className="max-w-2xl mx-auto grid grid-cols-6">
        {nav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex flex-col items-center py-2.5 text-xs transition-colors duration-200",
                isActive
                  ? "text-brand border-t-2 border-brand"
                  : "text-slate-400 hover:text-brand border-t-2 border-transparent",
              ].join(" ")}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
