import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!user || !adminEmail || user.email !== adminEmail) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-slate-900">Agendou</span>
            <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-1 rounded-full tracking-wide">
              ADMIN
            </span>
          </div>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">
            ← Voltar ao portal
          </Link>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
