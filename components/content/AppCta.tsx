import Link from "next/link"
import { ArrowRight } from "lucide-react"

interface Props {
  title?: string
  description?: string
  href?: string
  label?: string
}

export function AppCta({
  title = "Organize suas finanças no app gratuito",
  description = "Registre entradas e gastos, veja quanto sobra e acompanhe suas metas mês a mês. Sem cadastro.",
  href = "/",
  label = "Abrir o Gestor Financeiro",
}: Readonly<Props>) {
  return (
    <div className="mt-12 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
      <h2 className="text-white font-semibold text-xl">{title}</h2>
      <p className="text-zinc-400 text-sm mt-2 mb-4">{description}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-2 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-xl px-5 py-3 text-sm font-medium transition-all"
      >
        {label}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
