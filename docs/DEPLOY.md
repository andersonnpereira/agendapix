# Deploy — Supabase + Vercel

Guia passo a passo, do zero até o app no ar. Não precisa de provedor de pagamento.

## 1. Supabase (banco + login)

1. Crie uma conta em https://supabase.com e clique em **New project**.
2. Dê um nome, defina uma senha forte para o banco e escolha a região **South America (São Paulo)**.
3. Quando o projeto subir, vá em **SQL Editor** → **New query**.
4. Cole TODO o conteúdo de `supabase/schema.sql` e clique em **Run**.
   Isso cria as tabelas, o Row Level Security e a trigger que cria o perfil no cadastro.
5. Vá em **Project Settings → API** e copie:
   - **Project URL** → vai em `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → vai em `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Em **Authentication → Providers**, confirme que **Email** está habilitado.
   (Opcional: habilite "magic link" para login sem senha.)
7. Em **Authentication → URL Configuration**, depois do deploy, adicione a URL da Vercel
   em **Site URL** e em **Redirect URLs** (ex.: `https://seu-app.vercel.app`).

## 2. Rodar localmente (opcional, recomendado)

```bash
npm install
cp .env.example .env.local
# edite .env.local com as chaves do passo 1 (e SITE_URL = http://localhost:3000)
npm run dev
```

Abra http://localhost:3000, crie uma conta, complete o onboarding e teste o fluxo.

## 3. Subir pro GitHub

```bash
git init
git add .
git commit -m "AgendaPix MVP"
# crie um repositório vazio no GitHub e:
git remote add origin https://github.com/SEU-USUARIO/agendapix.git
git push -u origin main
```

## 4. Vercel (deploy)

1. Crie conta em https://vercel.com e clique em **Add New → Project**.
2. Importe o repositório `agendapix` do GitHub.
3. A Vercel detecta Next.js automaticamente — não precisa mudar build settings.
4. Em **Environment Variables**, adicione as três:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` → a URL final da Vercel (ex.: `https://agendapix.vercel.app`)
5. Clique em **Deploy**.
6. Depois que subir, volte ao Supabase (passo 1.7) e cadastre a URL da Vercel nas
   **Redirect URLs**, senão o login por e-mail não redireciona certo.

## 5. Checklist pós-deploy

- [ ] Consigo criar conta e fazer login na URL de produção.
- [ ] Onboarding salva nome, slug, serviço e disponibilidade.
- [ ] Em Configurações, cadastrei minha chave Pix e a prévia do QR aparece.
- [ ] A página pública `/agendar/meu-slug` abre no celular e mostra meus serviços.
- [ ] Consigo agendar como cliente e o QR/copia-e-cola do Pix aparece no fim.
- [ ] O valor do Pix de teste cai na minha conta quando escaneio (teste com R$ 0,01).
- [ ] Em Cobranças, "Marcar como pago" e "Enviar lembrete" (abre WhatsApp) funcionam.

## Observações importantes

- **Confirmação de pagamento é manual.** Como não há integração bancária, o sistema não
  detecta sozinho que o cliente pagou — você marca como pago. Para um MVP isso é normal e
  até um argumento de venda ("o dinheiro cai direto no seu Pix, a gente não toca nele").
- **Custo:** Supabase e Vercel têm planos gratuitos que aguentam o início de sobra. Você só
  paga domínio próprio se quiser (a URL `.vercel.app` funciona perfeitamente para validar).
- **Antes de divulgar de verdade:** leia `docs/SECURITY.md` sobre restringir os campos
  públicos do perfil (a política de leitura pública do MVP é permissiva).
