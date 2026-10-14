-- CRM: etiquetas (tags) livres por cliente.
-- Rodar uma vez no SQL editor do Supabase.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
