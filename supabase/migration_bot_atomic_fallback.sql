-- Bot: contagem de tentativas invalidas do menu vira uma operacao atomica no
-- banco (ler+incrementar+travar em uma unica transacao), em vez de ler e
-- decidir no codigo da aplicacao. Sem isso, duas mensagens do cliente
-- proximas no tempo (poucos segundos) podem cada uma ler o contador antes da
-- outra escrever, e as duas "cruzam o limite" ao mesmo tempo -- cliente
-- recebendo o aviso de escalonamento repetido (2x, 3x) mesmo com a trava
-- anterior, que so protegia contra duas mensagens IDENTICAS concorrentes,
-- nao duas mensagens diferentes em sequencia rapida.
-- Rodar uma vez no SQL editor do Supabase.

CREATE OR REPLACE FUNCTION bump_bot_fallback(p_profile_id uuid, p_phone text, p_max int)
RETURNS TABLE(old_count int, new_count int)
LANGUAGE plpgsql
AS $$
DECLARE
  v_old int;
  v_new int;
BEGIN
  -- SELECT ... FOR UPDATE trava a linha ate o fim desta transacao; uma
  -- segunda chamada concorrente para o mesmo profile_id+phone espera aqui
  -- e so continua depois que a primeira ja tiver commitado seu incremento.
  SELECT fallback_count INTO v_old
  FROM bot_conversations
  WHERE profile_id = p_profile_id AND phone = p_phone
  FOR UPDATE;

  IF NOT FOUND THEN
    v_old := 0;
    INSERT INTO bot_conversations (profile_id, phone, fallback_count, last_message_at)
    VALUES (p_profile_id, p_phone, 0, now())
    ON CONFLICT (profile_id, phone) DO NOTHING;
  END IF;

  v_new := LEAST(v_old + 1, p_max);

  UPDATE bot_conversations
  SET fallback_count = v_new, last_message_at = now()
  WHERE profile_id = p_profile_id AND phone = p_phone;

  RETURN QUERY SELECT v_old, v_new;
END;
$$;
