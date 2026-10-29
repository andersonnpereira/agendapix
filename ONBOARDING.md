# AgendaPix ("Agendou") — Guia de continuidade do projeto

Documento de handoff para qualquer IA / sessão de Claude Code (em qualquer conta) assumir este projeto sem perder contexto. **Princípio:** nenhum segredo/senha real é escrito aqui — só os nomes das variáveis e ONDE encontrá-las. (Exceção histórica: ver nota de segurança na seção 11.)

> Última revisão grande: migração da Evolution API para AWS + correções do bot + fix da descrição de cobrança. Confira sempre o `git log` para o que veio depois.

## 1. O que é o projeto

> ⚠️ **CONVERTIDO PARA USO PESSOAL (out/2026).** Era um SaaS multi-cliente; o Anderson passou a usar só pra ele mesmo (cobrança de IPTV). Nas Fases 1–2 foram **REMOVIDOS**: todo o agendamento (agenda, serviços, disponibilidade, página pública `/agendar/[slug]`, cancelamento, APIs booking/slots/ical/cron appointment-reminders) e toda a máquina de SaaS (landing de marketing, `/plano`, `/onboarding`, `/admin`, checkout, webhooks de pagamento infinitpay/hotmart/kiwify, `lib/plan-activation`, trava de plano no layout). A raiz `/` redireciona pro app. **Não reintroduzir** essas partes. O que ficou e é usado: **cobranças + lembretes + clientes (CRM) + bot de WhatsApp**. As tabelas de agendamento (`bookings`, `services`, `availability`, `date_overrides`) ficaram paradas no banco (não dropadas).

O núcleo (uso atual): **cobrança via Pix + lembretes automáticos + cadastro de clientes + automação/bot de WhatsApp**, do próprio número do dono. O cliente final paga via Pix (chave do próprio dono, sem intermediário/taxa).

- **Domínio de produção:** https://agendasj.vercel.app
- **Repositório GitHub:** https://github.com/andersonnpereira/agendapix (conta GitHub: `andersonnpereira`)
- **Diretório local:** `C:\Users\Anderson\OneDrive - GRUPO JCN\Área de Trabalho\agendapix`
- **Dono do produto:** Anderson Pereira (anderson.pereira@grupojcn.com.br)
- **Deploy:** `git push origin main` → deploy automático na Vercel (a Vercel está ligada a esse repo). Não há branch de staging — `main` é produção.

## 2. Stack

Next.js 14 (App Router) + TypeScript + TailwindCSS · Supabase (Postgres + Auth + Storage; usa client service-role "admin" para operações de servidor) · Evolution API self-hosted (WhatsApp, Baileys por baixo) · Resend (e-mail) · cron-job.org (agenda os crons) · Vercel (hosting/deploy) · InfinitPay (pagamento das assinaturas).

## 3. Contas e onde ficam as credenciais

Valores reais NÃO estão aqui — só a localização:

- **GitHub:** conta `andersonnpereira`, repo `andersonnpereira/agendapix`.
- **Vercel** (deploy + variáveis de ambiente): projeto que publica em `agendasj.vercel.app`, ligado ao GitHub acima. Variáveis: `NEXT_PUBLIC_SITE_URL` (= `https://agendasj.vercel.app`), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `INFINITPAY_WEBHOOK_SECRET`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `WHATSAPP_PROVIDER`, `WHATSAPP_TOKEN`, `WHATSAPP_INSTANCE_ID`, `RESEND_API_KEY`, `RESEND_FROM`, `SUPPORT_EMAIL`.
- **Supabase:** projeto ref `dpufvtoqxyqylppvnxsr` (`https://dpufvtoqxyqylppvnxsr.supabase.co`). **Logado via GitHub com a conta Google `andersonnpereira@gmail.com`** (atenção: já houve confusão tentando logar com `playtecnologia01@gmail.com`, que é a conta ERRADA). Schema real documentado em `supabase/schema_current.sql`.
- **Evolution API (WhatsApp):** self-hosted em VM da AWS — detalhes completos na seção 6. O profissional conecta o WhatsApp dele via QR na tela de Configurações do app.
- **cron-job.org:** 2 jobs, `GET` a cada hora (`0 * * * *`), com header `Authorization: Bearer <CRON_SECRET>` (sem o header = 401 e nada é enviado):
  - `https://agendasj.vercel.app/api/cron/reminders` — lembretes/cobranças
  - `https://agendasj.vercel.app/api/cron/appointment-reminders` — lembrete de agendamento (D-1)
