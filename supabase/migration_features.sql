-- Rodar no Supabase SQL Editor

-- 1. Planos de clientes (Admin)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_type text DEFAULT 'trial'
  CHECK (plan_type IN ('trial', 'monthly', 'annual', 'lifetime'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_price_cents integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_notes text;

-- 2. Mensagens customizadas WhatsApp
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS msg_confirmacao text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS msg_pix text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS msg_lembrete text;

-- 3. Lembretes automáticos agendados
ALTER TABLE charges ADD COLUMN IF NOT EXISTS scheduled_reminder_at timestamptz;
ALTER TABLE charges ADD COLUMN IF NOT EXISTS auto_reminder boolean DEFAULT false;
ALTER TABLE charges ADD COLUMN IF NOT EXISTS last_auto_reminder_at timestamptz;
