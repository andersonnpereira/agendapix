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

-- ── services ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.services (
  id               uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name             text NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  price_cents      integer NOT NULL DEFAULT 0,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  description      text,
  image_url        text,
  extra_questions  jsonb DEFAULT '[]'::jsonb
);

-- ── profiles ───────────────────────────────────────────────────────────────
-- id referencia auth.users(id); o trigger handle_new_user cria a linha.
CREATE TABLE IF NOT EXISTS public.profiles (
  id                         uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name                       text,
  business_name              text,
  phone                      text,
  slug                       text UNIQUE,
  avatar_url                 text,
  pix_key                    text,
  pix_key_type               text,
  pix_merchant_name          text,
  pix_merchant_city          text,
  notification_email         text,
  whatsapp_provider          text DEFAULT 'mock',
  whatsapp_token             text,
  whatsapp_instance_id       text,
  plan                       text DEFAULT 'free',
  created_at                 timestamptz DEFAULT now(),
  plan_type                  text DEFAULT 'trial',
  plan_expires_at            timestamptz,
  plan_price_cents           integer,
  is_blocked                 boolean DEFAULT false,
  plan_notes                 text,
  msg_confirmacao            text,
  msg_pix                    text,
  msg_lembrete               text,
  bot_enabled                boolean DEFAULT false,
  bot_message                text,
  payment_link               text,
  brand_color                text DEFAULT '#16A34A',
  bio                        text,
  review_link                text,
  cover_url                  text,
  min_notice_hours           integer DEFAULT 1,
  max_advance_days           integer DEFAULT 60,
  daily_booking_limit        integer,
  booking_buffer_minutes     integer DEFAULT 0,
  auto_confirm               boolean DEFAULT false,
  cancel_min_hours           integer DEFAULT 0,
  reminder_hour              integer DEFAULT 8,
  msg_lembrete_hoje          text,
  msg_lembrete_amanha        text,
  msg_cobranca_vencida       text,
  bot_welcome_message        text,
  bot_menu_header            text,
  bot_fallback_message       text,
  bot_fallback_max_tries     integer DEFAULT 2,
  bot_typing_delay_ms        integer DEFAULT 1200,
  bot_session_timeout_min    integer DEFAULT 30,
  bot_business_hours_enabled boolean DEFAULT false,
  bot_hours_start            integer DEFAULT 8,
  bot_hours_end              integer DEFAULT 18,
  bot_business_days          text[] DEFAULT ARRAY['seg','ter','qua','qui','sex'],
  bot_away_message           text,
  bot_human_message          text,
  bot_menu_items             jsonb DEFAULT '[]'::jsonb,
  bot_notify_phone           text,
  bot_flows                  jsonb DEFAULT '[]'::jsonb,
  bot_trigger_mode           text DEFAULT 'keywords',
  bot_trigger_keywords       text[] DEFAULT ARRAY['oi','olá','ola','hi','menu'],
  bot_trigger_new_conv_hours integer DEFAULT 24,
  bot_human_timeout_hours    integer DEFAULT 24,
  ical_token                 uuid NOT NULL DEFAULT gen_random_uuid()
);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_ical_token_idx ON public.profiles(ical_token);

-- ============================================================================
-- ORDEM DE CRIAÇÃO (num banco vazio): profiles → services → availability →
-- bookings → charges → clients → date_overrides → bot_conversations →
-- app_settings → checkout_sessions → pending_activations.
-- Depois rodar: migration_security.sql (RLS) e migration_business.sql
-- (índice anti double-booking + trigger handle_new_user).
-- ============================================================================
