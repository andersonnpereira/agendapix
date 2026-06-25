import { createAdminClient } from "./supabase-admin";

export type PlanType = "monthly" | "annual" | "lifetime";

export function calcExpiry(planType: PlanType): string | null {
  if (planType === "lifetime") return null;
  const d = new Date();
  if (planType === "monthly") d.setDate(d.getDate() + 31);
  else d.setDate(d.getDate() + 366);
  return d.toISOString();
}

/**
 * Ativa o plano de um usuário pelo e-mail.
 * - Se o usuário já existe → ativa imediatamente.
 * - Se ainda não existe → salva em pending_activations; o trigger SQL ativa na hora do cadastro.
 */
export async function activatePlanByEmail(
  email: string,
  planType: PlanType,
  source: string,
  rawPayload?: object
): Promise<{ activated: boolean; userId?: string }> {
  const admin = createAdminClient();
  const expiresAt = calcExpiry(planType);
  const normalizedEmail = email.toLowerCase().trim();

  // Tenta encontrar o usuário já cadastrado pelo e-mail
  const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = (usersData?.users || []).find(
    (u) => u.email?.toLowerCase() === normalizedEmail
  );

  if (user) {
    await admin
      .from("profiles")
      .update({
        plan_type: planType,
        plan_expires_at: expiresAt, // null para lifetime
        is_blocked: false,
      })
      .eq("id", user.id);

    return { activated: true, userId: user.id };
  }

  // Usuário ainda não cadastrou — salva para ativar quando ele se registrar
  await admin.from("pending_activations").upsert(
    {
      email: normalizedEmail,
      plan_type: planType,
      plan_expires_at: expiresAt,
      source,
      raw_payload: rawPayload ?? null,
    },
    { onConflict: "email" }
  );

  return { activated: false };
}

/**
 * Detecta o tipo de plano a partir de strings livres (nome de oferta, plano, produto).
 * Retorna null se não conseguir determinar.
 */
export function detectPlanType(
  ...hints: (string | null | undefined)[]
): PlanType | null {
  const combined = hints.filter(Boolean).join(" ").toLowerCase();
  if (combined.includes("anual") || combined.includes("annual") || combined.includes("yearly")) return "annual";
  if (combined.includes("mensal") || combined.includes("monthly") || combined.includes("month")) return "monthly";
  return null;
}
