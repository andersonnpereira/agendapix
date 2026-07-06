-- Bot: detectar resposta manual do profissional (fromMe) e pausar o bot
-- automaticamente, para não atropelar um atendimento humano em andamento.
-- Rodar uma vez no SQL editor do Supabase.

ALTER TABLE public.bot_conversations
  ADD COLUMN IF NOT EXISTS last_outbound_at timestamptz;

COMMENT ON COLUMN public.bot_conversations.last_outbound_at IS
  'Horário do último envio automático nosso (bot/cron/cobrança) para esse telefone — usado para diferenciar o eco desse envio (fromMe) de uma resposta manual do profissional pelo próprio celular.';
