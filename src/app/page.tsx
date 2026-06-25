import Link from "next/link";

const STATS = [
  { n: "+12.000", label: "Agendamentos realizados" },
  { n: "+2.400", label: "Autônomos usando" },
  { n: "3h", label: "Economizadas por semana" },
  { n: "R$ 0", label: "Taxa por Pix recebido" },
];

const PAIN_POINTS = [
  "Responde DM às 23h pra confirmar horário de cliente",
  "Esquece de cobrar e fica constrangido de lembrar depois",
  "Perde cliente porque não respondeu a tempo",
  "Cliente some depois de marcar — sem aviso, sem pagamento",
];

const FEATURES = [
  {
    icon: "📅",
    title: "Agenda 100% automática",
    desc: "Clientes escolhem serviço e horário pelo seu link. Sem DM, sem planilha, sem confusão.",
    highlight: true,
  },
  {
    icon: "💸",
    title: "Pix direto na sua conta",
    desc: "Cobrança com sua chave Pix. O dinheiro cai direto, sem intermediário, zero taxa.",
    highlight: true,
  },
  {
    icon: "📲",
    title: "WhatsApp do seu número",
    desc: "Confirmação, cobrança e lembrete saem do seu próprio WhatsApp. Parece que você mandou.",
    highlight: true,
  },
  {
    icon: "🔁",
    title: "Cobranças recorrentes",
    desc: "Semanal, quinzenal ou mensal. A próxima cobrança é criada sozinha quando você marca como pago.",
    highlight: false,
  },
  {
    icon: "👥",
    title: "CRM de clientes",
    desc: "Histórico, total gasto, aniversários e inativos. Tudo pra você fidelizar e reconquistar.",
    highlight: false,
  },
  {
    icon: "📊",
    title: "Financeiro em tempo real",
    desc: "Receita do mês, pendências e horário de pico. Saiba o que vai entrar antes de entrar.",
    highlight: false,
  },
];

const STEPS = [
  {
    n: "01",
    icon: "⚙️",
    title: "Configure em 10 minutos",
    desc: "Cadastre seus serviços, defina horários disponíveis e adicione sua chave Pix. Simples assim.",
  },
  {
    n: "02",
    icon: "🔗",
    title: "Cole o link na bio",
    desc: "Você recebe um link único. O cliente acessa, escolhe e agenda — completamente sozinho.",
  },
  {
    n: "03",
    icon: "💰",
    title: "Receba confirmado e pago",
    desc: "Confirmação e Pix disparados automaticamente. Você só aparece pro atendimento.",
  },
];

const TESTIMONIALS = [
  {
    name: "Ana Paula M.",
    role: "Manicure · São Paulo",
    avatar: "A",
    text: "Antes eu passava 2h por dia respondendo mensagem pra marcar horário. Hoje o link faz tudo enquanto eu atendo. Já cheguei a 47 atendimentos numa semana.",
    stars: 5,
  },
  {
    name: "Rodrigo S.",
    role: "Personal Trainer · BH",
    avatar: "R",
    text: "O Pix cai automático. Em 3 meses com o Agendou, zero inadimplência. Nem preciso mais ficar lembrando cliente de pagar.",
    stars: 5,
  },
  {
    name: "Camila F.",
    role: "Design de Sobrancelha · RJ",
    avatar: "C",
    text: "Minha cliente abre o link, escolhe o horário e já recebe a confirmação no WhatsApp. Parece que tenho uma assistente pessoal. Vale cada centavo.",
    stars: 5,
  },
];

const COMPARISON = [
  { feature: "Agendamento 24h pelo link",    agendou: "✓", manual: "✗", papel: "✗" },
  { feature: "Cobrança Pix automática",      agendou: "✓", manual: "✗", papel: "✗" },
  { feature: "Lembrete automático",          agendou: "✓", manual: "✗", papel: "✗" },
  { feature: "Histórico de clientes",        agendou: "✓", manual: "✗", papel: "✗" },
  { feature: "WhatsApp integrado",           agendou: "✓", manual: "Manual", papel: "✗" },
  { feature: "Custo mensal",                 agendou: "R$ 33", manual: "Grátis", papel: "Grátis" },
  { feature: "Horas gastas por semana",      agendou: "~30 min", manual: "3–5h", papel: "5h+" },
];

