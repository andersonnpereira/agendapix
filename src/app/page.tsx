import Link from "next/link";

const FEATURES = [
  {
    icon: "📅",
    title: "Agenda automática",
    desc: "Seus clientes escolhem o serviço e o horário livre. Sem responder DM, sem planilha.",
  },
  {
    icon: "💸",
    title: "Pix gerado na hora",
    desc: "O sistema gera o Pix copia e cola com a sua chave. O dinheiro cai direto na sua conta.",
  },
  {
    icon: "📲",
    title: "WhatsApp automático",
    desc: "Confirmação de agendamento, cobrança e lembrete enviados automaticamente pelo seu WhatsApp.",
  },
  {
    icon: "🔁",
    title: "Cobranças recorrentes",
    desc: "Crie cobranças semanais, quinzenais ou mensais. O sistema lembra o cliente no dia certo.",
  },
  {
    icon: "🔗",
    title: "Link na bio",
    desc: "Um link único para colar no Instagram, TikTok ou onde quiser. Pronto para receber clientes.",
  },
  {
    icon: "📊",
    title: "Controle financeiro",
    desc: "Veja quanto vai receber, quantos agendamentos tem hoje e quais cobranças estão em aberto.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Cadastre seus serviços",
    desc: "Defina nome, preço e duração de cada serviço. Configure seus horários de atendimento.",
  },
  {
    n: "2",
    title: "Cole o link na bio",
    desc: "Você recebe um link único. O cliente acessa, escolhe o serviço e o horário — sozinho.",
  },
  {
    n: "3",
    title: "Receba confirmado e pago",
    desc: "O WhatsApp dispara a confirmação e o Pix automaticamente. Você só cuida do atendimento.",
  },
];

const PROFILES = [
  "Manicure", "Personal trainer", "Fotógrafo", "Massagista",
  "Cabeleireiro", "Nutricionista", "Designer de sobrancelha", "Professor particular",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
          <span className="text-xl font-extrabold text-brand tracking-tight">AgendaPix</span>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-ghost text-sm">
              Entrar
            </Link>
            <Link href="/login" className="btn-primary text-sm px-5">
              Começar grátis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-light text-brand-dark text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          ✨ WhatsApp automático incluso — sem mensalidade extra
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
          Agenda, cobra e confirma
          <br />
          <span className="text-brand">pelo WhatsApp — sozinho.</span>
        </h1>
        <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Seus clientes agendam pelo seu link da bio e já recebem o Pix pra pagar.
          Você para de perder tempo respondendo DM e nunca mais esquece de cobrar.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/login" className="btn-primary text-base px-10 py-3">
            Criar minha conta grátis →
          </Link>
          <a href="#como-funciona" className="btn-ghost text-base px-8 py-3">
            Ver como funciona
          </a>
        </div>
        <p className="mt-4 text-sm text-slate-400">
          Sem mensalidade pra começar · O Pix cai direto na sua conta · Você controla tudo
        </p>

        {/* Quem usa */}
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {PROFILES.map((p) => (
            <span key={p} className="text-xs bg-white border border-slate-200 text-slate-500 px-3 py-1 rounded-full">
              {p}
            </span>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="bg-white border-y border-slate-100">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">
            3 passos para funcionar
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center sm:text-left">
                <div className="w-10 h-10 rounded-full bg-brand text-white font-bold text-lg flex items-center justify-center mx-auto sm:mx-0 mb-4">
                  {s.n}
                </div>
                <h3 className="font-bold text-slate-900 text-lg">{s.title}</h3>
                <p className="mt-2 text-slate-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recursos */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">
          Tudo que você precisa, num lugar só
        </h2>
        <p className="text-slate-500 text-center text-sm mb-10">
          Sem integrar com 5 apps diferentes. Agenda, cobrança e WhatsApp juntos.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
              <span className="text-2xl">{f.icon}</span>
              <h3 className="font-semibold text-slate-900">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WhatsApp destaque */}
      <section className="bg-white border-y border-slate-100">
        <div className="max-w-4xl mx-auto px-6 py-16 grid sm:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              📲 WhatsApp Business
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Seu WhatsApp conectado.<br />
              Mensagens que parecem suas.
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-4">
              Conecte seu WhatsApp escaneando um QR code. A partir daí, as mensagens de confirmação,
              cobrança e lembrete saem direto do seu número — não de um robô genérico.
            </p>
            <ul className="space-y-2 text-sm text-slate-600">
              {[
                "Confirmação automática ao agendar",
                "Pix enviado por WhatsApp na hora",
                "Lembretes automáticos de pagamento",
                "Mensagens personalizáveis com seu estilo",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="text-green-500 font-bold">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-3">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Mensagem automática</p>
            <div className="bg-green-100 rounded-2xl rounded-tl-none p-4 text-sm text-slate-800 leading-relaxed">
              Olá, <strong>Maria</strong>! 👋<br /><br />
              Seu agendamento foi <strong>confirmado</strong>!<br /><br />
              ✅ Serviço: Manicure Gel<br />
              📅 Data: 25/06/2026<br />
              🕐 Horário: 14:00<br /><br />
              <strong>Studio da Ana</strong> te espera. Qualquer dúvida, é só chamar! 😊
            </div>
            <p className="text-xs text-slate-400 text-right">Enviado automaticamente pelo sistema ✓</p>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-extrabold text-slate-900 mb-4">
          Pronto para parar de perder cliente?
        </h2>
        <p className="text-slate-500 mb-8 max-w-xl mx-auto">
          Crie sua conta, cadastre seus serviços e compartilhe seu link. Em menos de 10 minutos
          você já está recebendo agendamentos automáticos.
        </p>
        <Link href="/login" className="btn-primary text-base px-12 py-3 inline-block">
          Criar conta grátis agora →
        </Link>
        <p className="mt-4 text-sm text-slate-400">
          Sem cartão de crédito · Funciona no celular e computador
        </p>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-400">
          <span className="font-bold text-brand text-base">AgendaPix</span>
          <span>Feito para autônomos brasileiros</span>
          <Link href="/login" className="text-brand hover:underline">
            Entrar na conta →
          </Link>
        </div>
      </footer>
    </main>
  );
}
