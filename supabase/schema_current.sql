-- ============================================================================
-- SCHEMA ATUAL (reconstruído do banco de produção em 2026-07-03)
-- ----------------------------------------------------------------------------
-- Fonte: information_schema.columns do Supabase de produção.
-- Objetivo: disaster recovery / onboarding de dev. Reflete o estado REAL.
-- RLS e policies: ver migration_security.sql. Índices/triggers de negócio:
-- ver migration_business.sql.
-- OBS: a tabela profiles está INCOMPLETA aqui (o dump foi truncado no
-- paste) — completar as colunas restantes a partir de plan_type. Veja o
-- bloco PROFILES no fim.
-- ============================================================================

-- ── app_settings ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  key   text NOT NULL PRIMARY KEY,
  value text NOT NULL DEFAULT ''
);

-- ── availability ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.availability (
  id         uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weekday    integer NOT NULL,
  start_time time NOT NULL,
  end_time   time NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ── bookings ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bookings (
  id                    uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id            uuid REFERENCES public.services(id) ON DELETE SET NULL,
  client_name           text NOT NULL,
  client_phone          text NOT NULL,
  date                  date NOT NULL,
  time                  time NOT NULL,
  status                text NOT NULL DEFAULT 'pendente',
  whatsapp_sent         boolean NOT NULL DEFAULT false,
  created_at            timestamptz DEFAULT now(),
  notes                 text,
  client_id             uuid,
  client_reminder_sent  boolean DEFAULT false,
  client_email          text,
  cancel_token          uuid DEFAULT gen_random_uuid(),
  extra_answers         jsonb
);

-- ── bot_conversations ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bot_conversations (
  id               uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone            text NOT NULL,
  state            text NOT NULL DEFAULT 'idle',
  last_message_at  timestamptz DEFAULT now(),
  fallback_count   integer DEFAULT 0,
  current_flow     text DEFAULT 'main',
  UNIQUE (profile_id, phone)
);

-- ── charges ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.charges (
  id                    uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id            uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  profile_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_name           text,
  client_phone          text,
  description           text,
  amount_cents          integer NOT NULL DEFAULT 0,
  status                text NOT NULL DEFAULT 'pendente',
  pix_payload           text,
  due_date              date,
  paid_at               timestamptz,
  reminders_sent        integer NOT NULL DEFAULT 0,
  recurrence            text NOT NULL DEFAULT 'none',
  next_due_date         date,
  created_at            timestamptz DEFAULT now(),
  scheduled_reminder_at timestamptz,
  auto_reminder         boolean DEFAULT false,
  last_auto_reminder_at timestamptz,
  client_id             uuid,
  send_history          text[],
  recurrence_remaining  integer
);

-- ── checkout_sessions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id         uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email      text NOT NULL,
  plan       text NOT NULL,
  activated  boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  order_nsu  text
);

-- ── clients ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clients (
  id         uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       text NOT NULL,
  phone      text,
  email      text,
  birthdate  date,
  cpf        text,
  address    text,
  notes      text,
  source     text DEFAULT 'link',
  status     text DEFAULT 'ativo',
  created_at timestamptz DEFAULT now()
);

-- ── date_overrides ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.date_overrides (
  id         uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date       date NOT NULL,
  reason     text,
  created_at timestamptz DEFAULT now(),
  date_end   date
);

-- ── pending_activations ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pending_activations (
  id              uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email           text NOT NULL UNIQUE,
  plan_type       text NOT NULL DEFAULT 'monthly',
  plan_expires_at timestamptz,
  source          text DEFAULT 'manual',
  raw_payload     jsonb,
  created_at      timestamptz DEFAULT now()
);

-- ── services (não veio no dump paste, mas referenciada; ver schema.sql base)
-- Estrutura conforme uso no código: id, profile_id, name, description,
-- price_cents, duration_minutes, active, image_url, extra_questions, created_at.

-- ── profiles (INCOMPLETO — completar do dump a partir de plan_type) ─────────
-- Colunas confirmadas no dump:
--   id uuid PK, name text, business_name text, phone text, slug text,
--   avatar_url text, pix_key text, pix_key_type text, pix_merchant_name text,
--   pix_merchant_city text, notification_email text,
--   whatsapp_provider text DEFAULT 'mock', whatsapp_token text,
--   whatsapp_instance_id text, plan text DEFAULT 'free', created_at timestamptz,
--   plan_type text DEFAULT 'trial'
-- FALTAM (do dump truncado): plan_expires_at, is_blocked, brand_color, bio,
--   cover_url, review_link, payment_link, reminder_hour, min_notice_hours,
--   max_advance_days, daily_booking_limit, booking_buffer_minutes,
--   auto_confirm, cancel_min_hours, msg_*, todos os bot_*, ical_token, etc.
-- >>> Colar o restante do dump de profiles para finalizar esta seção. <<<