- **InfinitPay:** processa as assinaturas da plataforma. Webhook: `.../api/webhook/infinitpay?plan=monthly` / `?plan=annual` + `&secret=<INFINITPAY_WEBHOOK_SECRET>`.

## 4. Decisões e armadilhas (não redescobrir isso do zero)

- **Next.js Data Cache quebra crons:** toda rota de cron/webhook precisa de `export const dynamic = "force-dynamic"` e `export const fetchCache = "force-no-store"`, senão o Vercel serve resposta cacheada (`X-Vercel-Cache: HIT`) e a função nunca executa. O `src/lib/supabase-admin.ts` já força `cache: "no-store"`.
- **RLS fechado de propósito:** `profiles`/`bookings` NÃO têm `select using(true)` (vazava PII/tokens). Leituras públicas (`/agendar/[slug]`, `/cancelar/[token]`) usam o client admin no servidor; horários ocupados vêm de `/api/slots` (sem PII). Não reabrir sem entender o porquê.
- **Webhooks/crons são fail-closed:** sem o secret, retornam 503. Já quebrou `/api/checkout/start` uma vez (parou de incluir o secret na URL do webhook) — vigiar ao mexer em auth de webhook.
- **Fuso BRT:** `new Date(y,m,d,h,min)` + "hora de parede BRT tratada como UTC" está CORRETO no runtime UTC do Vercel (o offset se cancela). É falso positivo de auditoria — não "corrigir".
- **Preços reais:** mensal R$ 19,90, anual R$ 179,90 (R$ 14,99/mês). Todos os planos (inclusive trial de 7 dias) têm os MESMOS recursos — não diferenciar features por plano no marketing.
- **Antes de commitar:** `npx tsc --noEmit` tem que passar limpo. Sempre `git push origin main` ao final (deploy automático) — é o comportamento esperado, não perguntar antes.
- **Descrição de cobrança vazia NÃO deve escrever a palavra "Serviço"** na mensagem. `formatTemplate` (em `src/lib/whatsapp.ts`) suporta blocos opcionais `[[...]]` que somem quando a variável dentro está vazia; os templates padrão de cobrança envolvem o `{servico}` nesses blocos. Todos os pontos de envio passam descrição vazia (não "Serviço") quando o campo está em branco, e o form grava `null`.

## 5. O bot de WhatsApp — máquina de estados (MUITO iterado; leia antes de mexer)

Arquivo central: `src/lib/whatsapp-bot.ts`. Webhook de entrada: `src/app/api/whatsapp-incoming/[userId]/route.ts`. Estado por conversa na tabela `bot_conversations` (chave `profile_id + phone`). Estados: `idle` → `menu` (opções numeradas) → `human` (silêncio) · `cobranca_lookup` · `faq_menu` (lista de dúvidas).

Regras já resolvidas — **não reintroduzir estes bugs** (cada um veio de um caso real reportado com print):

