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

-- ============================================================================
-- TRIGGER: aplica plano pago comprado ANTES do cadastro
-- ----------------------------------------------------------------------------
-- Quando alguém paga (Hotmart/Kiwify/InfinitPay) sem ter conta, o webhook
-- grava em pending_activations. Este trigger, ao criar o usuário, cria o
-- profile já com o plano pago (se houver pendência para o e-mail) e remove a
-- pendência. Sem isso, o comprador se cadastra e nunca recebe o plano.
-- Substitui o handle_new_user anterior (que só criava profile em branco).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  pending public.pending_activations%ROWTYPE;
BEGIN
  SELECT * INTO pending
  FROM public.pending_activations
  WHERE lower(email) = lower(new.email)
  LIMIT 1;

  IF pending.email IS NOT NULL THEN
    -- Comprou antes de se cadastrar → já entra com o plano pago
    INSERT INTO public.profiles (id, name, plan_type, plan_expires_at, is_blocked)
    VALUES (
      new.id,
      coalesce(new.raw_user_meta_data->>'name', ''),
      pending.plan_type,
      pending.plan_expires_at,   -- null para lifetime
      false
    )
    ON CONFLICT (id) DO UPDATE
      SET plan_type = excluded.plan_type,
          plan_expires_at = excluded.plan_expires_at,
          is_blocked = false;

    DELETE FROM public.pending_activations WHERE lower(email) = lower(new.email);
  ELSE
    -- Cadastro normal → profile em branco (onboarding define o trial)
    INSERT INTO public.profiles (id, name)
    VALUES (new.id, coalesce(new.raw_user_meta_data->>'name', ''))
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

-- O trigger on_auth_user_created já aponta para handle_new_user; recriar a
-- função acima é suficiente. (Recriado por garantia.)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
