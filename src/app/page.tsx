import Link from "next/link";

const FEATURES = [
  { icon: "📅", title: "Agenda automática", desc: "Clientes escolhem serviço e horário livre. Sem responder DM, sem planilha, sem confusão." },
  { icon: "💸", title: "Pix na hora", desc: "Cobrança gerada com sua chave Pix. Dinheiro cai direto na sua conta — sem intermediário, sem taxa." },
  { icon: "📲", title: "WhatsApp automático", desc: "Confirmação, cobrança e lembrete saem do seu próprio número. Parece que você enviou." },
  { icon: "🔁", title: "Cobranças recorrentes", desc: "Semanal, quinzenal ou mensal. O sistema lembra o cliente e já manda o Pix no dia certo." },
  { icon: "👥", title: "CRM de clientes", desc: "Histórico completo de agendamentos, cobranças e observações de cada cliente num só lugar." },
  { icon: "📊", title: "Controle financeiro", desc: "Receita do mês, pendências e fluxo de caixa em tempo real. Sabe exatamente o que vai entrar." },
];

const STEPS = [
  { n: "1", icon: "⚙️", title: "Configure em minutos", desc: "Cadastre seus serviços, defina seus horários e adicione sua chave Pix. Tudo em menos de 10 minutos." },
  { n: "2", icon: "🔗", title: "Cole o link na bio", desc: "Você recebe um link único. O cliente acessa, escolhe o serviço e o horário — completamente sozinho." },
  { n: "3", icon: "💰", title: "Receba confirmado e pago", desc: "WhatsApp de confirmação e cobrança Pix disparados automaticamente. Você só cuida do atendimento." },
];

const PROFILES = [
  "Manicure", "Personal trainer", "Fotógrafo", "Massagista",
  "Cabeleireiro", "Nutricionista", "Designer de sobrancelha", "Professor particular",
  "Esteticista", "Barbeiro", "Psicólogo", "Tatuador",
];

const PRICING = [
  {
    name: "Teste grátis",
    price: "R$ 0",
    period: "7 dias",
    highlight: false,
    badge: null as string | null,
    features: ["Agenda online ilimitada", "Cobrança Pix automática", "WhatsApp integrado", "Link da bio personalizado"],
    cta: "Começar grátis",
    href: "/login",
    ctaStyle: "border-2 border-brand text-brand hover:bg-brand hover:text-white font-semibold rounded-xl py-3 px-6 transition-colors block text-center",
  },
  {
    name: "Mensal",
    price: "R$ 47",
    period: "/mês",
    highlight: false,
    badge: null as string | null,
    features: ["Tudo do teste grátis", "CRM de clientes completo", "Financeiro e fluxo de caixa", "Cobranças recorrentes", "Suporte prioritário"],
    cta: "Assinar mensal",
    href: "/login",
    ctaStyle: "border-2 border-slate-200 text-slate-700 hover:border-brand hover:text-brand font-semibold rounded-xl py-3 px-6 transition-colors block text-center",
  },
  {
    name: "Anual",
    price: "R$ 33",
    period: "/mês",
    highlight: true,
    badge: "MELHOR VALOR",
    subtext: "cobrado R$ 397/ano · economize R$ 167",
    features: ["Tudo do plano mensal", "30% mais barato que o mensal", "12 meses garantidos", "Prioridade máxima no suporte"],
    cta: "Assinar anual — R$ 397",
    href: "/login",
    ctaStyle: "bg-white text-brand font-bold rounded-xl py-3 px-6 hover:bg-brand-light transition-colors block text-center",
  },
];

