import Link from "next/link";
import { ContactForm } from "@/components/ContactForm";

type Section = {
  id: string;
  icon: string;
  title: string;
  intro?: string;
  steps: string[];
  tip?: string;
  href?: string;
  action?: string;
};

const SECTIONS: Section[] = [
  {
    id: "primeiros-passos",
    icon: "🚀",
    title: "1. Primeiros passos (configuração)",
    intro: "Em menos de 10 minutos seu link de agendamento está no ar. Faça nesta ordem:",
    steps: [
      "Em Configurações, preencha seu nome, o nome do negócio e a sua chave Pix (sem a chave Pix você não gera cobranças).",
      "Em Serviços, cadastre o que você oferece: nome, duração, preço e (opcional) foto e descrição.",
      "Em Disponibilidade, defina os dias e horários que você atende.",
      "Volte em Configurações e copie o seu link de agendamento para divulgar.",
    ],
    tip: "Use o tipo de chave Pix que você já tem no banco (CPF, celular, e-mail ou aleatória).",
    href: "/configuracoes",
    action: "Ir para Configurações",
  },
  {
    id: "link",
    icon: "🔗",
    title: "2. Divulgar seu link",
    steps: [
      "Em Configurações, no topo, está o seu link (ex.: agendasj.vercel.app/agendar/seu-nome).",
      "Toque em Copiar e cole na bio do Instagram, no status do WhatsApp, no Google ou onde seus clientes te encontram.",
      "Personalize a página em Configurações → Identidade visual (logo, cor, capa e bio).",
    ],
    tip: "Quanto mais visível o link, mais agendamentos automáticos você recebe.",
    href: "/configuracoes",
    action: "Copiar meu link",
  },
  {
    id: "whatsapp",
    icon: "📲",
    title: "3. Conectar o WhatsApp automático",
    intro: "Com o WhatsApp conectado, confirmações, cobranças e lembretes saem do SEU número, sozinhos.",
    steps: [
      "Em Configurações, vá até WhatsApp Automático.",
      "Abra o WhatsApp no celular → Aparelhos conectados → Conectar aparelho.",
      "Aponte a câmera para o QR Code que aparece na tela.",
      "Pronto: o status muda para “Conectado”.",
    ],
    tip: "Sem conectar o WhatsApp, o app ainda funciona — ele abre o WhatsApp com a mensagem pronta pra você só apertar Enviar.",
    href: "/configuracoes",
    action: "Conectar WhatsApp",
  },
  {
    id: "cliente-agenda",
    icon: "📅",
    title: "4. Como o cliente agenda",
    intro: "O cliente faz tudo sozinho, sem baixar nada:",
    steps: [
      "Ele abre o seu link e escolhe o serviço.",
      "Escolhe a data e um horário livre (o app mostra só os horários disponíveis).",
      "Informa nome e WhatsApp e confirma.",
      "Você é avisado na hora aqui no app e por e-mail; o cliente recebe a confirmação no WhatsApp.",
    ],
    tip: "O cliente não precisa de senha nem cadastro. É só abrir o link e agendar.",
    href: "/agenda",
    action: "Ver minha agenda",
  },
  {
    id: "agenda",
    icon: "🗂️",
    title: "5. Gerenciar a agenda",
    intro: "Na Agenda você controla todos os atendimentos (visão por dia ou por semana):",
    steps: [
      "Confirmar: aprova o agendamento e envia a confirmação ao cliente pelo WhatsApp.",
      "Concluir: marque após atender — isso libera a cobrança.",
      "Reagendar: mude data/hora; o app avisa se o novo horário estiver ocupado.",
      "Cancelar / Excluir: remove o atendimento (o horário volta a ficar livre).",
      "Exportar (.ics): baixe seus agendamentos para o Google Agenda, iPhone ou Outlook.",
    ],
    tip: "O cliente também pode cancelar sozinho pelo link de cancelamento que recebe — sem te ligar.",
    href: "/agenda",
    action: "Ir para Agenda",
  },
  {
    id: "cobrancas",
    icon: "💰",
    title: "6. Cobranças e Pix",
    intro: "Cobre com a sua chave Pix — o dinheiro cai direto na sua conta, sem taxa.",
    steps: [
      "Em Cobranças, crie uma cobrança (ou gere a partir de um atendimento concluído na Agenda).",
      "O app cria o Pix “copia e cola” e o QR Code automaticamente.",
      "Toque em Enviar cobrança para mandar pelo WhatsApp do cliente.",
      "Quando o cliente pagar, confira no seu banco e marque como Pago no app.",
    ],
    tip: "O app não acessa seu banco — por isso você confirma o pagamento manualmente (leva 2 segundos).",
    href: "/cobrancas",
    action: "Ver cobranças",
  },
  {
    id: "recorrencia",
    icon: "🔁",
    title: "7. Cobranças recorrentes e lembretes automáticos",
    intro: "Ideal para mensalistas e pacotes:",
    steps: [
      "Ao criar a cobrança, escolha a recorrência: semanal, quinzenal ou mensal.",
      "Quando você marcar como paga, a próxima cobrança é criada sozinha.",
      "Ative o Lembrete automático e escolha a data/hora — o app envia o Pix pelo WhatsApp na hora certa.",
      "Cobranças vencidas são reenviadas automaticamente (a partir do horário que você configurar).",
    ],
    tip: "Cobrança que vence hoje e cobranças vencidas saem a partir do “Horário do lembrete” definido em Configurações → Regras (padrão 8h). Nunca de madrugada.",
    href: "/cobrancas",
    action: "Ver cobranças",
  },
  {
    id: "clientes",
    icon: "👥",
    title: "8. Clientes (CRM)",
    intro: "Todo cliente que agenda vira um contato salvo automaticamente.",
    steps: [
      "Em Clientes, veja histórico de atendimentos, total gasto e dados de contato.",
      "Cadastre clientes manualmente também (nome, telefone, aniversário, observações).",
      "Acompanhe aniversariantes e clientes inativos para reconquistar quem sumiu.",
    ],
    tip: "Use as observações para lembrar preferências (ex.: “alergia a produto X”).",
    href: "/clientes",
    action: "Ver clientes",
  },
  {
    id: "financeiro",
    icon: "📊",
    title: "9. Financeiro",
    steps: [
      "Em Financeiro, veja a receita do mês e o que está pendente de pagamento.",
      "Acompanhe seus horários de pico para planejar a agenda.",
      "Tenha uma visão do que já entrou e do que ainda vai entrar.",
    ],
    href: "/financeiro",
    action: "Ver financeiro",
  },
  {
    id: "chatbot",
    icon: "🤖",
    title: "10. Chatbot no WhatsApp",
    intro: "Um assistente que responde seus clientes sozinho, 24h por dia (requer WhatsApp conectado).",
    steps: [
      "Em Configurações → Chatbot WhatsApp, ative o chatbot.",
      "Monte os Fluxos de atendimento: uma mensagem de boas-vindas e opções numeradas (pode ter submenus).",
      "Cada opção pode responder um texto, enviar uma imagem, levar a outro menu ou executar uma ação (agendar, consultar cobrança, falar com atendente).",
      "Defina o Gatilho de ativação (quando o bot responde) e, se quiser, o horário de atendimento.",
      "Toque em Registrar webhook para ativar o bot no seu número.",
    ],
    tip: "Use a “prévia” no editor para ver exatamente como a mensagem chega no WhatsApp.",
    href: "/configuracoes",
    action: "Configurar chatbot",
  },
  {
    id: "mensagens",
    icon: "✍️",
    title: "11. Mensagens automáticas personalizadas",
    intro: "Personalize cada mensagem que o app envia, no seu estilo:",
    steps: [
      "Em Configurações → Mensagens WhatsApp, edite: confirmação, lembrete de agendamento, cobrança Pix, lembrete de pagamento, vence hoje e cobrança vencida.",
      "Use as variáveis (ex.: {nome}, {servico}, {valor}, {data}) — elas são preenchidas automaticamente.",
      "Veja a prévia antes de salvar.",
    ],
    tip: "Clique numa variável para inseri-la no ponto do texto onde está o cursor.",
    href: "/configuracoes",
    action: "Editar mensagens",
  },
  {
    id: "identidade",
    icon: "🎨",
    title: "12. Identidade visual da sua página",
    steps: [
      "Em Configurações → Identidade visual, envie sua logo e escolha a cor principal.",
      "Adicione uma imagem de capa e uma bio para a sua página pública.",
      "Tudo isso aparece no link que o cliente abre para agendar.",
    ],
    href: "/configuracoes",
    action: "Personalizar página",
  },
  {
    id: "regras",
    icon: "⚙️",
    title: "13. Regras de agendamento",
    intro: "Controle como e quando os clientes podem marcar (Configurações → Regras):",
    steps: [
      "Antecedência mínima: quanto tempo antes o cliente pode agendar.",
      "Máximo de dias à frente e limite de agendamentos por dia.",
      "Intervalo (buffer) entre atendimentos.",
      "Confirmação automática (o agendamento já entra confirmado) e prazo mínimo para o cliente cancelar.",
      "Horário do lembrete automático (padrão 8h).",
    ],
    href: "/configuracoes",
    action: "Ajustar regras",
  },
  {
    id: "disponibilidade",
    icon: "⏰",
    title: "14. Disponibilidade e bloqueio de datas",
    steps: [
      "Em Disponibilidade, defina os horários de cada dia da semana.",
      "Bloqueie datas específicas (férias, folga, feriado) — nesses dias o cliente não consegue agendar.",
    ],
    tip: "Você pode ter mais de um bloco no mesmo dia (ex.: manhã e tarde, pulando o almoço).",
    href: "/disponibilidade",
    action: "Definir horários",
  },
  {
    id: "instalar",
    icon: "📱",
    title: "15. Instalar como aplicativo (atalho na tela)",
    intro: "O Agendou funciona como um app no seu celular:",
    steps: [
      "Android (Chrome): toque no menu (⋮) → “Adicionar à tela inicial”.",
      "iPhone (Safari): toque em Compartilhar → “Adicionar à Tela de Início”.",
      "Pronto: abre igual a um aplicativo, com ícone na tela.",
    ],
  },
  {
    id: "planos",
    icon: "👑",
    title: "16. Planos e assinatura",
    steps: [
      "Você começa com 7 dias grátis, com acesso completo.",
      "Depois, assine o plano Mensal (R$ 19,90/mês) ou Anual (R$ 179,90/ano — economize R$ 58,90).",
      "O pagamento é por Pix ou cartão e o acesso é liberado automaticamente após a confirmação.",
      "Sem fidelidade: cancele quando quiser e seus dados ficam salvos.",
    ],
    href: "/plano",
    action: "Ver planos",
  },
];

