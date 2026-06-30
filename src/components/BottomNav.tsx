"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, Users, CreditCard, BarChart3, Settings, ShieldCheck } from "lucide-react";

const nav = [
  { href: "/dashboard",     label: "Início",     Icon: Home },
  { href: "/agenda",        label: "Agenda",     Icon: CalendarDays },
  { href: "/clientes",      label: "Clientes",   Icon: Users },
  { href: "/cobrancas",     label: "Cobranças",  Icon: CreditCard },
  { href: "/financeiro",    label: "Financeiro", Icon: BarChart3 },
  { href: "/configuracoes", label: "Config",     Icon: Settings },
];

export function BottomNav({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname();

  const items = isAdmin
    ? [...nav, { href: "/admin", label: "Admin", Icon: ShieldCheck }]
    : nav;

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-sm border-t border-slate-100 z-20 lg:hidden">
      <div
        className="px-1 pb-safe"
        style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map(({ href, label, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          const isAdminLink = href === "/admin";
          return (
            <Link
              key={href}
              href={href}
              className={[
                "flex flex-col items-center gap-0.5 py-2.5 px-1 transition-all duration-150",
                isActive
                  ? isAdminLink ? "text-purple-600" : "text-brand"
                  : isAdminLink ? "text-purple-400 hover:text-purple-600" : "text-slate-400 hover:text-slate-600",
              ].join(" ")}
            >
              <div className={[
                "p-1.5 rounded-lg transition-all duration-150",
                isActive ? (isAdminLink ? "bg-purple-100" : "bg-brand/10") : "",
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
