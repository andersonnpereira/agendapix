# Segurança — antes de divulgar

O MVP usa políticas de leitura pública permissivas para funcionar rápido. Antes de
divulgar de verdade, ajuste estes pontos.

## 1. Não exponha o perfil inteiro publicamente

A política `profiles_public_read` no `schema.sql` permite `SELECT` em toda a tabela
`profiles`. Isso é prático no MVP, mas a tabela guarda `phone` e `plan`, que não precisam
ser públicos. Quando for para produção, troque por uma **view** que exponha só o necessário
para a página de agendamento e o pagamento:

```sql
create or replace view public.public_profiles as
select id, slug, business_name, name, avatar_url,
       pix_key, pix_key_type, pix_merchant_name, pix_merchant_city
from public.profiles;
```

E faça a página `/agendar/[slug]` ler dessa view, não da tabela. Depois você pode
restringir a policy da tabela base só ao dono.

## 2. A chave Pix aparece no código "copia e cola" — e tudo bem

O padrão Pix embute a chave do recebedor no próprio BR Code (é assim que o banco do
pagador sabe para quem enviar). Então a chave do profissional fica visível no payload
exibido ao cliente — isso é normal e esperado, igual a qualquer QR Code de Pix impresso
num balcão. Não é um vazamento.

## 3. Validação de horário no servidor

Garanta que a criação do agendamento valide no servidor que o horário escolhido realmente
está dentro da disponibilidade e não está ocupado, para evitar agendamento duplicado por
duas pessoas ao mesmo tempo. Idealmente uma constraint única em (profile_id, date, time).

## 4. Rate limiting na página pública

A rota `/agendar/[slug]` aceita inserts anônimos. Para evitar spam de agendamentos falsos,
considere um campo honeypot e/ou limitar inserts por IP (pode ser feito depois, via
edge function ou um serviço como Upstash).
