# AgendaPix ("Agendou") — Guia de continuidade do projeto

Documento de handoff para qualquer sessão do Claude Code (em qualquer conta) continuar este projeto sem perder contexto. Nenhum segredo/senha real está escrito aqui — só os nomes das variáveis e onde encontrá-las.

## 1. O que é o projeto

SaaS brasileiro de agendamento + cobrança via Pix + automação de WhatsApp, para autônomos e pequenos negócios (marca "Agendou"). Cliente final agenda por um link público (`/agendar/[slug]`), recebe confirmação/lembrete/cobrança automaticamente pelo WhatsApp do próprio profissional, paga via Pix (chave do próprio profissional, sem intermediário/taxa).

- **Domínio de produção:** https://agendasj.vercel.app
- **Repositório GitHub:** https://github.com/andersonnpereira/agendapix
- **Diretório local:** `C:\Users\Anderson\OneDrive - GRUPO JCN\Área de Trabalho\agendapix`
- **Dono do produto:** Anderson Pereira (anderson.pereira@grupojcn.com.br)

## 2. Stack

Next.js 14 (App Router) + TypeScript + TailwindCSS · Supabase (Postgres + Auth + Storage, service-role admin client para operações de servidor) · Evolution API (WhatsApp, self-hosted/terceirizado) · Resend (e-mail) · cron-job.org (agendamento de crons) · Vercel (hosting/deploy).

## 3. Como acessar / onde estão as credenciais

Nada disso está neste documento — só os nomes, para quem já tem acesso saber o que procurar:

- **Vercel** (deploy + env vars): projeto do domínio agendasj.vercel.app. Variáveis relevantes: `NEXT_PUBLIC_SITE_URL` (deve ser `https://agendasj.vercel.app`), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `INFINITPAY_WEBHOOK_SECRET`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `WHATSAPP_PROVIDER`, `WHATSAPP_TOKEN`, `WHATSAPP_INSTANCE_ID`, `RESEND_API_KEY`, `RESEND_FROM`, `SUPPORT_EMAIL`.
- **Supabase**: projeto do banco em produção — pedir ao Anderson o link/acesso do painel. Schema real documentado em `supabase/schema_current.sql` (para disaster recovery / referência de colunas).
- **cron-job.org**: 2 jobs configurados, `GET` a cada hora (`0 * * * *`), com header `Authorization: Bearer <CRON_SECRET>`:
  - `https://agendasj.vercel.app/api/cron/reminders` — lembretes/cobranças
  - `https://agendasj.vercel.app/api/cron/appointment-reminders` — lembretes de agendamento (D-1)
- **Evolution API**: instância própria/terceirizada de WhatsApp (Baileys por baixo) — cada profissional conecta via QR code na tela de Configurações.
- **InfinitPay**: processa os pagamentos de assinatura da própria plataforma (planos mensal/anual). Webhook configurado com `?plan=monthly` / `?plan=annual` + `&secret=<INFINITPAY_WEBHOOK_SECRET>`.
- **Deploy**: `git push origin main` → deploy automático no Vercel. Não há branch de staging separada — main é produção.

## 4. Decisões e armadilhas importantes (não repetir o trabalho de descobrir isso de novo)

- **Next.js Data Cache quebra crons/leituras do Supabase**: toda rota de cron/webhook precisa de `export const dynamic = "force-dynamic"` e `export const fetchCache = "force-no-store"`, senão o Vercel serve resposta cacheada (`X-Vercel-Cache: HIT`) e a função nunca executa de verdade. O client admin (`src/lib/supabase-admin.ts`) já força `cache: "no-store"` no fetch.
- **RLS fechado de propósito**: `profiles`/`bookings` NÃO têm mais policy `select using(true)` (vazava PII/tokens). Leituras públicas (`/agendar/[slug]`, `/cancelar/[token]`) usam o client admin (service role) no servidor; horários ocupados vêm de `/api/slots` (sem PII). Não reabrir isso sem entender por quê foi fechado.
- **Webhooks/crons são fail-closed**: sem o secret configurado, retornam 503 (não pulam a checagem). Isso já pegou o `/api/checkout/start` uma vez — ao tornar o webhook do InfinitPay fail-closed, ele parou de incluir o secret na URL gerada, quebrando ativação de pagamento. Já corrigido, mas é o tipo de regressão a vigiar ao mexer em auth de webhook.
- **Fuso horário BRT**: o padrão `new Date(y,m,d,h,min)` combinado com "hora de parede BRT tratada como se fosse UTC" está CORRETO no runtime do Vercel (UTC) — o offset se cancela. Já foi investigado e é falso positivo de auditoria; não "corrigir" sem reler o racional nos comentários do código.
- **Preços reais**: mensal R$ 19,90, anual R$ 179,90 (R$ 14,99/mês). Todos os planos (incluindo trial de 7 dias) têm os MESMOS recursos — não diferenciar features por plano no marketing.

## 5. O bot de WhatsApp — como o estado funciona (muito iterado nesta sessão)

Arquivo central: `src/lib/whatsapp-bot.ts`. Webhook de entrada: `src/app/api/whatsapp-incoming/[userId]/route.ts`. Estado por conversa fica em `bot_conversations` (chave `profile_id + phone`).

Estados: `idle` → `menu` (mostra opções numeradas) → `human` (silêncio total) ou `cobranca_lookup`. Pontos-chave já resolvidos, para não reintroduzir os mesmos bugs:

