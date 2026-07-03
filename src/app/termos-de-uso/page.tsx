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
          <p className="text-slate-500 mt-2 text-sm">Última atualização: julho de 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">1. Aceitação</h2>
          <p className="text-slate-600 leading-relaxed">
            Ao criar uma conta ou utilizar o <strong>Agendou</strong>, você (doravante &ldquo;contratante&rdquo; ou &ldquo;usuário&rdquo;) concorda integralmente com estes Termos de Uso. Se não concordar com qualquer disposição, não utilize a plataforma.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">2. O serviço</h2>
          <p className="text-slate-600 leading-relaxed">
            O Agendou é uma plataforma SaaS (Software como Serviço) que oferece ferramentas de agendamento online, gestão de clientes e geração de cobranças via Pix para profissionais autônomos e pequenos negócios. O Agendou fornece apenas a ferramenta tecnológica e <strong>não é parte nas relações comerciais entre o contratante e seus clientes finais</strong>.
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
            O Agendou apenas gera os dados para pagamento via Pix (QR code e chave). O processamento financeiro ocorre diretamente entre o cliente final e o contratante via sistema bancário. O Agendou não processa, custodia ou intermedia os valores pagos e não é responsável por estornos, disputas ou inadimplências.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">7. Responsabilidade do contratante e isenção</h2>
          <p className="text-slate-600 leading-relaxed">
            O contratante é o <strong>único e exclusivo responsável</strong> pela atividade profissional que exerce por meio da plataforma, incluindo, sem limitação:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-slate-600">
            <li>a qualidade, a execução e o cumprimento dos serviços prestados aos seus próprios clientes;</li>
            <li>todas as obrigações fiscais, tributárias, trabalhistas, previdenciárias e regulatórias decorrentes da sua atividade;</li>
            <li>o conteúdo que cadastra (serviços, preços, mensagens, imagens) e a sua veracidade;</li>
            <li>a relação, a comunicação e eventuais conflitos com seus clientes finais;</li>
            <li>o tratamento dos dados pessoais dos seus clientes, nos termos da cláusula 8.</li>
          </ul>
          <p className="text-slate-600 leading-relaxed">
            O contratante concorda em <strong>isentar, defender e indenizar</strong> o Agendou e o seu titular por quaisquer custos, despesas, honorários, perdas, danos, multas, tributos, reclamações ou demandas (judiciais ou administrativas), de qualquer natureza, apresentados por terceiros — <strong>inclusive seus clientes finais, órgãos públicos ou autoridades</strong> — que decorram do uso da plataforma, do conteúdo cadastrado, dos serviços prestados pelo contratante ou do tratamento dos dados de seus clientes. Nenhum custo dessa natureza será assumido pelo Agendou ou por seu titular.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">8. Proteção de dados pessoais (LGPD) — papéis das partes</h2>
          <p className="text-slate-600 leading-relaxed">
            Em relação aos dados pessoais dos <strong>clientes finais</strong> coletados por meio da página de agendamento do contratante (por exemplo: nome, telefone, e-mail e observações), o <strong>contratante atua como Controlador</strong> e o <strong>Agendou atua como Operador</strong>, tratando tais dados exclusivamente para viabilizar o serviço e conforme as instruções do contratante, nos termos da Lei nº 13.709/2018 (LGPD).
          </p>
          <p className="text-slate-600 leading-relaxed">Cabe ao contratante, como Controlador:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-600">
            <li>definir a base legal do tratamento e, quando aplicável, obter o consentimento de seus clientes;</li>
            <li>informar seus clientes sobre como seus dados são utilizados;</li>
            <li>atender às requisições dos titulares (acesso, correção, exclusão etc.) relativas a esses dados;</li>
            <li>utilizar os dados apenas para finalidades legítimas e compatíveis com a sua atividade.</li>
          </ul>
          <p className="text-slate-600 leading-relaxed">
            Em relação aos dados da <strong>conta do próprio contratante</strong>, o Agendou atua como Controlador, conforme detalhado na{" "}
            <Link href="/politica-de-privacidade" className="text-green-600 hover:underline">Política de Privacidade</Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">9. Disponibilidade e manutenção</h2>
          <p className="text-slate-600 leading-relaxed">
            Empreendemos esforços razoáveis para manter a plataforma disponível 24/7, mas não garantimos disponibilidade ininterrupta. Podemos realizar manutenções programadas com aviso prévio quando possível.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">10. Propriedade intelectual</h2>
          <p className="text-slate-600 leading-relaxed">
            Todo o software, design, marcas e conteúdos da plataforma pertencem ao Agendou ou seus licenciadores. Os dados inseridos por você (serviços, clientes, agendamentos) permanecem de sua propriedade.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">11. Rescisão</h2>
          <p className="text-slate-600 leading-relaxed">
            Você pode cancelar sua conta a qualquer momento. O Agendou reserva-se o direito de suspender contas que violem estes Termos. Após o cancelamento, seus dados serão excluídos conforme nossa Política de Privacidade.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">12. Limitação de responsabilidade</h2>
          <p className="text-slate-600 leading-relaxed">
            Na máxima extensão permitida pela legislação aplicável, o Agendou <strong>não se responsabiliza</strong> por danos indiretos, lucros cessantes, nem por quaisquer custos, prejuízos, demandas ou penalidades decorrentes da relação entre o contratante e seus clientes finais, da atividade profissional do contratante ou do tratamento por ele realizado dos dados de seus clientes — responsabilidades que são <strong>exclusivas do contratante</strong>. A responsabilidade total do Agendou, quando cabível, fica limitada ao valor efetivamente pago pelo contratante nos 3 (três) meses anteriores ao evento que originou a responsabilidade.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">13. Lei aplicável e foro</h2>
          <p className="text-slate-600 leading-relaxed">
            Estes Termos são regidos pela legislação brasileira. Fica eleito o <strong>foro da Comarca de São João da Boa Vista, Estado de São Paulo</strong>, para dirimir quaisquer controvérsias decorrentes destes Termos, com renúncia a qualquer outro, por mais privilegiado que seja.
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
