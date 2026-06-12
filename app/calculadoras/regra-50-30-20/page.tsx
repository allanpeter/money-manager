import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { BudgetRuleCalculator } from "@/components/calculators/BudgetRuleCalculator"
import { Faq, type FaqItem } from "@/components/content/Faq"
import { AppCta } from "@/components/content/AppCta"

export const metadata: Metadata = {
  title: "Calculadora 50/30/20 — divida seu salário",
  description:
    "Calcule quanto do seu salário vai para necessidades, desejos e poupança usando a regra 50/30/20. Grátis e sem cadastro.",
  alternates: { canonical: "/calculadoras/regra-50-30-20" },
  openGraph: {
    title: "Calculadora 50/30/20",
    description: "Divida seu salário entre necessidades, desejos e poupança.",
    locale: "pt_BR",
    type: "article",
  },
}

const FAQ: FaqItem[] = [
  {
    q: "O que é a regra 50/30/20?",
    a: "É um método simples de orçamento: 50% da renda líquida para necessidades, 30% para desejos e 20% para poupança e metas. Serve como ponto de partida para organizar o dinheiro.",
  },
  {
    q: "A regra 50/30/20 funciona no Brasil?",
    a: "Funciona como referência, mas pode precisar de ajuste. Em meses ou regiões com custo de moradia alto, é comum as necessidades passarem de 50%. O importante é usar os percentuais como meta e ir aproximando aos poucos.",
  },
  {
    q: "O que entra em 'necessidades'?",
    a: "Gastos que você não consegue cortar de imediato: moradia, contas básicas (água, luz, internet), alimentação, transporte e saúde.",
  },
  {
    q: "E se eu não conseguir guardar 20%?",
    a: "Comece com o que for possível, mesmo que 5%. O hábito importa mais que o percentual no início. Conforme você corta desejos ou aumenta a renda, vai subindo até os 20%.",
  },
]

export default function Regra503020Page() {
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
          Calculadora 50/30/20
        </h1>
        <p className="text-zinc-400 mt-3 leading-relaxed">
          Descubra <strong className="text-white">quanto do seu salário</strong> deveria ir para
          necessidades, desejos e poupança. Digite sua renda líquida e veja a divisão na hora.
        </p>

        <div className="mt-8">
          <BudgetRuleCalculator />
        </div>

        <div className="mt-12 space-y-4 text-zinc-300 leading-relaxed [&_h2]:text-white [&_h2]:font-semibold [&_h2]:text-2xl [&_h2]:mt-10 [&_h2]:mb-3 [&_strong]:text-white">
          <h2>Como funciona a regra 50/30/20</h2>
          <p>
            A ideia é dividir sua <strong>renda líquida</strong> (o que cai na conta) em três grupos:
            metade para o que é essencial, um terço para o que é supérfluo mas te dá qualidade de vida,
            e o quinto restante para construir patrimônio.
          </p>

          <h2>Por que separar 20% para poupança</h2>
          <p>
            Os 20% são o que faz seu futuro acontecer: primeiro a{" "}
            <Link href="/calculadoras/reserva-de-emergencia" className="text-cyan-400 hover:underline">
              reserva de emergência
            </Link>
            , depois investimentos e metas como viagem, carro ou entrada de um imóvel. Tratar a
            poupança como uma &quot;conta fixa&quot; do mês — e não como sobra — é o que faz a regra
            funcionar.
          </p>

          <h2>Ajustando à sua realidade</h2>
          <p>
            Se as necessidades passam de 50%, não desista da regra — use-a como direção. Procure
            reduzir desejos temporariamente e revise gastos fixos. O método é um guia, não uma camisa
            de força.
          </p>
        </div>

        <Faq items={FAQ} />

        <AppCta
          title="Aplique o 50/30/20 no app gratuito"
          description="Cadastre seus gastos por categoria, veja quanto sobra e direcione os 20% para suas metas."
        />
      </div>
    </div>
  )
}
