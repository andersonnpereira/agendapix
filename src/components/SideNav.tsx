"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, CalendarDays, Users, CreditCard, BarChart3, Settings, HelpCircle, ShieldCheck,
} from "lucide-react";
import { SignOutButton } from "@/components/SignOutButton";

const nav = [
  { href: "/dashboard",     label: "Início",        Icon: Home },
  { href: "/agenda",        label: "Agenda",         Icon: CalendarDays },
  { href: "/clientes",      label: "Clientes",       Icon: Users },
  { href: "/cobrancas",     label: "Cobranças",      Icon: CreditCard },
  { href: "/financeiro",    label: "Financeiro",     Icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações",  Icon: Settings },
];

export function SideNav({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col z-20">
      <div className="flex flex-col flex-1 bg-white border-r border-slate-100 overflow-y-auto">

        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center px-6 border-b border-slate-100">
          <span className="font-bold text-xl text-brand tracking-tight">Agendou</span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {isAdmin && (
            <Link
              href="/admin"
              className={[
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 mb-2",
                pathname.startsWith("/admin")
                  ? "bg-purple-100 text-purple-700"
                  : "text-purple-500 hover:bg-purple-50 hover:text-purple-700",
              ].join(" ")}
            >
              <ShieldCheck size={18} strokeWidth={pathname.startsWith("/admin") ? 2.5 : 2} className="shrink-0" />
              Admin
              {pathname.startsWith("/admin") && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-500" />
              )}
            </Link>
          )}
          {nav.map(({ href, label, Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={[
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-brand/10 text-brand"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
                ].join(" ")}
              >
                <Icon
                  size={18}
                  strokeWidth={isActive ? 2.5 : 2}
                  className="shrink-0"
                />
                {label}
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-4 border-t border-slate-100 space-y-0.5">
          <Link
            href="/ajuda"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-all duration-150"
          >
            <HelpCircle size={18} strokeWidth={2} className="shrink-0" />
            Ajuda
          </Link>
          <div className="px-3 py-2">
            <SignOutButton />
          </div>
        </div>
      </div>
    </aside>
  );
}
