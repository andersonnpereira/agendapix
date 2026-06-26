import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";

const BUCKET = "service-images";

export async function POST(req: NextRequest) {
  try {
    // Verifica autenticação
    const supabaseUser = createClient();
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const serviceId = formData.get("serviceId") as string | null;

    if (!file || !serviceId) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Imagem muito grande. Máximo 5 MB." }, { status: 400 });
    }

    // Usa service role para ignorar RLS do Storage
    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${serviceId}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, buffer, { upsert: true, contentType: file.type });

    if (upErr) {
      console.error("[upload-service-image]", upErr);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error("[upload-service-image] exceção:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
