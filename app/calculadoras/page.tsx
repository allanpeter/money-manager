import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ContentList } from "@/components/content/ContentList"
import { CALCULATORS } from "@/lib/content"

export const metadata: Metadata = {
  title: "Calculadoras financeiras gratuitas",
  description:
    "Calculadoras gratuitas para organizar seu dinheiro: reserva de emergência, regra 50/30/20 e quanto guardar por mês.",
  alternates: { canonical: "/calculadoras" },
}

export default function CalculadorasIndexPage() {
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

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Calculadoras financeiras</h1>
        <p className="text-zinc-400 mt-3 leading-relaxed">
          Ferramentas gratuitas para planejar seu dinheiro. Todo o cálculo é feito no seu navegador,
          sem cadastro.
        </p>

        <div className="mt-8">
          <ContentList items={CALCULATORS} />
        </div>

        <p className="text-zinc-500 text-sm mt-8">
          Quer entender os conceitos? Veja os{" "}
          <Link href="/guias" className="text-cyan-400 hover:underline">guias de finanças pessoais</Link>.
        </p>
      </div>
    </div>
  )
}
