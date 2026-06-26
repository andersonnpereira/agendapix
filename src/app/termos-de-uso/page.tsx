import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de Uso — Agendou",
};

export default function TermosDeUsoPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-5 py-12 space-y-8">
        <div>
          <Link href="/" className="text-sm text-green-600 hover:underline">← Voltar ao início</Link>
          <h1 className="text-3xl font-bold text-slate-900 mt-4">Termos de Uso</h1>
          <p className="text-slate-500 mt-2 text-sm">Última atualização: junho de 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">1. Aceitação</h2>
          <p className="text-slate-600 leading-relaxed">
            Ao criar uma conta ou utilizar o <strong>Agendou</strong>, você concorda integralmente com estes Termos de Uso. Se não concordar com qualquer disposição, não utilize a plataforma.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">2. O serviço</h2>
          <p className="text-slate-600 leading-relaxed">
            O Agendou é uma plataforma SaaS (Software como Serviço) que oferece ferramentas de agendamento online, gestão de clientes e cobrança via Pix para profissionais autônomos. O Agendou é responsável pela plataforma tecnológica, mas não é parte nas relações comerciais entre profissionais e seus clientes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">3. Cadastro e conta</h2>
          <ul className="list-disc pl-6 space-y-1 text-slate-600">
            <li>Você é responsável pela veracidade das informações cadastradas.</li>
            <li>Sua senha é pessoal e intransferível. Não a compartilhe.</li>
            <li>Notifique-nos imediatamente sobre qualquer uso não autorizado da sua conta.</li>
            <li>Cada conta corresponde a um único profissional ou negócio.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">4. Planos e pagamentos</h2>
          <p className="text-slate-600 leading-relaxed">
            O Agendou oferece um período de teste gratuito de 7 dias. Após o período de teste, é necessário assinar um plano pago para continuar utilizando. Os valores dos planos estão disponíveis na página de preços. O não pagamento pode resultar na suspensão do acesso sem aviso prévio.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">5. Uso aceitável</h2>
          <p className="text-slate-600">É vedado utilizar o Agendou para:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-600">
            <li>Atividades ilegais ou que violem direitos de terceiros</li>
            <li>Envio de spam ou comunicações não solicitadas em massa</li>
            <li>Cadastro de informações falsas ou enganosas</li>
            <li>Tentativas de acesso não autorizado a sistemas</li>
            <li>Qualquer atividade que prejudique outros usuários ou a infraestrutura da plataforma</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">6. Responsabilidade sobre pagamentos Pix</h2>
          <p className="text-slate-600 leading-relaxed">
            O Agendou apenas gera os dados para pagamento via Pix (QR code e chave). O processamento financeiro ocorre diretamente entre o cliente e o profissional via sistema bancário. O Agendou não processa, custodia ou intermedia os valores pagos e não é responsável por estornos, disputas ou inadimplências.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">7. Disponibilidade e manutenção</h2>
          <p className="text-slate-600 leading-relaxed">
            Empreendemos esforços razoáveis para manter a plataforma disponível 24/7, mas não garantimos disponibilidade ininterrupta. Podemos realizar manutenções programadas com aviso prévio quando possível.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">8. Propriedade intelectual</h2>
          <p className="text-slate-600 leading-relaxed">
            Todo o software, design, marcas e conteúdos da plataforma pertencem ao Agendou ou seus licenciadores. Os dados inseridos por você (serviços, clientes, agendamentos) permanecem de sua propriedade.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">9. Rescisão</h2>
          <p className="text-slate-600 leading-relaxed">
            Você pode cancelar sua conta a qualquer momento. O Agendou reserva-se o direito de suspender contas que violem estes Termos. Após o cancelamento, seus dados serão excluídos conforme nossa Política de Privacidade.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">10. Limitação de responsabilidade</h2>
          <p className="text-slate-600 leading-relaxed">
            O Agendou não se responsabiliza por danos indiretos, lucros cessantes ou perdas decorrentes do uso da plataforma. Nossa responsabilidade total está limitada ao valor pago pelo usuário nos últimos 3 meses.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">11. Lei aplicável e foro</h2>
          <p className="text-slate-600 leading-relaxed">
            Estes Termos são regidos pela legislação brasileira. Fica eleito o foro da Comarca de Campo Grande/MS para dirimir quaisquer disputas, com renúncia a qualquer outro.
          </p>
        </section>

        <div className="border-t border-slate-200 pt-6 flex gap-4 text-sm text-slate-400">
          <Link href="/politica-de-privacidade" className="hover:text-green-600">Política de Privacidade</Link>
          <Link href="/" className="hover:text-green-600">Início</Link>
        </div>
      </div>
    </main>
  );
}