- **Endereçamento `@lid` (IMPORTANTE):** o WhatsApp migrou pro JID novo `@lid` (privacidade). O webhook NÃO pode rejeitar `@lid` — é nele que chegam as respostas manuais do dono (fromMe) e, cada vez mais, mensagens de clientes. `extractRealPhone` (no route do webhook) resolve o telefone real dos campos auxiliares (`senderPn`/`remoteJidAlt`/`participantAlt`). Só rejeitar grupos (`@g.us`), newsletter e status/broadcast. Rejeitar `@lid` fazia o bot nunca saber que o humano entrou e responder por cima.
- **Detecção de resposta manual por CONTEÚDO, não por tempo:** `handleOwnerOutbound` recebe o texto do fromMe e compara com `last_outbound_texts` (últimos ~12 textos que o bot enviou, por conversa). Texto igual = eco do próprio bot (ignora); texto diferente = resposta manual real → pausa. A antiga "janela de 30s" por tempo falhava quando o dono respondia rápido (confundia com o eco). `markOutboundSent(profileId, phone, text?)` grava o texto; TODO ponto de envio (reply do bot, cron de cobrança, cobrança manual) passa o texto.
- **`human_owner_engaged`** (coluna): vira `true` quando o profissional responde manualmente a conversa. A partir daí o bot **para de encaminhar cada mensagem do cliente** pro número de notificação. **Expira após 12h** sem nova interação (`OWNER_ENGAGED_DECAY_HOURS`).
- **`last_outbound_at` / `last_outbound_texts`** (colunas): gravadas a cada envio do SISTEMA. Usadas por `handleOwnerOutbound` para diferenciar eco × resposta manual (ver acima).
- **FAQ automática** (`bot_faqs jsonb` em profiles): cada item `{keywords[], answer, imageUrl?, title?}`. `matchFaq` responde na hora quando o cliente escreve uma palavra-chave (sem acento, substring); funciona a frio (ativa o bot) e no meio do menu (não conta tentativa). NÃO dispara em `human` nem `cobranca_lookup`. Tendo ≥1 FAQ, o bot injeta automaticamente a opção "❓ Dúvidas frequentes" (ação `faq` → estado `faq_menu`) no fim do menu principal. Editável em Configurações → "Respostas automáticas".
- **Seleção de opção por palavra:** `matchMenuByText` casa a mensagem (sem acento) contra palavras do título e `keywords[]` do item; só aceita se houver UM casamento (ambíguo → fallback, não chuta). Roda depois de tentar pelo número.
- **Contagem de tentativas inválidas do menu é ATÔMICA no banco** via função Postgres `bump_bot_fallback(profile_id, phone, max)` (`SELECT ... FOR UPDATE` + `UPDATE` numa transação). Isso existe porque duas mensagens DIFERENTES do cliente em poucos segundos conseguiam, cada uma, "cruzar o limite" antes da outra gravar, e o cliente recebia o aviso de escalonamento 2-3x (confirmado nos logs do servidor). NÃO voltar a ler/decidir/gravar o contador no código da aplicação.
- Ao cruzar o limite: avisa UMA vez ("vou te encaminhar") e **permanece em `menu`** (não vai pra `human`). Se o cliente digitar uma opção válida depois, o bot continua ajudando. Só silencia de vez se: (a) cliente pede "falar com atendente" explicitamente, ou (b) profissional responde manualmente (`fromMe`).
- **Cumprimentos soltos** ("oi", "boa tarde"… lista `PLEASANTRIES`) no meio do menu NÃO contam como tentativa inválida — só reenviam o menu (cliente costuma mandar cumprimento e pergunta em mensagens separadas).
- **Gatilho de ativação** (`bot_trigger_mode`/`bot_trigger_keywords`): só `menu`/`0`/`reiniciar`/`restart`/`início` sempre reabrem o bot a frio; o resto respeita a config do profissional (não hardcodar bypass).
- **`notifyOwner` notifica SÓ por WhatsApp** (o Anderson pediu explicitamente para NÃO usar e-mail — já foi tentado e revertido). Normaliza o número e tenta 2x antes de desistir. ⚠️ A notificação NATIVA do WhatsApp no celular do profissional pode não aparecer quando há uma sessão de API (Evolution) conectada no mesmo número — isso é limitação do WhatsApp/Evolution, fora do controle do código; por isso o `bot_notify_phone` (número dedicado de avisos) é o canal confiável.
- **Piso de silêncio (`QUIET_HOUR_END = 6`):** nenhuma mensagem automática (bot ou cron) sai entre meia-noite e 6h BRT.
- **Cobrança antecipada recorrente:** o horário escolhido pelo profissional (`scheduled_reminder_at`) é respeitado TODO dia que a cobrança se repete, não só no 1º (senão a partir do 2º dia dispara às 6h).
- **Grupos:** o webhook ignora qualquer coisa que não seja `@s.whatsapp.net` (grupos `@g.us`, newsletters, status etc. nunca ativam o bot).

## 6. Infraestrutura da Evolution API (self-host — servidor ATUAL: AWS)

Histórico: hosting original (trial) expirou → Oracle Cloud grátis → **Oracle caiu/ficou inacessível** (VM travou por memória + perda de acesso ao painel) → **AWS Free Tier, servidor em uso hoje**. Todo o setup foi feito via SSH direto pelo Claude Code (a sessão roda na máquina do Anderson, então o SSH sai de lá).

