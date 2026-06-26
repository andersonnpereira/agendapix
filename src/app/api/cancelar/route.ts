import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const { booking_id, token } = await req.json();
    if (!booking_id || !token) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verifica que o token corresponde ao booking
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, status, cancel_token")
      .eq("id", booking_id)
      .eq("cancel_token", token)
      .single();

    if (!booking) {
      return NextResponse.json({ error: "Link inválido ou expirado." }, { status: 404 });
    }

    if (booking.status === "concluido") {
      return NextResponse.json({ error: "Agendamento já concluído, não é possível cancelar." }, { status: 400 });
    }

    if (booking.status === "cancelado") {
      return NextResponse.json({ ok: true, alreadyCancelled: true });
    }

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelado", cancel_token: null })
      .eq("id", booking_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