const PRICING = [
  {
    name: "Teste grátis",
    price: "R$ 0",
    period: "7 dias",
    highlight: false,
    badge: null as string | null,
    subtext: null as string | null,
    features: [
      "Agenda online ilimitada",
      "Cobrança Pix automática",
      "WhatsApp integrado",
      "Link da bio personalizado",
    ],
    cta: "Começar grátis",
    href: "/login",
  },
  {
    name: "Mensal",
    price: "R$ 47",
    period: "/mês",
    highlight: false,
    badge: null,
    subtext: null,
    features: [
      "Tudo do plano grátis",
      "CRM de clientes completo",
      "Financeiro e fluxo de caixa",
      "Cobranças recorrentes",
      "Relatórios e métricas",
    ],
    cta: "Assinar mensal",
    href: "/login",
  },
  {
    name: "Anual",
    price: "R$ 33",
    period: "/mês",
    highlight: true,
    badge: "MAIS POPULAR",
    subtext: "cobrado R$ 397/ano — economize R$ 167",
    features: [
      "Tudo do plano mensal",
      "30% mais barato",
      "12 meses garantidos",
      "Novas funções em primeira mão",
      "Suporte prioritário máximo",
    ],
    cta: "Assinar anual — R$ 397/ano",
    href: "/login",
  },
];

const FAQS = [
  {
    q: "O dinheiro vai direto para mim?",
    a: "Sim. O Pix é gerado com a sua própria chave Pix. O pagamento cai direto na sua conta bancária, sem intermediários e sem nenhuma taxa por transação.",
  },
  {
    q: "Preciso confirmar o pagamento manualmente?",
    a: "Sim. O app não acessa seu banco. Quando o cliente pagar, você vê no extrato e marca como 'Pago' no app. Leva 2 segundos.",
  },
  {
    q: "O cliente precisa baixar algum app?",
    a: "Não. O cliente só abre o link no navegador, preenche nome e WhatsApp e escolhe o horário. Sem senha, sem cadastro, sem app pra baixar.",
  },
  {
    q: "Funciona sem o WhatsApp automático?",
    a: "Sim. Sem configurar o WhatsApp automático, o app abre o WhatsApp com a mensagem pronta pra você apertar Enviar. Você não perde a funcionalidade, só não é 100% automático.",
  },
  {
    q: "Como funciona a cobrança recorrente?",
    a: "Ao criar uma cobrança, escolha a recorrência (semanal, quinzenal ou mensal). Quando você marcar como paga, o app cria automaticamente a próxima cobrança.",
  },
  {
    q: "Posso cancelar a qualquer momento?",
    a: "Sim. Sem fidelidade, sem multa. Seus dados ficam salvos por 30 dias após o cancelamento caso você mude de ideia.",
  },
];

const PROFILES = [
  "Manicure", "Personal trainer", "Fotógrafo", "Massagista",
  "Cabeleireiro", "Nutricionista", "Design de sobrancelha", "Professor particular",
  "Esteticista", "Barbeiro", "Psicólogo", "Tatuador", "Fisioterapeuta", "Consultor",
];

