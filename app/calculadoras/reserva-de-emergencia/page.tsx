import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { EmergencyReserveCalculator } from "@/components/calculators/EmergencyReserveCalculator"
import { Faq } from "@/components/content/Faq"
import { AppCta } from "@/components/content/AppCta"

export const metadata: Metadata = {
  title: "Calculadora de Reserva de Emergência — quanto guardar?",
  description:
    "Calcule quanto você precisa na sua reserva de emergência e em quanto tempo consegue chegar lá. Ferramenta grátis, sem cadastro.",
  alternates: { canonical: "/calculadoras/reserva-de-emergencia" },
  openGraph: {
    title: "Calculadora de Reserva de Emergência",
    description: "Descubra quanto guardar e em quanto tempo você monta sua reserva.",
    locale: "pt_BR",
    type: "article",
  },
}

const FAQ = [
  {
    q: "O que é uma reserva de emergência?",
    a: "É um dinheiro guardado para cobrir imprevistos — perda de renda, problema de saúde ou um conserto urgente — sem precisar se endividar. Deve ficar em um lugar seguro e de fácil acesso.",
  },
  {
    q: "Quantos meses de reserva eu preciso?",
    a: "A referência comum é de 3 a 6 meses dos seus gastos essenciais para quem tem renda estável (CLT), e de 6 a 12 meses para autônomos e quem tem renda variável.",
  },
  {
    q: "Onde devo guardar a reserva de emergência?",
    a: "Em aplicações seguras e com liquidez diária, ou seja, que você consegue resgatar rapidamente. No Brasil, opções comuns são o Tesouro Selic e CDBs de liquidez diária. Avalie com cuidado e, se precisar, consulte um profissional.",
  },
  {
    q: "Devo investir antes de ter reserva de emergência?",
    a: "Em geral, a reserva vem primeiro. Ela é a base que evita que você precise resgatar investimentos no pior momento para cobrir um imprevisto.",
  },
]

export default function ReservaDeEmergenciaPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-cyan-400 text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao app
        </Link>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Calculadora de reserva de emergência
        </h1>
        <p className="text-zinc-400 mt-3 leading-relaxed">
          Descubra <strong className="text-white">quanto você precisa guardar</strong> para se proteger
          de imprevistos e em quanto tempo chega lá. Preencha seus gastos essenciais abaixo — o cálculo
          é feito no seu navegador, sem cadastro.
        </p>

        <div className="mt-8">
          <EmergencyReserveCalculator />
        </div>

        <div className="mt-12 space-y-4 text-zinc-300 leading-relaxed [&_h2]:text-white [&_h2]:font-semibold [&_h2]:text-2xl [&_h2]:mt-10 [&_h2]:mb-3 [&_strong]:text-white">
          <h2>Como calcular sua reserva de emergência</h2>
          <p>
            A conta é simples: multiplique seus <strong>gastos essenciais mensais</strong> pelo número
            de meses que você quer ter de segurança. Gastos essenciais são aqueles que você não
            consegue cortar de um mês para o outro — moradia, contas básicas, alimentação, transporte
            e saúde. Lazer e assinaturas não entram nessa conta.
          </p>

          <h2>3, 6 ou 12 meses?</h2>
          <p>
            Quanto mais estável a sua renda, menor pode ser a reserva. Quem é{" "}
            <strong>CLT</strong> costuma mirar de 3 a 6 meses. Quem é{" "}
            <strong>autônomo, PJ ou tem renda variável</strong> tende a precisar de 6 a 12 meses,
            porque os imprevistos de renda são mais frequentes.
          </p>

          <h2>Onde guardar</h2>
          <p>
            A reserva precisa de <strong>segurança e liquidez</strong> — você tem que conseguir resgatar
            rápido quando precisar. No Brasil, as opções mais citadas são o Tesouro Selic e CDBs de
            liquidez diária. Veja mais em{" "}
            <Link href="/guias/onde-guardar-reserva-de-emergencia" className="text-cyan-400 hover:underline">
              onde guardar a reserva de emergência
            </Link>
            . Lembre-se: este conteúdo é educacional e não é recomendação de investimento.
          </p>
        </div>

        <Faq items={FAQ} />

        <AppCta
          title="Organize sua reserva no app gratuito"
          description="Registre seus gastos, veja quanto sobra e acompanhe o progresso da sua meta mês a mês."
        />
      </div>
    </div>
  )
}
