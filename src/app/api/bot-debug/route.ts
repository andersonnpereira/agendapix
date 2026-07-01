import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

// GET /api/bot-debug — retorna diagnóstico completo do bot (requer login)
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: _raw, error: profileErr } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileErr || !_raw) {
    return NextResponse.json({ error: "Perfil não encontrado", detail: profileErr?.message });
  }

  const p = _raw as Record<string, unknown>;

  const baseUrl = (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const apiKey = (p.whatsapp_token as string) || process.env.EVOLUTION_API_KEY || "";
  const instanceName = (p.whatsapp_instance_id as string) || "";
  const webhookUrl = `${siteUrl}/api/whatsapp-incoming/${user.id}`;

  // Verifica webhook na Evolution API
  let webhookStatus: unknown = null;
  let webhookError: string | null = null;
  if (baseUrl && instanceName && apiKey) {
    try {
      const res = await fetch(`${baseUrl}/webhook/find/${instanceName}`, {
        headers: { apikey: apiKey },
      });
      webhookStatus = await res.json().catch(() => ({ httpStatus: res.status }));
    } catch (e) {
      webhookError = String(e);
    }
  }

  // Verifica conversas ativas
  const { data: convs, error: convErr } = await admin
    .from("bot_conversations")
    .select("phone, state, last_message_at, current_flow, fallback_count")
    .eq("profile_id", user.id)
    .order("last_message_at", { ascending: false })
    .limit(5);

  // Resumo de flows configurados
  const flows = Array.isArray(p.bot_flows) ? p.bot_flows : [];

  return NextResponse.json({
    ok: true,
    bot: {
      enabled: p.bot_enabled,
      trigger_mode: p.bot_trigger_mode || "keywords (padrão)",
      trigger_keywords: p.bot_trigger_keywords || "padrão",
      flows_count: (flows as unknown[]).length,
      flows_ids: (flows as Array<{ id: string }>).map((f) => f.id),
    },
    whatsapp: {
      provider: p.whatsapp_provider || "evolution",
      instance_id: instanceName || "(não configurado)",
      has_token: !!apiKey,
    },
    webhook: {
      expected_url: webhookUrl,
      site_url_env: siteUrl || "(NEXT_PUBLIC_SITE_URL não definida!)",
      evolution_api_url: baseUrl || "(EVOLUTION_API_URL não definida!)",
      evolution_webhook_config: webhookStatus,
      evolution_webhook_error: webhookError,
    },
    recent_conversations: convErr ? `Erro: ${convErr.message}` : (convs || []),
    diagnostics: {
      bot_enabled: !!p.bot_enabled,
      has_instance: !!instanceName,
      has_site_url: !!siteUrl,
      has_evolution_url: !!baseUrl,
      has_flows: (flows as unknown[]).length > 0,
      bot_conversations_table_ok: !convErr,
    },
  });
}
