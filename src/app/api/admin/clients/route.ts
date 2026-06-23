import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase-admin";

async function verifyAdmin(req: NextRequest) {
  const token = req.headers.get("authorization")?.slice(7);
  if (!token) return null;
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user || user.email !== process.env.ADMIN_EMAIL) return null;
  return user;
}

export async function GET(req: NextRequest) {
  const user = await verifyAdmin(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  try {
    const admin = createAdminClient();

    const [{ data: profiles }, { data: authData }] = await Promise.all([
      admin.from("profiles").select("*").order("created_at", { ascending: false }),
      admin.auth.admin.listUsers({ perPage: 1000 }),
    ]);

    const emailMap = new Map((authData?.users || []).map((u) => [u.id, { email: u.email, created_at: u.created_at }]));

    const clients = (profiles || []).map((p) => ({
      ...p,
      email: emailMap.get(p.id)?.email || null,
      registered_at: emailMap.get(p.id)?.created_at || p.created_at,
    }));

    return NextResponse.json({ clients });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await verifyAdmin(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  try {
    const body = await req.json();
    const { id, plan_type, plan_expires_at, plan_price_cents, is_blocked, plan_notes } = body;
    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ plan_type, plan_expires_at, plan_price_cents, is_blocked, plan_notes })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
