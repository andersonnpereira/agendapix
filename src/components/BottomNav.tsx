"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, Users, CreditCard, BarChart3, Settings } from "lucide-react";

const nav = [
  { href: "/dashboard",     label: "Início",     Icon: Home },
  { href: "/agenda",        label: "Agenda",     Icon: CalendarDays },
  { href: "/clientes",      label: "Clientes",   Icon: Users },
  { href: "/cobrancas",     label: "Cobranças",  Icon: CreditCard },
  { href: "/financeiro",    label: "Financeiro", Icon: BarChart3 },
  { href: "/configuracoes", label: "Config",     Icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-sm border-t border-slate-100 z-20 lg:hidden">
      <div className="grid grid-cols-6 px-1 pb-safe">
        {nav.map(({ href, label, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={[
                "flex flex-col items-center gap-0.5 py-2.5 px-1 transition-all duration-150",
                isActive ? "text-brand" : "text-slate-400 hover:text-slate-600",
              ].join(" ")}
            >
              <div className={[
                "p-1.5 rounded-lg transition-all duration-150",
                isActive ? "bg-brand/10" : "",
              ].join(" ")}>
                <Icon size={19} strokeWidth={isActive ? 2.5 : 1.75} />
              </div>
              <span className={[
                "text-[10px] leading-none",
                isActive ? "font-semibold" : "font-medium",
              ].join(" ")}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
