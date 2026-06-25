import Link from "next/link";
import { ContactForm } from "@/components/ContactForm";

const steps = [
  {
    num: "1",
    title: "Configure seu perfil",
    icon: "⚙️",
    desc: "Acesse Configurações e preencha seu nome, o nome do negócio e a sua chave Pix. Sem a chave Pix, você não consegue gerar cobranças.",
    tip: "Dica: use o tipo de chave que você já tem cadastrada no banco (ex: CPF ou celular).",
    href: "/configuracoes",
    action: "Ir para Configurações",
  },
  {
    num: "2",
    title: "Cadastre seus serviços",
    icon: "✂️",
    desc: "Em Serviços, adicione tudo que você oferece: nome, duração e preço. O cliente vai ver essa lista na hora de agendar.",
    tip: "Dica: você pode pausar um serviço sem excluir — ele some do link público mas fica salvo.",
    href: "/servicos",
    action: "Ir para Serviços",
  },
  {
    num: "3",
    title: "Defina seus horários",
    icon: "⏰",
    desc: "Em Disponibilidade, informe os dias e horários que você atende. O app usa isso para mostrar os horários livres para o cliente.",
    tip: "Exemplo: Segunda a Sexta, das 09:00 às 18:00.",
    href: "/disponibilidade",
    action: "Ir para Disponibilidade",
  },
  {
    num: "4",
    title: "Compartilhe seu link",
    icon: "🔗",
    desc: "Nas Configurações, você encontra o seu link de agendamento. Cole na bio do Instagram, no WhatsApp ou onde quiser.",
    tip: "Ex: agendapix.vercel.app/agendar/studio-da-ana",
    href: "/configuracoes",
    action: "Copiar meu link",
  },
  {
    num: "5",
    title: "Cliente agenda sozinho",
    icon: "📅",
    desc: "O cliente abre o link, escolhe o serviço, a data e o horário, informa o nome e WhatsApp, e confirma. Simples assim!",
    tip: "Você será notificado por e-mail e em tempo real aqui no app.",
    href: "/agenda",
    action: "Ver minha agenda",
  },
  {
    num: "6",
    title: "Confirme pelo app",
    icon: "✅",
    desc: "Na Agenda, veja os agendamentos pendentes. Clique em Confirmar + WhatsApp e o cliente recebe a confirmação automaticamente.",
    tip: "Se o WhatsApp automático não estiver configurado, ele abre o WhatsApp com a mensagem pronta.",
    href: "/agenda",
    action: "Ir para Agenda",
  },
  {
    num: "7",
    title: "Realize o serviço",
    icon: "💼",
    desc: "Após atender o cliente, marque o agendamento como Concluído na Agenda. Isso libera o botão de cobrança.",
    tip: "Nunca cobre antes de atender — mantenha a confiança do cliente.",
    href: "/agenda",
    action: "Ir para Agenda",
  },
  {
    num: "8",
    title: "Envie a cobrança Pix",
    icon: "💰",
    desc: "Após concluir, clique em Gerar cobrança Pix. O app cria o QR Code Pix e você envia para o cliente pelo WhatsApp.",
    tip: "O cliente recebe o código Pix copia e cola — ele paga pelo app do banco, sem precisar baixar nada.",
    href: "/cobrancas",
    action: "Ver cobranças",
  },
];

const faqs = [
  {
    q: "O dinheiro vai direto para mim?",
    a: "Sim! O Pix é gerado com a sua própria chave Pix. O pagamento cai direto na sua conta, sem intermediários e sem taxas.",
  },
  {
    q: "Preciso confirmar o pagamento manualmente?",
    a: "Sim. O app não tem acesso ao seu banco. Quando o cliente pagar, você verifica no extrato e marca como 'Pago' no app.",
  },
  {
    q: "O cliente precisa criar uma conta?",
    a: "Não. O cliente só acessa o link, preenche nome e WhatsApp e confirma. Sem senha, sem cadastro.",
  },
  {
    q: "Como funciona a cobrança recorrente?",
    a: "Ao criar uma cobrança, escolha a recorrência (semanal, quinzenal ou mensal). Quando você marcar como paga, o app cria automaticamente a próxima cobrança.",
  },
  {
    q: "E se o cliente não pagar?",
    a: "Na tela de Cobranças, clique em Lembrete para enviar uma mensagem pelo WhatsApp com o Pix copia e cola de novo.",
  },
  {
    q: "O WhatsApp automático é obrigatório?",
    a: "Não. Sem configurar nenhum provedor, o app abre o WhatsApp com a mensagem já digitada. Você só precisa apertar Enviar.",
  },
];

export default function AjudaPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-10">
        {/* Header */}
        <div className="text-center space-y-2">
          <p className="text-4xl">📖</p>
          <h1 className="text-2xl font-bold text-slate-900">Como usar o Agendou</h1>
          <p className="text-slate-500 text-sm">
            Guia completo para configurar e usar o app no dia a dia.
          </p>
          <Link href="/dashboard" className="text-sm text-brand hover:underline">
            ← Voltar para o início
          </Link>
        </div>

        {/* Passos */}
        <section className="space-y-4">
          <h2 className="font-bold text-slate-900 text-lg">Passo a passo</h2>
          <div className="space-y-3">
            {steps.map((s) => (
              <div key={s.num} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {s.num}
                  </span>
                  <span className="text-lg">{s.icon}</span>
                  <h3 className="font-semibold text-slate-900">{s.title}</h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed pl-10">{s.desc}</p>
                {s.tip && (
                  <p className="text-xs text-brand bg-brand-light rounded-lg px-3 py-1.5 ml-10">
                    💡 {s.tip}
                  </p>
                )}
                <div className="pl-10">
                  <Link href={s.href} className="text-sm text-brand hover:underline font-medium">
                    {s.action} →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="space-y-4">
          <h2 className="font-bold text-slate-900 text-lg">Perguntas frequentes</h2>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <p className="font-semibold text-slate-900 text-sm mb-1.5">❓ {f.q}</p>
                <p className="text-sm text-slate-600 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contato */}
        <section className="space-y-4">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">Fale com a gente</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Ficou com alguma dúvida ou sugestão? Mande uma mensagem — respondemos em breve.
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
