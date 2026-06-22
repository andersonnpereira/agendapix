# Prompt mestre — AgendaPix (colar no Claude Code)

> Cole o bloco abaixo no Claude Code, **na raiz do projeto `agendapix`**.
> Ele NÃO reconstrói o que já existe — só completa o que falta.

---

```
Você está retomando o projeto Next.js "AgendaPix" (App Router, TypeScript, Tailwind,
Supabase via @supabase/ssr, qrcode.react). NÃO recrie arquivos que já existem nem mude
a stack. Sua tarefa é COMPLETAR as partes que faltam, reaproveitando os helpers já prontos.

== O QUE JÁ ESTÁ PRONTO (não mexer, só usar) ==
- src/lib/pix.ts  → generatePixBRCode(), normalizePixKey(), validatePixKey(), crc16().
  Gera o "copia e cola" Pix estático a partir da chave do próprio profissional. JÁ TESTADO.
- src/lib/format.ts → formatBRL(cents), parseToCents(str), slugify(str), WEEKDAYS[].
- src/lib/supabase-server.ts → createClient() para Server Components.
- src/lib/supabase-browser.ts → client para Client Components.
- src/components/PixDisplay.tsx → mostra QR + botão "Copiar código Pix" (recebe `payload`, `amountLabel`).
- src/components/CopyLinkButton.tsx, SignOutButton.tsx.
- src/middleware.ts → protege as rotas autenticadas.
- supabase/schema.sql → tabelas profiles, services, availability, bookings, charges + RLS + trigger.
- Páginas prontas: / (landing), /login, /onboarding, (app)/dashboard, (app)/servicos, (app)/disponibilidade.
- Classes CSS utilitárias já existem em globals.css: .btn-primary, .btn-ghost, .btn, .card, text-brand, bg-brand, bg-brand-dark.

== O QUE FALTA (sua tarefa — estas 4 páginas estão com a PASTA VAZIA) ==

1) src/app/(app)/configuracoes/page.tsx  — PRIORIDADE: a caixa da chave Pix
   - Formulário para o profissional cadastrar/editar:
     * pix_key (input) + pix_key_type (select: Celular, E-mail, CPF/CNPJ, Aleatória)
     * pix_merchant_name, pix_merchant_city
     * name, business_name, phone, slug, avatar_url
   - Valide a chave com validatePixKey() antes de salvar; normalize com normalizePixKey().
   - PRÉVIA AO VIVO: ao preencher a chave, mostre um <PixDisplay> com um código de teste
     gerado por generatePixBRCode({ pixKey: normalizado, amount: 1, merchantName, merchantCity, txid: "TESTE" }).
   - Botão para copiar o link público: `${NEXT_PUBLIC_SITE_URL}/agendar/{slug}` (use CopyLinkButton).
   - Salva em profiles (upsert pelo id = auth user). Server action ou client + supabase-browser.

2) src/app/agendar/[slug]/page.tsx  — A PÁGINA PÚBLICA (coração do produto, SEM login)
   - Server Component: lê o profile pelo slug (apenas campos necessários), os services ativos,
     e a availability. Se slug não existe → notFound().
   - Mobile-first, visual caprichado (é a "vitrine" do profissional). Mostra nome/business + avatar.
   - Fluxo do cliente (Client Component): escolher serviço → escolher data/horário livre
     (slots = availability do weekday menos bookings já existentes naquele dia/serviço) →
     digitar nome + WhatsApp → confirmar.
   - Ao confirmar (server action ou route handler):
       a) cria booking (status 'pendente')
       b) cria charge: amount_cents = price do serviço; gera pix_payload com
          generatePixBRCode({ pixKey, amount: preço em reais, merchantName: pix_merchant_name,
          merchantCity: pix_merchant_city, txid: id curto da cobrança })
       c) tela de confirmação amigável com <PixDisplay payload={pix_payload} amountLabel={formatBRL(...)} />
          e texto "Pague agora pelo Pix ou no atendimento".
   - IMPORTANTE: a chave/cidade/nome Pix do profissional precisam estar acessíveis no server
     para gerar o payload. Como o insert do cliente é anônimo, gere o pix_payload no SERVIDOR
     (server action/route handler) lendo o profile por slug, NUNCA expondo a chave no client além
     do necessário para exibir o QR final.

3) src/app/(app)/agenda/page.tsx
   - Lista os bookings do profissional (filtro por status e por data). Visões: hoje / próximos.
   - Ações: confirmar, cancelar, marcar como concluído (update em bookings.status).
   - Mostrar nome do cliente, serviço, data/hora, status (badge colorido).

4) src/app/(app)/cobrancas/page.tsx
   - Lista charges do profissional com badge de status (pendente / pago / atrasado).
   - Filtro por status + visão "Quem está devendo" (status != pago).
   - Botão "Marcar como pago" (update status='pago', paid_at=now()).
   - Botão "Nova cobrança" (cria charge avulsa: valor + cliente, gera pix_payload).
   - Botão "Enviar lembrete": abre wa.me com mensagem pronta + código Pix:
       https://wa.me/55{telefone}?text={mensagem url-encoded incluindo o pix_payload}
     e incrementa reminders_sent. (Sem API de WhatsApp — só abre o app com tudo digitado.)
   - Ao tocar numa cobrança, abre o QR + copia e cola (<PixDisplay>).

== AJUSTE TÉCNICO NO GERADOR PIX (fazer 1 vez) ==
Em src/lib/pix.ts, no generatePixBRCode, adicione o campo Point of Initiation Method logo após
o Payload Format Indicator: emv("01","11")  // 11 = estático reutilizável.
Vários bancos preferem que ele esteja presente. Recalcule o CRC normalmente (a função já cobre).
Depois, crie src/lib/pix.test.ts (ou um script em scripts/) que verifique:
  (a) o CRC se auto-valida: code.slice(-4) === crc16(code.slice(0,-4));
  (b) o código começa com "00020101021126" e contém "br.gov.bcb.pix".

== REGRAS GERAIS ==
- Todo texto de interface em português do Brasil. Moeda com formatBRL.
- Respeite o RLS: o profissional só enxerga os próprios dados; a página pública lê por slug.
- Não invente segredos. Use as envs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SITE_URL.
- Confirmação de pagamento é MANUAL (não há webhook bancário). Deixe isso claro na UI das cobranças.
- Reaproveite .btn-primary/.btn-ghost/.card e a cor "brand". Não introduza outra lib de UI.
- Empty states úteis (ex.: "Você ainda não tem agendamentos — compartilhe seu link na bio").

== ORDEM SUGERIDA ==
1. Ajuste o pix.ts (campo 01) + teste.  2. Configurações (chave Pix).  3. Página pública /agendar/[slug].
4. Cobranças.  5. Agenda.  6. `npm run build` e corrija o que aparecer.

Ao terminar cada página, rode `npm run build` para garantir que compila antes de seguir.
```

---

## Como usar

1. Abra a pasta `agendapix` no Claude Code (ou VS Code com a extensão).
2. Rode `npm install` uma vez.
3. Copie `.env.example` para `.env.local` e preencha com as chaves do seu Supabase.
4. Cole o bloco acima no Claude Code e deixe ele completar as 4 páginas.
5. `npm run dev` para testar localmente. Deploy: ver `docs/DEPLOY.md`.