const FAQS = [
  { q: "O dinheiro vai direto para mim?", a: "Sim. O Pix é gerado com a sua própria chave Pix. O pagamento cai direto na sua conta, sem intermediários e sem taxas de transação." },
  { q: "Preciso confirmar o pagamento manualmente?", a: "Sim. O app não acessa seu banco. Quando o cliente pagar, você vê no extrato e marca como 'Pago' no app." },
  { q: "O cliente precisa criar uma conta?", a: "Não. O cliente só abre o link, preenche nome e WhatsApp e confirma. Sem senha, sem cadastro, sem app pra baixar." },
  { q: "Funciona sem o WhatsApp automático?", a: "Sim. Sem configurar o WhatsApp automático, o app abre o WhatsApp com a mensagem pronta pra você apertar Enviar." },
  { q: "Como funciona a cobrança recorrente?", a: "Ao criar uma cobrança, escolha a recorrência. Quando você marcar como paga, o app cria automaticamente a próxima." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white overflow-x-hidden">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
          <span className="text-xl font-extrabold text-brand tracking-tight">Agendou</span>
          <div className="flex items-center gap-3">
            <Link href="/ajuda" className="text-sm text-slate-500 hover:text-brand hidden sm:block">Ajuda</Link>
            <Link href="/login" className="text-sm text-slate-600 hover:text-brand font-medium">Entrar</Link>
            <Link href="/login" className="btn-primary text-sm px-5 py-2">
              Começar grátis
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* Copy */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 bg-brand-light text-brand-dark text-xs font-semibold px-3 py-1.5 rounded-full">
              ✨ WhatsApp automático incluso — sem mensalidade extra
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
              Sua agenda,<br />
              seu Pix,<br />
              <span className="text-brand">automático.</span>
            </h1>

            <p className="text-lg text-slate-600 leading-relaxed max-w-lg">
              Clientes agendam pelo seu link da bio e já recebem o Pix pra pagar.
              Sem responder DM, sem esquecer de cobrar, sem planilha.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/login" className="btn-primary text-base px-8 py-3 text-center">
                Criar conta grátis →
              </Link>
              <a href="#como-funciona" className="btn-ghost text-base px-6 py-3 text-center">
                Ver como funciona
              </a>
            </div>

            <p className="text-sm text-slate-400">
              Sem cartão de crédito · 7 dias grátis · Cancele quando quiser
            </p>

            {/* Profissões */}
            <div className="flex flex-wrap gap-2 pt-2">
              {PROFILES.map((p) => (
                <span key={p} className="text-xs bg-slate-50 border border-slate-200 text-slate-500 px-3 py-1 rounded-full">
                  {p}
                </span>
              ))}
            </div>
          </div>

          {/* Phone mockup */}
          <div className="hidden lg:flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-brand/10 blur-3xl rounded-full scale-125" />
              <div className="relative bg-slate-900 rounded-[3rem] p-[10px] shadow-2xl border-4 border-slate-800 w-[230px]">
                <div className="bg-white rounded-[2.4rem] overflow-hidden">
                  {/* Status bar */}
                  <div className="bg-slate-50 px-5 pt-3 pb-1.5 flex justify-between items-center border-b border-slate-100">
                    <span className="text-[10px] font-bold text-slate-700">9:41</span>
                    <span className="text-[8px] text-slate-400">●●●</span>
                  </div>
                  {/* App content */}
                  <div className="px-3 py-3 space-y-2.5">
                    <div className="text-center pb-1">
                      <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center text-lg mx-auto">✂️</div>
                      <p className="font-bold text-[11px] mt-1.5 text-slate-900">Studio da Ana</p>
                      <p className="text-[9px] text-slate-400">Escolha um serviço</p>
                    </div>
                    {[
                      { name: "Manicure", price: "R$ 50", dur: "45 min", sel: true },
                      { name: "Pedicure", price: "R$ 55", dur: "50 min", sel: false },
                      { name: "Gel + Manicure", price: "R$ 90", dur: "90 min", sel: false },
                    ].map((s) => (
                      <div
                        key={s.name}
                        className={`rounded-xl border px-2.5 py-2 flex items-center justify-between ${s.sel ? "border-brand bg-brand-light" : "border-slate-100"}`}
                      >
                        <div>
                          <p className={`text-[10px] font-semibold ${s.sel ? "text-brand-dark" : "text-slate-700"}`}>{s.name}</p>
                          <p className="text-[8px] text-slate-400">{s.dur}</p>
                        </div>
                        <p className={`text-[10px] font-bold ${s.sel ? "text-brand" : "text-slate-500"}`}>{s.price}</p>
                      </div>
                    ))}
                    <div className="bg-brand rounded-xl py-2 text-center mt-1">
                      <p className="text-[10px] font-bold text-white">Próximo →</p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Floating notification */}
              <div className="absolute -right-6 -bottom-3 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 w-52">
                <div className="flex items-start gap-2">
                  <span className="text-base">📱</span>
                  <div>
                    <p className="text-[10px] font-bold text-slate-900">WhatsApp enviado!</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Confirmação para Maria · agora</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── Como funciona ──────────────────────────────────────── */}
      <section id="como-funciona" className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-slate-900">3 passos para funcionar</h2>
            <p className="text-slate-500 mt-2">Do cadastro ao primeiro agendamento em menos de 10 minutos.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden sm:block absolute top-5 left-[calc(100%_-_16px)] w-8 text-slate-300 text-xl text-center">→</div>
                )}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-full space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-brand text-white text-sm font-bold flex items-center justify-center shrink-0">{s.n}</span>
                    <span className="text-2xl">{s.icon}</span>
                  </div>
                  <h3 className="font-bold text-slate-900">{s.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Recursos ───────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-slate-900">Tudo que você precisa, num só app</h2>
          <p className="text-slate-500 mt-2">Sem integrar 5 ferramentas diferentes. Agenda, cobrança e WhatsApp juntos.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2 hover:border-brand/40 hover:shadow-sm transition-all">
              <span className="text-3xl block">{f.icon}</span>
              <h3 className="font-bold text-slate-900">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── WhatsApp destaque ───────────────────────────────────── */}
      <section className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-5xl mx-auto px-6 py-20 grid sm:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              📲 WhatsApp do seu número
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 mb-4 leading-tight">
              Mensagens que parecem suas.<br />
              Porque são.
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              Conecte seu WhatsApp escaneando um QR code. A confirmação de agendamento,
              a cobrança e o lembrete saem direto do seu número — não de um robô genérico.
              O cliente responde pra você como sempre.
            </p>
            <ul className="space-y-2.5 text-sm text-slate-700">
              {[
                "Confirmação automática ao agendar",
                "Cobrança Pix enviada por WhatsApp",
                "Lembrete automático de pagamento",
                "Mensagem personalizável com seu estilo",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 font-bold flex items-center justify-center text-xs shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 shadow-sm">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Mensagem automática</p>
            <div className="bg-green-50 border border-green-100 rounded-2xl rounded-tl-none p-4 text-sm text-slate-800 leading-relaxed">
              Olá, <strong>Maria</strong>! 👋<br /><br />
              Seu agendamento foi <strong>confirmado</strong>!<br /><br />
              ✂️ Serviço: <strong>Manicure Gel</strong><br />
              📅 Data: <strong>25/06/2026</strong><br />
              🕐 Horário: <strong>14:00</strong><br /><br />
              <strong>Studio da Ana</strong> te espera! Qualquer dúvida, é só chamar 😊
            </div>
            <p className="text-xs text-slate-400 text-right">Enviado automaticamente ✓</p>
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────── */}
      <section id="precos" className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-slate-900">Simples e transparente</h2>
          <p className="text-slate-500 mt-2">Comece grátis. Assine quando quiser. Cancele a qualquer momento.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-5">
          {PRICING.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-6 flex flex-col gap-5 ${
                plan.highlight
                  ? "bg-brand border-brand text-white shadow-xl scale-[1.02]"
                  : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    {plan.badge}
                  </span>
                </div>
              )}
              <div>
                <p className={`text-sm font-semibold mb-2 ${plan.highlight ? "text-green-100" : "text-slate-500"}`}>{plan.name}</p>
                <div className="flex items-end gap-1">
                  <span className={`text-4xl font-extrabold ${plan.highlight ? "text-white" : "text-slate-900"}`}>{plan.price}</span>
                  <span className={`text-sm pb-1 ${plan.highlight ? "text-green-100" : "text-slate-400"}`}>{plan.period}</span>
                </div>
                {"subtext" in plan && plan.subtext && (
                  <p className="text-xs text-green-100 mt-1">{plan.subtext}</p>
                )}
              </div>
              <ul className="space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className={`shrink-0 font-bold ${plan.highlight ? "text-green-200" : "text-brand"}`}>✓</span>
                    <span className={plan.highlight ? "text-green-50" : "text-slate-600"}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href={plan.href} className={plan.ctaStyle}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-slate-400 mt-6">
          A assinatura é feita via Pix direto com o administrador. Ativação em até 1 hora útil.
        </p>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────── */}
      <section className="bg-slate-50 border-t border-slate-100">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-extrabold text-slate-900 text-center mb-10">Perguntas frequentes</h2>
          <div className="space-y-4">
            {FAQS.map((f, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <p className="font-semibold text-slate-900 mb-2">❓ {f.q}</p>
                <p className="text-sm text-slate-600 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Final ──────────────────────────────────────────── */}
      <section className="bg-brand">
        <div className="max-w-3xl mx-auto px-6 py-20 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            Pronto para parar de<br />
            perder cliente e dinheiro?
          </h2>
          <p className="text-green-100 text-lg max-w-xl mx-auto">
            Crie sua conta, cadastre seus serviços e compartilhe o link.
            Em menos de 10 minutos você já recebe agendamentos automáticos.
          </p>
          <Link
            href="/login"
            className="inline-block bg-white text-brand font-extrabold text-base px-12 py-4 rounded-2xl hover:bg-brand-light transition-colors shadow-lg"
          >
            Criar conta grátis agora →
          </Link>
          <p className="text-green-200 text-sm">
            7 dias grátis · Sem cartão de crédito · Funciona no celular e computador
          </p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="grid sm:grid-cols-3 gap-8 mb-8">
            <div>
              <span className="text-xl font-extrabold text-brand">Agendou</span>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                Agenda, cobrança Pix e WhatsApp automático para autônomos brasileiros.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-700 mb-3 text-sm">Produto</p>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="#como-funciona" className="hover:text-brand">Como funciona</a></li>
                <li><a href="#precos" className="hover:text-brand">Preços</a></li>
                <li><Link href="/ajuda" className="hover:text-brand">Ajuda</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-slate-700 mb-3 text-sm">Conta</p>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><Link href="/login" className="hover:text-brand">Entrar</Link></li>
                <li><Link href="/login" className="hover:text-brand">Criar conta grátis</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
            <span>© {new Date().getFullYear()} Agendou · Feito para autônomos brasileiros</span>
            <span>O Pix cai direto na sua conta · Sem intermediário</span>
          </div>
        </div>
      </footer>

    </main>
  );
}
