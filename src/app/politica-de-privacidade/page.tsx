import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade — Agendou",
};

export default function PoliticaPrivacidadePage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-5 py-12 space-y-8">
        <div>
          <Link href="/" className="text-sm text-green-600 hover:underline">← Voltar ao início</Link>
          <h1 className="text-3xl font-bold text-slate-900 mt-4">Política de Privacidade</h1>
          <p className="text-slate-500 mt-2 text-sm">Última atualização: junho de 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">1. Quem somos</h2>
          <p className="text-slate-600 leading-relaxed">
            O <strong>Agendou</strong> é uma plataforma de agendamento online e gestão financeira desenvolvida para profissionais autônomos brasileiros. Neste documento explicamos como coletamos, usamos e protegemos seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">2. Dados que coletamos</h2>
          <div className="space-y-2 text-slate-600">
            <p><strong>Profissionais (usuários da plataforma):</strong></p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Nome, e-mail e senha (via cadastro)</li>
              <li>Nome do negócio, WhatsApp e chave Pix</li>
              <li>Dados de disponibilidade e serviços cadastrados</li>
              <li>Dados financeiros (cobranças e pagamentos registrados)</li>
            </ul>
            <p className="mt-3"><strong>Clientes finais (quem agenda):</strong></p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Nome, WhatsApp e e-mail (opcionais fornecidos no ato do agendamento)</li>
              <li>Data, horário e serviço escolhido</li>
              <li>Observações informadas voluntariamente</li>
            </ul>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">3. Finalidade do tratamento</h2>
          <ul className="list-disc pl-6 space-y-1 text-slate-600">
            <li>Prestação do serviço de agendamento e notificações</li>
            <li>Envio de lembretes e confirmações de agendamento</li>
            <li>Geração de cobranças Pix</li>
            <li>Comunicações sobre o serviço (atualizações, suporte)</li>
            <li>Melhoria contínua da plataforma por meio de dados agregados e anonimizados</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">4. Compartilhamento de dados</h2>
          <p className="text-slate-600 leading-relaxed">
            Não vendemos ou compartilhamos seus dados pessoais com terceiros para fins comerciais. Utilizamos os seguintes fornecedores de infraestrutura, com os quais os dados podem ser processados:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-slate-600">
            <li><strong>Supabase</strong> — banco de dados e autenticação (EUA)</li>
            <li><strong>Vercel</strong> — hospedagem da aplicação (EUA)</li>
            <li><strong>Resend</strong> — envio de e-mails transacionais (EUA)</li>
          </ul>
          <p className="text-slate-600 text-sm mt-2">Todos os fornecedores possuem cláusulas contratuais de proteção de dados adequadas à LGPD.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">5. Retenção dos dados</h2>
          <p className="text-slate-600 leading-relaxed">
            Os dados são mantidos enquanto a conta estiver ativa. Após o cancelamento, os dados são excluídos em até 30 dias, salvo obrigações legais que exijam retenção por prazo maior.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">6. Seus direitos (LGPD)</h2>
          <p className="text-slate-600">Você tem direito a:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-600">
            <li>Confirmar a existência de tratamento dos seus dados</li>
            <li>Acessar, corrigir ou portar seus dados</li>
            <li>Solicitar a exclusão dos dados tratados com base no consentimento</li>
            <li>Revogar o consentimento a qualquer momento</li>
            <li>Registrar reclamação junto à ANPD</li>
          </ul>
          <p className="text-slate-600 mt-2">Para exercer seus direitos, entre em contato via <a href="mailto:contato@agendou.app" className="text-green-600 hover:underline">contato@agendou.app</a></p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">7. Cookies</h2>
          <p className="text-slate-600 leading-relaxed">
            Utilizamos cookies estritamente necessários para manter sua sessão autenticada. Não utilizamos cookies de rastreamento ou publicidade.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">8. Alterações nesta política</h2>
          <p className="text-slate-600 leading-relaxed">
            Podemos atualizar esta política periodicamente. Notificaremos os usuários por e-mail em caso de mudanças significativas. A data de última atualização consta no topo desta página.
          </p>
        </section>

        <div className="border-t border-slate-200 pt-6 flex gap-4 text-sm text-slate-400">
          <Link href="/termos-de-uso" className="hover:text-green-600">Termos de Uso</Link>
          <Link href="/" className="hover:text-green-600">Início</Link>
        </div>
      </div>
    </main>
  );
}