const FAQS = [
  {
    q: "O dinheiro vai direto para mim?",
    a: "Sim! O Pix é gerado com a sua própria chave Pix. O pagamento cai direto na sua conta, sem intermediários e sem taxas.",
  },
  {
    q: "Preciso confirmar o pagamento manualmente?",
    a: "Sim. O app não tem acesso ao seu banco. Quando o cliente pagar, você confere no extrato e marca como “Pago” no app.",
  },
  {
    q: "O cliente precisa criar uma conta ou baixar um app?",
    a: "Não. Ele só abre o link, informa nome e WhatsApp e confirma. Sem senha, sem cadastro, sem download.",
  },
  {
    q: "O WhatsApp automático é obrigatório?",
    a: "Não. Sem conectar, o app abre o WhatsApp com a mensagem já digitada — você só aperta Enviar. Conectando, tudo sai sozinho do seu número.",
  },
  {
    q: "Como funciona a cobrança recorrente?",
    a: "Ao criar a cobrança escolha a recorrência (semanal, quinzenal ou mensal). Quando você marca como paga, a próxima é criada automaticamente.",
  },
  {
    q: "E se o cliente não pagar?",
    a: "Em Cobranças, toque em Lembrete para reenviar o Pix pelo WhatsApp. Cobranças vencidas também são reenviadas automaticamente a partir do horário configurado.",
  },
  {
    q: "Os lembretes chegam de madrugada?",
    a: "Não. Lembretes de cobrança e de agendamento saem a partir do “Horário do lembrete” definido em Configurações → Regras (padrão 8h).",
  },
  {
    q: "Posso cancelar a assinatura quando quiser?",
    a: "Sim, sem fidelidade e sem multa. Você mantém o acesso até o fim do período já pago e seus dados ficam salvos caso volte.",
  },
];