- **`human_owner_engaged`** (coluna em `bot_conversations`): fica `true` quando o profissional responde manualmente uma conversa (detectado via evento `fromMe=true` do webhook, `handleOwnerOutbound`). A partir daí o bot para de notificar CADA mensagem do cliente pro número de notificação — porque o profissional já está ciente. Só pedido explícito de "falar com atendente" ou fromMe reativa esse rastreio.
- **`last_outbound_at`**: grava toda vez que o SISTEMA (bot, crons, cobrança manual) manda mensagem pro cliente — usado para diferenciar "eco do que acabamos de mandar" de "resposta manual real do profissional" quando chega um evento `fromMe`.
- **Limite de tentativas do menu (`fallback_count` / `bot_fallback_max_tries`)**: ao esgotar as tentativas, o bot avisa UMA VEZ ("vou te encaminhar") e FICA no estado `menu` (não muda pra `human`) — assim, se o cliente digitar uma opção válida depois, o bot continua ajudando. O contador fica "preso" no valor máximo depois do aviso (não volta a 0), pra não repetir o aviso ao cliente a cada nova mensagem livre — só encaminha em silêncio (respeitando `human_owner_engaged`).
- **Cumprimentos soltos** ("oi", "boa tarde" etc. — lista `PLEASANTRIES`) no meio do menu NÃO contam como tentativa inválida — só reenvia o menu. Isso existe porque cliente comumente manda o cumprimento e a pergunta real em mensagens separadas.
- **Gatilho de ativação** (`bot_trigger_mode`/`bot_trigger_keywords`): só `menu`/`0`/`reiniciar`/`restart`/`início` sempre reabrem o bot a frio. O resto (saudações, texto livre) respeita a configuração do profissional — não deve haver bypass hardcoded disso.
- **`notifyOwner`**: notifica só por WhatsApp (o usuário pediu explicitamente para NÃO usar e-mail como canal — já foi tentado e revertido a pedido dele). Normaliza o número e tenta 2x com um intervalo curto antes de desistir. Notificação nativa do WhatsApp no celular do profissional pode não aparecer quando há uma sessão de API (Evolution) conectada no mesmo número — isso é limitação de infraestrutura do WhatsApp/Evolution, fora do controle do código.
- **Piso de silêncio (`QUIET_HOUR_END = 6`)**: nenhuma mensagem automática (bot ou cron) sai entre meia-noite e 6h BRT, em `cron/reminders` e `cron/appointment-reminders`.
- **Cobrança "antecipada" recorrente**: o horário escolhido pelo profissional (`scheduled_reminder_at`) precisa ser respeitado TODO dia que a cobrança se repete, não só no primeiro — sem isso, a partir do 2º dia ela dispara na primeira execução do cron do dia (6h), ignorando o horário configurado.

## 6. Onde estão as migrações SQL pendentes de rodar

Arquivos `supabase/migration_*.sql` — cada um documenta o que faz no topo. Ao ler o código, sempre confirmar se a migração correspondente já foi rodada no banco de produção (perguntar ao Anderson se não tiver certeza) antes de assumir que uma coluna existe.

## 7. Fluxo de trabalho esperado

1. Antes de qualquer commit: `npx tsc --noEmit` deve passar limpo.
2. Mudanças em UI: preferir verificar com o preview (server já configurado em `.claude/launch.json`, nome `agendapix`) antes de reportar como concluído — páginas dentro de `(app)/` exigem login, então a verificação de UI logada é limitada sem uma conta de teste.
3. Sempre `git push origin main` ao final de cada alteração (deploy automático) — não perguntar antes, isso já é comportamento esperado pelo usuário neste projeto.
4. Se a mudança tiver uma migração SQL nova, deixar claro para o usuário rodar antes de considerar o fix "ativo".
5. O usuário testa em produção com clientes reais e reporta prints de conversas do WhatsApp Business Web — analisar o print com cuidado (quem é "fromMe" vs quem é o cliente) antes de concluir causa raiz.

## 8. Pendências conhecidas / não feito

- **Lote 6 (opcional, nunca solicitado formalmente)**: paginação em clientes/cobranças/financeiro (hoje baixam tudo no client), lembrete anti-no-show D-1, comprovante de pagamento.
- **Financeiro**: usuário pediu avaliação de um painel mais completo (MRR de recorrência, ranking de clientes por faturamento, faturamento por serviço, filtro por período customizado/cliente/status, limite silencioso de 100 itens na lista) — proposta feita, aguardando priorização.
- **CRM (Clientes)**: mesma coisa — tags/etiquetas, ordenação, segmentação por LTV, histórico de notas com data, exportar CSV, detecção de duplicados — proposta feita, aguardando priorização.
- **Confiabilidade da notificação do bot**: mesmo com retry, se `notifyOwner` continuar falhando silenciosamente em produção, o próximo passo seria revisar diretamente os logs de função do Vercel (não acessível a partir do Claude Code neste ambiente) para achar a causa exata na Evolution API.

## 9. Memória anterior (não portátil)

Havia um sistema de memória local (`~/.claude/projects/.../memory/project_agendapix_audit.md` e arquivos relacionados) com o histórico detalhado de cada lote de correções — esse sistema é local à instalação/conta do Claude Code, não acompanha a troca de conta. Este documento (`ONBOARDING.md`) é a versão condensada e portátil desse histórico; se possível, ao continuar o projeto numa conta nova, vale reconstruir aos poucos uma memória equivalente a partir daqui e do `git log`.