**Servidor atual (AWS):**
- **AWS EC2 Free Tier** (plano gratuito 6 meses + US$100 crédito; o plano gratuito **se auto-encerra em vez de cobrar** → baixo risco de cobrança surpresa). Conta root `andersonnpereira@gmail.com`, região `us-east-2` (Ohio), instância `evolution-api` (`t3.micro`, 1GB RAM + swapfile de 3GB em `/swapfile`). IP público `18.221.150.94`. Chave SSH em `C:\Users\Anderson\Downloads\Video\videos curtos\evolution-key.pem` (.pem/RSA), usuário `ubuntu`.
- **URL pública:** `https://18-221-150-94.nip.io` (nip.io resolve `X-Y-Z-W.nip.io` → IP `X.Y.Z.W`, sem domínio próprio; Caddy faz HTTPS automático via Let's Encrypt).
- **Vercel:** `EVOLUTION_API_URL=https://18-221-150-94.nip.io`. `EVOLUTION_API_KEY` tem que bater EXATAMENTE com `AUTHENTICATION_API_KEY` do docker-compose no servidor (se editar por engano, restaurar o valor que está no servidor).
- **Stack:** `~/evolution/docker-compose.yml` na VM — Postgres 15 + `evoapicloud/evolution-api:latest` (⚠️ NÃO `atendai/evolution-api`, não existe mais) + Caddy 2. **Blindagem de memória** (o que faltou na Oracle e a fez travar): `mem_limit` por container (postgres 256m / evolution 512m / caddy 128m), swap 3GB, histórico reduzido (`DATABASE_SAVE_DATA_NEW_MESSAGE=false`, `SAVE_DATA_CHATS=false`).
- **Firewall:** na AWS as portas 22/80/443 são abertas na criação da instância (marcar "Allow SSH/HTTP/HTTPS" no assistente) — o Security Group já fica certo, sem mexer em iptables nem painel separado (diferente da Oracle, que exigia os dois).
- **Reconectar/adicionar profissional:** só Configurações → escanear QR → "Configurar webhook" (o botão existe na tela; sem ele o WhatsApp conecta mas o bot não recebe as mensagens). Não precisa mexer no servidor.
- **Diagnóstico:** com a chave SSH dá pra entrar no servidor e ver `sudo docker logs evolution-evolution-api-1` — foi assim que vários bugs do bot foram confirmados (em vez de adivinhar por print). Checar instâncias/conexão: `curl -s https://18-221-150-94.nip.io/instance/fetchInstances -H "apikey: <EVOLUTION_API_KEY>"`.

**Se a AWS expirar (6 meses) ou cair:** grátis + sempre-ligado + fora da máquina do usuário praticamente não existe mais (Render dorme → mata o WhatsApp; Fly/Railway viraram pago; Google Cloud/BR exige pré-pagamento de R$150; Oracle é instável e bloqueia 2ª conta; celular Android é possível via Termux mas frágil — o Anderson descartou rodar no PC). A saída realista e definitiva é **VPS pago barato (~R$25/mês, ex: Hetzner 4GB)**. O Anderson vai adiar isso até "escalar". Servidor Oracle antigo (`163-176-39-0.nip.io`) está MORTO — não tentar usar.

## 7. Migrações SQL (rodar no SQL Editor do Supabase)

Arquivos `supabase/migration_*.sql` — cada um se documenta no topo. Ao ler o código, **confirmar se a migração correspondente já foi rodada** antes de assumir que uma coluna/função existe (perguntar ao Anderson na dúvida). Principais, em ordem aproximada:
- `migration_security.sql` — RLS fechado, coluna `ical_token`.
- `migration_business.sql` — índice anti-double-booking, trigger `handle_new_user` (consome `pending_activations`), colunas `terms_accepted_at`/`terms_version`.
- `migration_features.sql` — colunas de features.
- `migration_bot_human_pause.sql` — coluna `last_outbound_at` em `bot_conversations`.
- `migration_bot_owner_engaged.sql` — coluna `human_owner_engaged`.
- `migration_bot_atomic_fallback.sql` — função `bump_bot_fallback()`.
- `migration_bot_outbound_texts.sql` — coluna `last_outbound_texts` (detecção de resposta manual por conteúdo). **Rodada out/2026.**
- `migration_bot_faqs.sql` — coluna `bot_faqs jsonb` em `profiles` (FAQ automática). **Rodada out/2026.**
- `migration_clientes_tags.sql` — coluna `tags text[]` em `clients` (etiquetas do CRM). **Rodada out/2026.**
- `schema_current.sql` — snapshot do schema real (disaster recovery / referência de colunas).

## 8. Legal / LGPD (já implementado)

- Termos de Uso com foro em **São João da Boa Vista/SP**; cláusula de responsabilidade exclusiva do contratante; papéis LGPD (contratante = Controlador dos dados dos clientes finais, Agendou = Operador).
- Cadastro exige **aceite explícito dos Termos** (checkbox obrigatório) e grava `terms_accepted_at`/`terms_version` em `profiles` (visível no Admin → Clientes).
- Formulário de contato/suporte usa **e-mail** (`SUPPORT_EMAIL`), NÃO WhatsApp — o Anderson reverteu explicitamente de WhatsApp para e-mail; não trocar sem pedido.
- ⚠️ As cláusulas foram redigidas sem advogado — recomendado revisão jurídica profissional (limitação de responsabilidade/indenização têm limites no CDC quando o contratante é consumidor).

## 9. Fluxo de trabalho com o Anderson (como ele opera)

1. Ele testa em produção com clientes reais e reporta **prints de conversas do WhatsApp Business Web**. Ao analisar, cuidado com quem é `fromMe` (ele/sistema) vs cliente antes de concluir causa raiz.
2. Prefere verificar mudanças de UI no preview (`.claude/launch.json`, nome `agendapix`) — mas páginas em `(app)/` exigem login, então a verificação logada é limitada sem conta de teste.
3. Toda migração SQL nova: deixar claro que ele precisa rodar antes de considerar o fix "ativo".
4. Comunicação em português, direto ao ponto, honesto sobre limitações e custos.

## 10. Melhorias já entregues (Fase 3 + bot, out/2026)

- **Dashboard** reconstruído como painel de cobrança (a receber hoje/semana, atraso, recebido no mês, aniversariantes, listas de vencem-hoje/atrasadas).
- **Financeiro:** MRR (receita recorrente estimada), ranking "clientes que mais pagaram", filtro por status na lista + paginação "ver mais" (fim do corte silencioso em 100). Card "A receber" só do mês atual.
- **CRM (clientes):** etiquetas/tags (filtro + sugestões), ordenação (A–Z / recentes / maior gasto), exportar CSV, detecção de duplicados por telefone, total gasto por cliente.
- **Bot:** entende opção por palavra, FAQ automática (palavra-chave + opção "Dúvidas frequentes"), e detecção de resposta manual por conteúdo (ver seção 5).

Pendências abertas: nenhuma crítica. Possível futuro: comprovante de pagamento, histórico de notas com data no CRM.

## 11. ⚠️ Nota de segurança (pendência real)

- **RESOLVIDO (out/2026):** o git remote não embute mais token — passou a `https://github.com/andersonnpereira/agendapix.git` usando o Git Credential Manager do Windows (conta `andersonnpereira`). Se aparecer erro 403 "denied to playtecnologia01-sketch", é a conta Google errada autenticando: limpar a credencial github.com do Windows (`git credential reject`) e logar de novo com `andersonnpereira` no popup do GCM.
- Versões anteriores deste arquivo chegaram a conter o valor literal de `EVOLUTION_API_KEY` no histórico do git. Se o repositório for público, essa chave deve ser considerada exposta e rotacionada (gerar nova, atualizar `AUTHENTICATION_API_KEY` no docker-compose do servidor + `EVOLUTION_API_KEY` na Vercel). A partir desta versão, o valor não é mais escrito aqui.

## 12. Memória local (não portátil)

Existe memória local do Claude Code em `~/.claude/projects/.../memory/` (`project_agendapix.md`, `project_agendapix_audit.md` etc.) com o histórico granular de cada correção. Essa memória é local à instalação/conta e NÃO acompanha troca de conta/máquina. **Este `ONBOARDING.md` (versionado no git) é a fonte portátil.** Ao assumir numa conta nova, reconstruir memória equivalente a partir daqui + `git log`.
