import { ArrowRight } from "lucide-react"
import { getAffiliate, type AffiliateSlot } from "@/lib/affiliates"

interface Props {
  slot: AffiliateSlot
  /** Texto opcional acima do botão para dar contexto ao parceiro. */
  intro?: string
}

/**
 * Renderiza um link de parceiro com `rel="sponsored nofollow"` e o aviso de
 * patrocínio exigido por lei. Não renderiza nada se o slot não estiver ativo
 * em `lib/affiliates.ts` — então é seguro deixar no conteúdo desde já.
 */
export function AffiliateCard({ slot, intro }: Readonly<Props>) {
  const affiliate = getAffiliate(slot)
  if (!affiliate) return null

  return (
    <div className="my-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      {intro && <p className="text-zinc-300 text-sm mb-3">{intro}</p>}
      <a
        href={affiliate.url}
        target="_blank"
        rel="sponsored nofollow noopener"
        className="inline-flex items-center gap-2 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-xl px-5 py-3 text-sm font-medium transition-all"
      >
        {affiliate.label}
        <ArrowRight className="w-4 h-4" />
      </a>
      <p className="text-zinc-600 text-xs mt-3">
        Link de parceiro{affiliate.partner ? ` (${affiliate.partner})` : ""}. Podemos receber uma
        comissão, sem custo adicional para você. Conteúdo educacional, não é recomendação de
        investimento.
      </p>
    </div>
  )
}