export default function Home() {
  return (
    <>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .float-1 { animation: float 4s ease-in-out infinite; }
        .float-2 { animation: float 4s ease-in-out 1.3s infinite; }
        .float-3 { animation: float 4s ease-in-out 2.6s infinite; }
        .float-4 { animation: float 4s ease-in-out 0.6s infinite; }
        .marquee-track { animation: marquee 28s linear infinite; }
        .marquee-track:hover { animation-play-state: paused; }
        .live-dot { animation: pulseDot 2s ease-in-out infinite; }
        .hero-glow {
          background: radial-gradient(ellipse 70% 70% at 75% 50%, rgba(22,163,74,0.07) 0%, transparent 70%);
        }
        details summary { cursor: pointer; list-style: none; user-select: none; }
        details summary::-webkit-details-marker { display: none; }
        .faq-chevron { transition: transform 0.25s ease; display: inline-block; }
        details[open] .faq-chevron { transform: rotate(180deg); }
        .cta-glow {
          background: radial-gradient(circle at 20% 80%, rgba(255,255,255,0.12) 0%, transparent 50%),
                      radial-gradient(circle at 80% 20%, rgba(255,255,255,0.12) 0%, transparent 50%);
        }
      `}</style>

      <main className="min-h-screen bg-white overflow-x-hidden">

        {/* ─── Mobile sticky CTA bar ──────────────────── */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3 flex gap-3 sm:hidden shadow-2xl">
          <Link href="/login" className="flex-1 btn-primary text-sm text-center py-3 shadow-sm shadow-brand/30">
            Começar grátis →
          </Link>
          <a href="#precos" className="btn-ghost text-sm px-4 py-3">
            Preços
          </a>
        </div>

        {/* ─── Header ─────────────────────────────────── */}
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
          <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
            <div className="flex items-center gap-2.5">
              <span className="text-xl font-extrabold text-brand tracking-tight">Agendou</span>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold bg-brand-light text-brand-dark px-2.5 py-1 rounded-full border border-brand/20">
                <span className="w-1.5 h-1.5 rounded-full bg-brand live-dot inline-block"></span>
                online
              </span>
            </div>
            <nav className="hidden md:flex items-center gap-7 text-sm text-slate-500">
              <a href="#como-funciona" className="hover:text-brand transition-colors">Como funciona</a>
              <a href="#recursos"      className="hover:text-brand transition-colors">Recursos</a>
              <a href="#precos"        className="hover:text-brand transition-colors">Preços</a>
            </nav>
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm text-slate-600 hover:text-brand font-medium hidden sm:block transition-colors">
                Entrar
              </Link>
              <Link href="/login" className="btn-primary text-sm px-5 py-2.5 shadow-sm shadow-brand/20">
                Grátis por 7 dias →
              </Link>
            </div>
          </div>
        </header>

        {/* ─── Hero ───────────────────────────────────── */}
        <section className="relative max-w-6xl mx-auto px-6 pt-16 pb-24 hero-glow">
          <div className="grid lg:grid-cols-2 gap-14 items-center">

            {/* Copy */}
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 bg-brand-light text-brand-dark text-xs font-bold px-4 py-2 rounded-full border border-brand/20">
                <span className="w-2 h-2 rounded-full bg-brand live-dot"></span>
                Mais de 2.400 autônomos já economizam 3h por semana
              </div>

              <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.06]">
                Agenda lotada.<br />
                Pix na conta.<br />
                <span className="text-brand">Sem responder DM.</span>
              </h1>

              <p className="text-xl text-slate-500 leading-relaxed max-w-lg">
                Clientes agendam pelo seu link da bio e já recebem o Pix pra pagar.
                Confirmação, cobrança e lembrete saem do seu número de WhatsApp — automático.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <Link href="/login" className="btn-primary text-base px-8 py-4 text-center shadow-lg shadow-brand/25">
                  Criar conta grátis — 7 dias →
                </Link>
                <a href="#como-funciona" className="btn-ghost text-base px-6 py-4 text-center">
                  Ver como funciona
                </a>
              </div>

              <div className="flex flex-wrap gap-5 text-sm text-slate-400 pt-1">
                <span className="flex items-center gap-1.5"><span className="text-brand font-bold">✓</span> Sem cartão de crédito</span>
                <span className="flex items-center gap-1.5"><span className="text-brand font-bold">✓</span> Cancele quando quiser</span>
                <span className="flex items-center gap-1.5"><span className="text-brand font-bold">✓</span> 100% brasileiro</span>
              </div>
            </div>

            {/* Phone mockup + floating cards */}
            <div className="hidden lg:flex justify-center items-center relative h-[520px]">
              <div className="absolute w-80 h-80 bg-brand/8 blur-3xl rounded-full" />

              {/* Phone */}
              <div className="relative z-10 float-1">
                <div className="bg-slate-900 rounded-[3.5rem] p-[11px] shadow-2xl border-[5px] border-slate-800 w-[250px]">
                  <div className="bg-white rounded-[2.8rem] overflow-hidden">
                    {/* Status bar */}
                    <div className="bg-slate-50 px-5 pt-3 pb-2 flex justify-between items-center border-b border-slate-100">
                      <span className="text-[10px] font-bold text-slate-700">9:41</span>
                      <span className="text-[8px] text-slate-400">●●●</span>
                    </div>
                    {/* App UI */}
                    <div className="px-4 py-4 space-y-3">
                      <div className="text-center">
                        <div className="w-13 h-13 w-[52px] h-[52px] rounded-full bg-brand-light flex items-center justify-center text-2xl mx-auto">✂️</div>
                        <p className="font-extrabold text-[13px] mt-2 text-slate-900">Studio da Ana</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">Escolha um serviço</p>
                      </div>
                      <div className="space-y-2">
                        {[
                          { name: "Manicure",    price: "R$ 50", sel: true },
                          { name: "Pedicure",    price: "R$ 55", sel: false },
                          { name: "Gel completo",price: "R$ 90", sel: false },
                        ].map((s) => (
                          <div
                            key={s.name}
                            className={`rounded-xl border px-3 py-2.5 flex items-center justify-between ${
                              s.sel ? "border-brand bg-brand-light" : "border-slate-100 bg-slate-50"
                            }`}
                          >
                            <p className={`text-[11px] font-bold ${s.sel ? "text-brand-dark" : "text-slate-600"}`}>{s.name}</p>
                            <p className={`text-[11px] font-bold ${s.sel ? "text-brand" : "text-slate-400"}`}>{s.price}</p>
                          </div>
                        ))}
                      </div>
                      <div className="bg-brand rounded-2xl py-2.5 text-center shadow-sm shadow-brand/30">
                        <p className="text-[11px] font-extrabold text-white">Próximo →</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating — WhatsApp */}
              <div className="absolute -left-12 top-16 bg-white rounded-2xl shadow-xl border border-slate-100 p-3.5 w-54 float-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-lg shrink-0">📲</div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-900">WhatsApp enviado!</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Confirmação pra Maria · agora</p>
                  </div>
                </div>
              </div>

              {/* Floating — Pix recebido */}
              <div className="absolute -right-10 bottom-16 bg-white rounded-2xl shadow-xl border border-slate-100 p-3.5 w-50 float-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center text-lg shrink-0">💸</div>
                  <div>
                    <p className="text-[11px] font-bold text-brand-dark">Pix recebido!</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">R$ 90,00 de Camila</p>
                  </div>
                </div>
              </div>

              {/* Floating — Novo agendamento */}
              <div className="absolute -right-6 top-10 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 float-4">
                <p className="text-[10px] font-bold text-slate-700">📅 Novo agendamento</p>
                <p className="text-[9px] text-slate-400 mt-0.5">João · amanhã às 10h</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Marquee de profissões ──────────────────── */}
        <div className="bg-slate-50 border-y border-slate-100 py-3.5 overflow-hidden">
          <div className="flex w-max marquee-track gap-2">
            {[...PROFILES, ...PROFILES].map((p, i) => (
              <span
                key={i}
                className="text-sm text-slate-500 font-medium px-4 py-1.5 bg-white border border-slate-200 rounded-full whitespace-nowrap"
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        {/* ─── Seção dor ──────────────────────────────── */}
        <section className="bg-slate-950">
          <div className="max-w-5xl mx-auto px-6 py-20">
            <div className="text-center mb-12">
              <p className="text-brand text-sm font-bold uppercase tracking-widest mb-3">Chega disso</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
                Quantas dessas você ainda faz hoje?
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {PAIN_POINTS.map((pain, i) => (
                <div key={i} className="flex items-start gap-4 bg-slate-900 rounded-2xl border border-slate-800 p-5 hover:border-slate-700 transition-colors">
                  <span className="w-7 h-7 rounded-full bg-red-950 border border-red-800 text-red-400 font-bold flex items-center justify-center text-sm shrink-0 mt-0.5">✗</span>
                  <p className="text-slate-300 text-sm leading-relaxed">{pain}</p>
                </div>
              ))}
            </div>
            <div className="mt-12 text-center">
              <p className="text-slate-500 text-sm mb-5">Se marcou alguma, o Agendou elimina cada uma delas.</p>
              <Link
                href="/login"
                className="inline-block bg-brand text-white font-extrabold text-base px-10 py-4 rounded-2xl hover:bg-brand-dark transition-colors shadow-lg shadow-brand/30"
              >
                Resolver isso agora →
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Stats ──────────────────────────────────── */}
        <section className="bg-white border-b border-slate-100">
          <div className="max-w-5xl mx-auto px-6 py-16">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-10">
              {STATS.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-4xl sm:text-5xl font-extrabold text-brand leading-none">{s.n}</p>
                  <p className="text-sm text-slate-500 mt-2 leading-snug">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Como funciona ──────────────────────────── */}
        <section id="como-funciona" className="bg-slate-50 border-b border-slate-100">
          <div className="max-w-5xl mx-auto px-6 py-20">
            <div className="text-center mb-14">
              <p className="text-brand text-sm font-bold uppercase tracking-widest mb-3">Simples assim</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">3 passos para funcionar</h2>
              <p className="text-slate-500 mt-3 max-w-md mx-auto">Do cadastro ao primeiro agendamento em menos de 10 minutos.</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-6">
              {STEPS.map((s, i) => (
                <div key={s.n} className="relative">
                  {i < STEPS.length - 1 && (
                    <div className="hidden sm:block absolute top-7 left-[calc(100%-12px)] w-6 text-slate-300 text-lg z-10 font-bold">→</div>
                  )}
                  <div className="bg-white rounded-2xl border border-slate-200 p-7 h-full space-y-4 shadow-sm hover:shadow-md hover:border-brand/30 transition-all">
                    <div className="flex items-center gap-4">
                      <span className="w-11 h-11 rounded-2xl bg-brand text-white text-sm font-extrabold flex items-center justify-center shrink-0 shadow-md shadow-brand/30">
                        {s.n}
                      </span>
                      <span className="text-3xl">{s.icon}</span>
                    </div>
                    <h3 className="font-extrabold text-slate-900 text-lg">{s.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Recursos ───────────────────────────────── */}
        <section id="recursos" className="max-w-5xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <p className="text-brand text-sm font-bold uppercase tracking-widest mb-3">Tudo incluso</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Agenda, cobrança e CRM num só lugar</h2>
            <p className="text-slate-500 mt-3 max-w-lg mx-auto">Sem integrar 5 ferramentas diferentes. Tudo que você precisa pra organizar, cobrar e crescer.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className={`rounded-2xl border p-6 space-y-3 transition-all hover:shadow-md ${
                  f.highlight
                    ? "bg-brand-light border-brand/20 hover:border-brand/50"
                    : "bg-white border-slate-200 hover:border-brand/30"
                }`}
              >
                <span className="text-4xl block">{f.icon}</span>
                <h3 className={`font-extrabold text-base ${f.highlight ? "text-brand-dark" : "text-slate-900"}`}>{f.title}</h3>
                <p className={`text-sm leading-relaxed ${f.highlight ? "text-brand-dark/70" : "text-slate-500"}`}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── WhatsApp showcase ──────────────────────── */}
        <section className="bg-slate-950">
          <div className="max-w-5xl mx-auto px-6 py-20 grid sm:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-green-950 text-green-300 text-xs font-bold px-4 py-2 rounded-full mb-6 border border-green-900">
                📲 Do seu número — não de um robô
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-5 leading-tight">
                Mensagens que parecem suas.<br />
                <span className="text-brand">Porque são.</span>
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-8">
                Conecte seu WhatsApp escaneando um QR code. Confirmação, cobrança e lembrete saem do seu número
                — o cliente responde pra você como sempre fez.
              </p>
              <ul className="space-y-3">
                {[
                  "Confirmação automática ao agendar",
                  "Cobrança Pix enviada por WhatsApp",
                  "Lembrete 24h antes do atendimento",
                  "Mensagem personalizável com o seu estilo",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
                    <span className="w-5 h-5 rounded-full bg-brand text-white font-extrabold flex items-center justify-center text-[10px] shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Chat mockup */}
            <div className="bg-[#0d1117] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
              {/* Header do chat */}
              <div className="bg-slate-900 px-5 py-4 flex items-center gap-3 border-b border-slate-800">
                <div className="w-10 h-10 rounded-full bg-green-900 flex items-center justify-center text-xl">✂️</div>
                <div>
                  <p className="text-sm font-bold text-white">Studio da Ana</p>
                  <p className="text-[10px] text-green-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 live-dot inline-block"></span>
                    online agora
                  </p>
                </div>
              </div>
              {/* Mensagens */}
              <div className="p-5 space-y-4">
                <div className="bg-slate-800 rounded-2xl rounded-tl-none p-4 text-sm text-slate-100 leading-relaxed max-w-[90%]">
                  Olá, <strong>Maria</strong>! 👋<br /><br />
                  Seu agendamento foi <strong>confirmado</strong>! ✅<br /><br />
                  ✂️ <strong>Manicure Gel</strong><br />
                  📅 <strong>26/06 às 14h</strong><br />
                  💳 Pix: <strong>R$ 90,00</strong><br /><br />
                  Te espero! 😊
                </div>
                <p className="text-[10px] text-slate-600 text-right">Enviado automaticamente · agora ✓✓</p>
                <div className="flex justify-end">
                  <div className="bg-brand/20 rounded-2xl rounded-tr-none px-4 py-2.5 max-w-[75%]">
                    <p className="text-sm text-brand-light">Ótimo! Já paguei o Pix 🙌</p>
                    <p className="text-[9px] text-brand/60 mt-1 text-right">14:02 ✓✓</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Depoimentos ────────────────────────────── */}
        <section className="bg-white border-b border-slate-100">
          <div className="max-w-5xl mx-auto px-6 py-20">
            <div className="text-center mb-14">
              <p className="text-brand text-sm font-bold uppercase tracking-widest mb-3">Quem usa, aprova</p>
              <h2 className="text-3xl font-extrabold text-slate-900">O que dizem nossos usuários</h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-6">
              {TESTIMONIALS.map((t) => (
                <div
                  key={t.name}
                  className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm hover:shadow-md hover:border-brand/30 transition-all"
                >
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.stars }).map((_, i) => (
                      <span key={i} className="text-amber-400 text-lg leading-none">★</span>
                    ))}
                  </div>
                  <p className="text-slate-700 text-sm leading-relaxed">"{t.text}"</p>
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                    <div className="w-10 h-10 rounded-full bg-brand-light text-brand-dark font-extrabold flex items-center justify-center text-sm shrink-0">
                      {t.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{t.name}</p>
                      <p className="text-xs text-slate-400">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Comparativo ────────────────────────────── */}
        <section className="bg-slate-50 border-b border-slate-100">
          <div className="max-w-4xl mx-auto px-6 py-20">
            <div className="text-center mb-14">
              <p className="text-brand text-sm font-bold uppercase tracking-widest mb-3">A comparação honesta</p>
              <h2 className="text-3xl font-extrabold text-slate-900">Agendou vs como você faz hoje</h2>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left p-4 font-semibold text-slate-500 w-1/2">Funcionalidade</th>
                    <th className="p-4 font-extrabold text-brand text-center bg-brand-light/60 border-x border-brand/10">
                      <span className="flex items-center justify-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-brand live-dot"></span>
                        Agendou
                      </span>
                    </th>
                    <th className="p-4 font-semibold text-slate-400 text-center">WhatsApp manual</th>
                    <th className="p-4 font-semibold text-slate-400 text-center hidden sm:table-cell">Agenda de papel</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr key={i} className={`border-b border-slate-100 last:border-0 ${i % 2 === 1 ? "bg-slate-50/40" : ""}`}>
                      <td className="p-4 text-slate-700 font-medium">{row.feature}</td>
                      <td className="p-4 text-center bg-brand-light/20 border-x border-brand/10">
                        <span className={row.agendou === "✓" ? "text-brand font-extrabold text-xl" : "text-slate-700 font-semibold text-xs"}>
                          {row.agendou}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={row.manual === "✗" ? "text-red-400 font-bold text-xl" : "text-slate-500 text-xs font-medium"}>
                          {row.manual}
                        </span>
                      </td>
                      <td className="p-4 text-center hidden sm:table-cell">
                        <span className={row.papel === "✗" ? "text-red-400 font-bold text-xl" : "text-slate-500 text-xs font-medium"}>
                          {row.papel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ─── Pricing ────────────────────────────────── */}
        <section id="precos" className="max-w-5xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <p className="text-brand text-sm font-bold uppercase tracking-widest mb-3">Sem surpresa</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Simples e transparente</h2>
            <p className="text-slate-500 mt-3">Comece grátis. Assine quando ver o resultado. Cancele quando quiser.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-5 items-start">
            {PRICING.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border flex flex-col gap-6 p-7 transition-all ${
                  plan.highlight
                    ? "bg-brand border-brand shadow-2xl shadow-brand/25 scale-[1.03]"
                    : "bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-brand/30"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-amber-400 text-amber-950 text-[10px] font-extrabold px-4 py-1.5 rounded-full whitespace-nowrap tracking-widest uppercase shadow-sm">
                      {plan.badge}
                    </span>
                  </div>
                )}
                <div>
                  <p className={`text-xs font-extrabold uppercase tracking-widest mb-3 ${plan.highlight ? "text-green-200" : "text-slate-400"}`}>
                    {plan.name}
                  </p>
                  <div className="flex items-end gap-1">
                    <span className={`text-5xl font-extrabold tracking-tight leading-none ${plan.highlight ? "text-white" : "text-slate-900"}`}>
                      {plan.price}
                    </span>
                    <span className={`text-sm pb-1 ${plan.highlight ? "text-green-200" : "text-slate-400"}`}>
                      {plan.period}
                    </span>
                  </div>
                  {plan.subtext && (
                    <p className="text-xs text-green-200 mt-2">{plan.subtext}</p>
                  )}
                </div>
                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <span className={`shrink-0 font-extrabold text-base leading-none mt-0.5 ${plan.highlight ? "text-green-200" : "text-brand"}`}>✓</span>
                      <span className={plan.highlight ? "text-green-50" : "text-slate-600"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`w-full text-center font-extrabold py-4 rounded-2xl transition-colors text-sm ${
                    plan.highlight
                      ? "bg-white text-brand hover:bg-brand-light"
                      : "bg-brand text-white hover:bg-brand-dark shadow-sm shadow-brand/20"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-slate-400 mt-8">
            A assinatura é ativada via Pix direto com o administrador · Ativação em até 1 hora útil
          </p>
        </section>

        {/* ─── FAQ ────────────────────────────────────── */}
        <section className="bg-slate-50 border-t border-slate-100">
          <div className="max-w-3xl mx-auto px-6 py-20">
            <div className="text-center mb-14">
              <p className="text-brand text-sm font-bold uppercase tracking-widest mb-3">Tire suas dúvidas</p>
              <h2 className="text-3xl font-extrabold text-slate-900">Perguntas frequentes</h2>
            </div>
            <div className="space-y-3">
              {FAQS.map((f, i) => (
                <details key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group">
                  <summary className="flex items-center justify-between px-6 py-5 font-semibold text-slate-900 text-sm hover:text-brand transition-colors">
                    <span>{f.q}</span>
                    <span className="faq-chevron text-slate-400 text-base shrink-0 ml-4 font-bold">↓</span>
                  </summary>
                  <div className="px-6 pb-5 pt-1">
                    <p className="text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4">{f.a}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA Final ──────────────────────────────── */}
        <section className="bg-brand relative overflow-hidden">
          <div className="absolute inset-0 cta-glow" />
          <div className="relative max-w-3xl mx-auto px-6 py-24 text-center space-y-7">
            <div className="inline-flex items-center gap-2 bg-white/15 text-white text-xs font-bold px-5 py-2.5 rounded-full border border-white/20">
              🎯 7 dias grátis · sem cartão · cancele quando quiser
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white leading-[1.1]">
              Pare de perder tempo.<br />
              Comece a ganhar mais.
            </h2>
            <p className="text-green-100 text-lg max-w-xl mx-auto leading-relaxed">
              Em menos de 10 minutos você já recebe agendamentos automáticos
              e o Pix cai direto na sua conta.
            </p>
            <Link
              href="/login"
              className="inline-block bg-white text-brand font-extrabold text-lg px-14 py-5 rounded-2xl hover:bg-brand-light transition-colors shadow-2xl"
            >
              Criar conta grátis agora →
            </Link>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-green-200 pt-2">
              <span>✓ Sem cartão de crédito</span>
              <span>✓ Funciona no celular</span>
              <span>✓ Suporte em português</span>
            </div>
          </div>
        </section>

        {/* ─── Footer ─────────────────────────────────── */}
        <footer className="bg-slate-950">
          <div className="max-w-5xl mx-auto px-6 py-14">
            <div className="grid sm:grid-cols-4 gap-8 mb-10">
              <div className="sm:col-span-2">
                <span className="text-xl font-extrabold text-white">Agendou</span>
                <p className="text-sm text-slate-400 mt-3 leading-relaxed max-w-xs">
                  Agenda, cobrança Pix e WhatsApp automático para autônomos e pequenos negócios brasileiros.
                </p>
                <div className="flex gap-2 mt-5 flex-wrap">
                  <span className="bg-slate-900 border border-slate-800 text-slate-400 text-[10px] font-semibold px-3 py-1.5 rounded-full">100% brasileiro</span>
                  <span className="bg-slate-900 border border-slate-800 text-slate-400 text-[10px] font-semibold px-3 py-1.5 rounded-full">Pix direto — zero taxa</span>
                </div>
              </div>
              <div>
                <p className="font-bold text-white mb-4 text-sm">Produto</p>
                <ul className="space-y-3 text-sm text-slate-400">
                  <li><a href="#como-funciona" className="hover:text-brand transition-colors">Como funciona</a></li>
                  <li><a href="#recursos"      className="hover:text-brand transition-colors">Recursos</a></li>
                  <li><a href="#precos"        className="hover:text-brand transition-colors">Preços</a></li>
                  <li><Link href="/ajuda"      className="hover:text-brand transition-colors">Ajuda</Link></li>
                </ul>
              </div>
              <div>
                <p className="font-bold text-white mb-4 text-sm">Conta</p>
                <ul className="space-y-3 text-sm text-slate-400">
                  <li><Link href="/login" className="hover:text-brand transition-colors">Entrar</Link></li>
                  <li><Link href="/login" className="hover:text-brand transition-colors">Criar conta grátis</Link></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <span>© {new Date().getFullYear()} Agendou · Feito para autônomos brasileiros</span>
              <span>O Pix cai direto na sua conta · Sem intermediário · Sem taxa</span>
            </div>
          </div>
        </footer>

        {/* Espaço pra não cobrir conteúdo com a barra mobile */}
        <div className="h-20 sm:hidden" />

      </main>
    </>
  );
}
