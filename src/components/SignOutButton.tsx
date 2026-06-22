"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();
  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button onClick={signOut} className="text-sm text-slate-500 hover:text-slate-800">
      Sair
    </button>
  );
}
