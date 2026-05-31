import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ContentList } from "@/components/content/ContentList"
import { GUIDES } from "@/lib/content"

export const metadata: Metadata = {
  title: "Guias de finanças pessoais",
  description:
    "Guias práticos de finanças pessoais: como começar, economizar todo mês, montar reserva e escolher entre planilha e app.",
  alternates: { canonical: "/guias" },
}

export default function GuiasIndexPage() {
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

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Guias de finanças pessoais</h1>
        <p className="text-zinc-400 mt-3 leading-relaxed">
          Conteúdo direto ao ponto para você organizar o dinheiro, economizar e construir suas metas.
        </p>

        <div className="mt-8">
          <ContentList items={GUIDES} />
        </div>

        <p className="text-zinc-500 text-sm mt-8">
          Prefere colocar a mão na massa? Use as{" "}
          <Link href="/calculadoras" className="text-cyan-400 hover:underline">calculadoras gratuitas</Link>.
        </p>
      </div>
    </div>
  )
}
