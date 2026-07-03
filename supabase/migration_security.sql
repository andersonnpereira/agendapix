-- ============================================================================
-- MIGRAÇÃO DE SEGURANÇA — RLS (rodar uma vez no Supabase SQL Editor)
-- ----------------------------------------------------------------------------
-- Contexto: as leituras públicas (página de agendamento, cancelamento, slots)
-- foram migradas para o servidor com service role. Portanto as policies
-- "public using(true)" de profiles/bookings podem — e devem — ser fechadas.
-- IMPORTANTE: exige SUPABASE_SERVICE_ROLE_KEY configurada no Vercel (já está),
-- pois o service role ignora RLS e é usado por todas as rotas server-side.
-- ============================================================================

-- ── 1. PROFILES ────────────────────────────────────────────────────────────
-- Token dedicado para assinatura de calendário (iCal), separado do id público.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ical_token uuid NOT NULL DEFAULT gen_random_uuid();
-- gen_random_uuid() é avaliado por linha ao adicionar a coluna → cada perfil
-- existente recebe um token único automaticamente.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_ical_token_idx ON public.profiles(ical_token);

-- Fecha o SELECT público (vazava whatsapp_token, pix_key, e-mail, telefone).
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;

-- Cada usuário lê apenas o próprio perfil (sessão autenticada).
-- Leituras públicas por slug agora passam pelo servidor com service role.
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- ── 2. BOOKINGS ────────────────────────────────────────────────────────────
-- Fecha SELECT público (vazava PII de todos os agendamentos da plataforma)
-- e INSERT público (permitia criar agendamento pulando as validações da API).
-- Leitura de horários ocupados: /api/slots (service role, sem PII).
-- Criação de agendamento: /api/booking (service role, com todas as validações).
DROP POLICY IF EXISTS "bookings_select_public" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_public" ON public.bookings;
-- A policy "bookings_all_own" (auth.uid() = profile_id) permanece — o dono
-- continua lendo/gerenciando os próprios agendamentos no portal.

-- ── 3. CLIENTS ─────────────────────────────────────────────────────────────
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clients_all_own" ON public.clients;
CREATE POLICY "clients_all_own" ON public.clients
  FOR ALL USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

-- ── 4. DATE_OVERRIDES (bloqueios de data) ──────────────────────────────────
ALTER TABLE public.date_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "date_overrides_all_own" ON public.date_overrides;
CREATE POLICY "date_overrides_all_own" ON public.date_overrides
  FOR ALL USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
-- A página pública lê date_overrides via service role (server-side).

-- ── 5. TABELAS DE BILLING/ADMIN — apenas service role ──────────────────────
-- Sem policy = nenhum acesso via anon/authenticated; apenas service role
-- (rotas server-side) e o painel do Supabase enxergam.
ALTER TABLE public.checkout_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_activations ENABLE ROW LEVEL SECURITY;

-- app_settings: se existir, também fica restrita a service role.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'app_settings') THEN
    EXECUTE 'ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- ── 6. BOT_CONVERSATIONS ───────────────────────────────────────────────────
-- Já possui policy service-role ("bot_conv_service"). Garante RLS ligada.
ALTER TABLE public.bot_conversations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Verificação pós-migração (opcional): rode para conferir que profiles/bookings
-- não têm mais policy "public":
--   SELECT tablename, policyname, cmd, qual
--   FROM pg_policies WHERE schemaname='public'
--   ORDER BY tablename, policyname;
-- ============================================================================
