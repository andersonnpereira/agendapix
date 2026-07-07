-- Bot: parar de encaminhar toda mensagem do cliente pro numero de notificacao
-- depois que o proprio profissional ja respondeu manualmente a conversa.
-- Rodar uma vez no SQL editor do Supabase.

ALTER TABLE public.bot_conversations
  ADD COLUMN IF NOT EXISTS human_owner_engaged boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bot_conversations.human_owner_engaged IS
  'true quando o proprio profissional ja respondeu manualmente essa conversa (fromMe) — a partir daí o bot para de encaminhar cada mensagem do cliente pro numero de notificação, pois ele já está acompanhando pessoalmente.';
