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

    const [{ data: profiles }, { data: authData }, { count: totalBookings }, { data: bookingCounts }] = await Promise.all([
      admin.from("profiles").select("*").order("created_at", { ascending: false }),
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin.from("bookings").select("*", { count: "exact", head: true }),
      admin.from("bookings").select("profile_id").then(({ data }) => {
        const counts: Record<string, number> = {};
        (data || []).forEach((b) => { counts[b.profile_id] = (counts[b.profile_id] || 0) + 1; });
        return { data: counts };
      }),
    ]);

    const emailMap = new Map((authData?.users || []).map((u) => [u.id, {
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }]));

    const clients = (profiles || []).map((p) => ({
      ...p,
      email: emailMap.get(p.id)?.email || null,
      registered_at: emailMap.get(p.id)?.created_at || p.created_at,
      last_sign_in_at: emailMap.get(p.id)?.last_sign_in_at || null,
      booking_count: (bookingCounts as Record<string, number>)[p.id] || 0,
    }));

    return NextResponse.json({ clients, totalBookings: totalBookings || 0 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await verifyAdmin(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

    const admin = createAdminClient();

    const steps = [
      () => admin.from("charges").delete().eq("profile_id", id),
      () => admin.from("bookings").delete().eq("profile_id", id),
      () => admin.from("clients").delete().eq("profile_id", id),
      () => admin.from("availability").delete().eq("profile_id", id),
      () => admin.from("services").delete().eq("profile_id", id),
      () => admin.from("profiles").delete().eq("id", id),
    ];

    for (const step of steps) {
      const { error } = await step();
      if (error) {
        console.error("DELETE cliente erro:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    const { error: authError } = await admin.auth.admin.deleteUser(id);
    if (authError) {
      console.error("DELETE auth user erro:", authError);
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE cliente catch:", e);
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
