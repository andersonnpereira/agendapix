import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";

async function isAdmin(req: NextRequest): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user && user.email === process.env.ADMIN_EMAIL;
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin.from("app_settings").select("key, value");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const map = Object.fromEntries((data || []).map((s) => [s.key, s.value]));
  return NextResponse.json({ settings: map });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const admin = createAdminClient();

  const updates = Object.entries(body as Record<string, string>).map(([key, value]) => ({ key, value }));
  const { error } = await admin
    .from("app_settings")
    .upsert(updates, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
