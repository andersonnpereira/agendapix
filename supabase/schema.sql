-- =====================================================================
-- AgendaPix - Schema Supabase (v2)
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute (RUN).
-- =====================================================================

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  name                text,
  business_name       text,
  phone               text,
  slug                text unique,
  avatar_url          text,
  pix_key             text,
  pix_key_type        text check (pix_key_type in ('celular','email','cpf_cnpj','aleatoria')),
  pix_merchant_name   text,
  pix_merchant_city   text,
  notification_email  text,                     -- e-mail para receber alertas de novo agendamento
  whatsapp_provider   text default 'mock'
    check (whatsapp_provider in ('mock','zapi','evolution','ultramsg')),
  whatsapp_token      text,
  whatsapp_instance_id text,
  plan                text default 'free',
  created_at          timestamptz default now()
);

-- ---------- SERVICES ----------
create table if not exists public.services (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  name             text not null,
  duration_minutes int  not null default 60,
  price_cents      int  not null default 0,
  active           boolean not null default true,
  created_at       timestamptz default now()
);
create index if not exists services_profile_idx on public.services(profile_id);

-- ---------- AVAILABILITY ----------
create table if not exists public.availability (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  weekday    int  not null check (weekday between 0 and 6),  -- 0=domingo
  start_time time not null,
  end_time   time not null,
  created_at timestamptz default now()
);
create index if not exists availability_profile_idx on public.availability(profile_id);

-- ---------- BOOKINGS ----------
create table if not exists public.bookings (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  service_id   uuid references public.services(id) on delete set null,
  client_name  text not null,
  client_phone text not null,
  date         date not null,
  time         time not null,
  status       text not null default 'pendente'
    check (status in ('pendente','confirmado','concluido','cancelado')),
  whatsapp_sent boolean not null default false,  -- confirmação de WA enviada
  created_at   timestamptz default now()
);
create index if not exists bookings_profile_idx on public.bookings(profile_id);
create index if not exists bookings_date_idx    on public.bookings(profile_id, date);

-- ---------- CHARGES ----------
create table if not exists public.charges (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid references public.bookings(id) on delete set null,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  client_name   text,
  client_phone  text,
  description   text,
  amount_cents  int  not null default 0,
  status        text not null default 'pendente'
    check (status in ('pendente','pago','atrasado')),
  pix_payload   text,
  due_date      date,
  paid_at       timestamptz,
  reminders_sent int not null default 0,
  recurrence    text not null default 'none'
    check (recurrence in ('none','weekly','biweekly','monthly')),
  next_due_date date,
  created_at    timestamptz default now()
);
create index if not exists charges_profile_idx on public.charges(profile_id);
create index if not exists charges_due_idx     on public.charges(profile_id, due_date);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles     enable row level security;
alter table public.services     enable row level security;
alter table public.availability enable row level security;
alter table public.bookings     enable row level security;
alter table public.charges      enable row level security;

-- PROFILES: dono gerencia o próprio; leitura pública por slug (página de agendamento)
drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public" on public.profiles
  for select using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- SERVICES: dono gerencia tudo; público lê serviços ativos
drop policy if exists "services_all_own" on public.services;
create policy "services_all_own" on public.services
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists "services_select_public" on public.services;
create policy "services_select_public" on public.services
  for select using (active = true);

-- AVAILABILITY: dono gerencia; público lê para calcular horários livres
drop policy if exists "availability_all_own" on public.availability;
create policy "availability_all_own" on public.availability
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists "availability_select_public" on public.availability;
create policy "availability_select_public" on public.availability
  for select using (true);

-- BOOKINGS: dono vê/gerencia; público cria (cliente agenda) e lê p/ calcular slots
drop policy if exists "bookings_all_own" on public.bookings;
create policy "bookings_all_own" on public.bookings
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists "bookings_insert_public" on public.bookings;
create policy "bookings_insert_public" on public.bookings
  for insert with check (true);

drop policy if exists "bookings_select_public" on public.bookings;
create policy "bookings_select_public" on public.bookings
  for select using (true);

-- CHARGES: dono gerencia tudo
drop policy if exists "charges_all_own" on public.charges;
create policy "charges_all_own" on public.charges
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

-- =====================================================================
-- TRIGGER: cria profile automaticamente quando usuário se cadastra
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- NOTA DE SEGURANÇA:
-- bookings_insert_public e bookings_select_public são abertas para o MVP.
-- Antes de escalar, mova criação de bookings para uma Edge Function com
-- service_role e restrinja as policies para evitar inserções indevidas.
-- =====================================================================
