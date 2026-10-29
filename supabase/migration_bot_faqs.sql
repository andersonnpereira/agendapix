-- Bot: FAQ automática (respostas por palavra-chave).
-- Rodar uma vez no SQL editor do Supabase.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bot_faqs jsonb NOT NULL DEFAULT '[]';