export default function AjudaPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <p className="text-4xl">📖</p>
          <h1 className="text-2xl font-bold text-slate-900">Central de Ajuda</h1>
          <p className="text-slate-500 text-sm">
            Manual completo do Agendou — passo a passo de tudo que a plataforma faz.
          </p>
          <Link href="/dashboard" className="inline-block text-sm text-brand hover:underline">
            ← Voltar para o início
          </Link>
        </div>

        {/* Índice rápido */}
        <nav className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Ir direto para</p>
          <div className="flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 hover:border-brand hover:text-brand transition-colors"
              >
                <span>{s.icon}</span> {s.title.replace(/^\d+\.\s*/, "")}
              </a>
            ))}
            <a
              href="#faq"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 hover:border-brand hover:text-brand transition-colors"
            >
              <span>❓</span> Perguntas frequentes
            </a>
          </div>
        </nav>

        {/* Seções */}
        <div className="space-y-4">
          {SECTIONS.map((s) => (
            <section
              key={s.id}
              id={s.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm scroll-mt-20 space-y-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl shrink-0">{s.icon}</span>
                <h2 className="font-bold text-slate-900 text-base leading-tight">
                  {s.title.replace(/^\d+\.\s*/, "")}
                </h2>
              </div>

              {s.intro && <p className="text-sm text-slate-600 leading-relaxed">{s.intro}</p>}

              <ol className="space-y-2">
                {s.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600 leading-relaxed">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-brand/10 text-brand text-[11px] font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              {s.tip && (
                <p className="text-xs text-brand bg-brand-light rounded-lg px-3 py-2 leading-relaxed">
                  💡 {s.tip}
                </p>
              )}

              {s.href && s.action && (
                <Link href={s.href} className="inline-block text-sm text-brand hover:underline font-medium">
                  {s.action} →
                </Link>
              )}
            </section>
          ))}
        </div>

        {/* FAQ */}
        <section id="faq" className="space-y-4 scroll-mt-20">
          <h2 className="font-bold text-slate-900 text-lg">Perguntas frequentes</h2>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <details key={i} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm group">
                <summary className="font-semibold text-slate-900 text-sm cursor-pointer list-none flex items-center justify-between gap-3">
                  <span>❓ {f.q}</span>
                  <span className="text-slate-400 text-xs shrink-0 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="text-sm text-slate-600 leading-relaxed mt-2.5 pt-2.5 border-t border-slate-100">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Contato */}
        <section className="space-y-4">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">Ainda com dúvida?</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Mande uma mensagem que a gente te ajuda.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <ContactForm />
          </div>
        </section>
      </div>
    </div>
  );
}
