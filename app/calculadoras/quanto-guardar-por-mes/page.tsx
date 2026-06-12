import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { MonthlyGoalCalculator } from "@/components/calculators/MonthlyGoalCalculator"
import { Faq, type FaqItem } from "@/components/content/Faq"
import { AppCta } from "@/components/content/AppCta"

export const metadata: Metadata = {
  title: "Quanto guardar por mês? Calculadora de metas",
  description:
    "Descubra quanto você precisa guardar por mês para atingir uma meta no prazo que quiser. Calculadora grátis, sem cadastro.",
  alternates: { canonical: "/calculadoras/quanto-guardar-por-mes" },
  openGraph: {
    title: "Quanto guardar por mês",
    description: "Calcule o valor mensal para atingir qualquer meta financeira.",
    locale: "pt_BR",
    type: "article",
  },
}

const FAQ: FaqItem[] = [
  {
    q: "Como saber quanto guardar por mês?",
    a: "Pegue o valor que falta para a meta (meta menos o que você já tem) e divida pelo número de meses até o prazo. O resultado é quanto você precisa guardar por mês.",
  },
  {
    q: "E se eu não conseguir guardar esse valor?",
    a: "Você tem três opções: aumentar o prazo, reduzir o valor da meta ou cortar gastos para liberar mais dinheiro. Ajuste o prazo na calculadora e veja como o valor mensal muda.",
  },
  {
    q: "Devo deixar o dinheiro parado na conta?",
    a: "Para metas de curto prazo (até 1 a 2 anos), o ideal é uma aplicação segura e com liquidez, como Tesouro Selic ou CDB de liquidez diária, para o dinheiro render sem risco de oscilação.",
  },
]

export default function QuantoGuardarPorMesPage() {
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
          Quanto guardar por mês para atingir sua meta
        </h1>
        <p className="text-zinc-400 mt-3 leading-relaxed">
          Tem um objetivo — viagem, carro, entrada de um imóvel? Informe o valor, o que já tem
          guardado e o prazo. A calculadora mostra <strong className="text-white">quanto guardar por mês</strong>.
        </p>

        <div className="mt-8">
          <MonthlyGoalCalculator />
        </div>

        <div className="mt-12 space-y-4 text-zinc-300 leading-relaxed [&_h2]:text-white [&_h2]:font-semibold [&_h2]:text-2xl [&_h2]:mt-10 [&_h2]:mb-3 [&_strong]:text-white">
          <h2>A conta por trás da meta</h2>
          <p>
            É simples: <strong>(valor da meta − o que você já tem) ÷ número de meses</strong>. Se a
            meta é R$ 12.000, você já tem R$ 2.000 e quer chegar lá em 10 meses, precisa guardar
            R$ 1.000 por mês.
          </p>

          <h2>Prazo, valor ou gastos: o que ajustar</h2>
          <p>
            Se o valor mensal ficou alto demais, aumente o prazo ou reduza a meta. Se quiser acelerar,
            o caminho é cortar gastos — e é aí que entra organizar o orçamento. Veja também a{" "}
            <Link href="/calculadoras/regra-50-30-20" className="text-cyan-400 hover:underline">
              regra 50/30/20
            </Link>{" "}
            para definir quanto da renda pode ir para metas.
          </p>

          <h2>Automatize para não falhar</h2>
          <p>
            O maior inimigo de uma meta é deixar para guardar o que &quot;sobrar&quot; no fim do mês —
            quase nunca sobra. Trate o aporte como uma conta fixa: separe o valor assim que a renda
            cair.
          </p>
        </div>

        <Faq items={FAQ} />

        <AppCta
          title="Acompanhe suas metas no app gratuito"
          description="Defina o valor-alvo de cada meta e veja o app calcular em quantos meses você chega lá."
        />
      </div>
    </div>
  )
}
