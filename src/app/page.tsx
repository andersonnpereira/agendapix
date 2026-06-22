import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <span className="text-xl font-bold text-brand">AgendaPix</span>
        <Link href="/login" className="btn-ghost text-sm">
          Entrar
        </Link>
      </header>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-10 pb-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
          Sua agenda e seu Pix,
          <br />
          <span className="text-brand">num link só na bio.</span>
        </h1>
        <p className="mt-5 text-lg text-slate-600">
          Seus clientes agendam sozinhos pelo Instagram e já recebem o Pix pra
          pagar. Você para de perder cliente respondendo DM atrasado e nunca
          mais esquece de cobrar.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/login" className="btn-primary text-base px-8">
            Começar grátis
          </Link>
          <a href="#como-funciona" className="btn-ghost text-base px-8">
            Como funciona
          </a>
        </div>
        <p className="mt-4 text-sm text-slate-400">
          O dinheiro cai direto no seu Pix. A gente não toca no seu dinheiro.
        </p>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="bg-white border-y border-slate-100">
        <div className="max-w-4xl mx-auto px-6 py-16 grid sm:grid-cols-3 gap-8">
          {[
            {
              t: "1. Monte seu link",
              d: "Cadastre seus serviços, preços e horários. Você ganha um link pra colar na bio.",
            },
            {
              t: "2. Cliente agenda sozinho",
              d: "Ele escolhe o serviço e o horário livre. Você recebe tudo organizado, sem responder DM.",
            },
            {
              t: "3. Pix na hora",
              d: "O sistema gera o Pix copia e cola com a sua chave. O pagamento cai direto na sua conta.",
            },
          ].map((item) => (
            <div key={item.t}>
              <h3 className="font-bold text-slate-900">{item.t}</h3>
              <p className="mt-2 text-slate-600 text-sm leading-relaxed">
                {item.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="text-center text-sm text-slate-400 py-10">
        AgendaPix · Feito para autônomos brasileiros
      </footer>
    </main>
  );
}
