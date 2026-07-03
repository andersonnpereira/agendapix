import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

// Retorna apenas os horários OCUPADOS (time + duração) de um profissional
// numa data — sem qualquer PII (nome/telefone/notas). Usado pela página
// pública de agendamento para calcular os slots livres. Roda no servidor
// com service role para que a tabela bookings não precise de select público.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profileId") || "";
  const date = req.nextUrl.searchParams.get("date") || "";

  // Validação estrita: UUID e data YYYY-MM-DD
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) {
    return NextResponse.json({ error: "profileId inválido" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "data inválida" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select("time, services(duration_minutes)")
    .eq("profile_id", profileId)
    .eq("date", date)
    .in("status", ["pendente", "confirmado"]);

  if (error) {
    console.error("[api/slots] erro:", error.message);
    return NextResponse.json({ error: "Erro ao carregar horários" }, { status: 500 });
  }

  const booked = (data || []).map((b) => {
    const svc = b.services as unknown;
    const dur = Array.isArray(svc)
      ? (svc[0] as { duration_minutes: number } | undefined)?.duration_minutes
      : (svc as { duration_minutes: number } | null)?.duration_minutes;
    return { time: b.time as string, duration_minutes: dur || 0 };
  });

  return NextResponse.json({ booked });
}
