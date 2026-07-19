"use client"
import { formatCurrency } from "@/lib/utils"

interface Props {
  fixed: number
  variable: number
}

/** Horizontal split of the month's spending into fixed (recurring) vs variable (one-off). */
export function FixedVsVariable({ fixed, variable }: Readonly<Props>) {
  const total = fixed + variable
  const fixedPct = total > 0 ? Math.round((fixed / total) * 100) : 0
  const variablePct = total > 0 ? 100 - fixedPct : 0

  return (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <h3 className="text-white font-semibold mb-1">Fixo vs Variável</h3>
      <p className="text-zinc-500 text-sm mb-4">Composição dos gastos do mês</p>

      {total === 0 ? (
        <p className="text-zinc-600 text-sm py-4 text-center">Sem gastos registrados neste mês.</p>
      ) : (
        <>
          <div className="flex h-3 rounded-full overflow-hidden bg-zinc-800">
            <div className="bg-orange-400" style={{ width: `${fixedPct}%` }} />
            <div className="bg-violet-400" style={{ width: `${variablePct}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-orange-400 flex-shrink-0" />
              <div>
                <p className="text-zinc-500 text-xs">Fixos · {fixedPct}%</p>
                <p className="text-white font-semibold">{formatCurrency(fixed)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-violet-400 flex-shrink-0" />
              <div>
                <p className="text-zinc-500 text-xs">Variáveis · {variablePct}%</p>
                <p className="text-white font-semibold">{formatCurrency(variable)}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
