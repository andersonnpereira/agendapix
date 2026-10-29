-- Bot: detecção de "resposta manual do profissional" por CONTEÚDO (não por
-- tempo). Guarda os textos recentes que o bot enviou, para diferenciar o eco
-- da nossa própria mensagem (texto igual) de uma resposta manual do dono
-- (texto diferente) — mesmo que ela chegue poucos segundos depois.
-- Rodar uma vez no SQL editor do Supabase.

ALTER TABLE public.bot_conversations
  ADD COLUMN IF NOT EXISTS last_outbound_texts text[] NOT NULL DEFAULT '{}';
