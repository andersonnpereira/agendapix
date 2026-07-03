-- ============================================================================
-- MIGRAÇÃO DE INTEGRIDADE DE NEGÓCIO (rodar uma vez no Supabase SQL Editor)
-- ----------------------------------------------------------------------------
-- Impede double-booking a nível de banco: dois agendamentos ativos no mesmo
-- profissional/data/hora passam a ser proibidos por índice único parcial.
-- A verificação SELECT-then-INSERT no /api/booking é apenas otimização; este
-- índice é a garantia real contra corrida (dois clientes no mesmo slot em ms).
--
-- ATENÇÃO: se já existirem duplicatas ativas, a criação falha. Rode antes:
--   SELECT profile_id, date, time, count(*)
--   FROM public.bookings
--   WHERE status IN ('pendente','confirmado')
--   GROUP BY profile_id, date, time HAVING count(*) > 1;
-- e resolva (cancele/exclua) as duplicatas encontradas.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS bookings_no_double_booking_idx
  ON public.bookings (profile_id, date, time)
  WHERE status IN ('pendente', 'confirmado');
