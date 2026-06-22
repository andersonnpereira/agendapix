# AgendaPix

Agenda + cobrança Pix para autônomos brasileiros. O cliente agenda sozinho por um
link na bio do Instagram e já recebe o Pix para pagar. Sem provedor de pagamento: o
dinheiro cai direto na conta do profissional, porque o "copia e cola" é gerado a partir
da chave Pix dele mesmo (padrão BR Code do Banco Central).

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind
- **Supabase** (auth + Postgres + RLS)
- **Vercel** (deploy)
- **qrcode.react** (QR Code do Pix)
- Geração de Pix BR Code própria, sem dependência externa (`src/lib/pix.ts`)

## Estado do projeto

**Pronto:** gerador de Pix (testado), schema + RLS, landing, login, onboarding,
dashboard, serviços, disponibilidade, componentes base.

**Falta (ver `docs/PROMPT_CLAUDE_CODE.md`):** Configurações (caixa da chave Pix),
página pública `/agendar/[slug]`, Cobranças, Agenda.

## Começar

1. `npm install`
2. `cp .env.example .env.local` e preencha (ver `docs/DEPLOY.md`, passo 1).
3. Rode o `supabase/schema.sql` no SQL Editor do Supabase.
4. Abra o projeto no Claude Code e cole o prompt de `docs/PROMPT_CLAUDE_CODE.md`
   para completar as 4 páginas que faltam.
5. `npm run dev`.

## Documentação

- `docs/PROMPT_CLAUDE_CODE.md` — prompt mestre para terminar o app.
- `docs/DEPLOY.md` — passo a passo Supabase + Vercel.
- `docs/SECURITY.md` — o que ajustar antes de divulgar.

## Importante

Confirmação de pagamento é **manual** (não há webhook bancário). O profissional marca a
cobrança como paga. Isso é adequado para o MVP e vira até argumento de venda: "o dinheiro
cai direto no seu Pix". Quando crescer, dá para plugar Asaas/Mercado Pago para confirmação
automática — a estrutura já está separada para isso.
