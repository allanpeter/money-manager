import { formatCurrency } from "@/lib/utils"

interface WalletSummary {
  id: string
  name: string
  income: number
  expenses: number
  remainder: number
}

interface Props {
  breakdown: WalletSummary[]
}

export function WalletBreakdown({ breakdown }: Readonly<Props>) {
  return (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <h3 className="text-white font-semibold mb-1">Por carteira</h3>
      <p className="text-zinc-500 text-sm mb-4">Consolidado do mês selecionado</p>

      <div className="space-y-2">
        <div className="hidden sm:grid grid-cols-4 gap-4 text-zinc-500 text-xs uppercase tracking-wider px-3">
          <span>Carteira</span>
          <span className="text-right">Entradas</span>
          <span className="text-right">Gastos</span>
          <span className="text-right">Saldo</span>
        </div>
        {breakdown.map(w => (
          <div
            key={w.id}
            className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 items-center bg-zinc-800/40 rounded-xl px-3 py-2.5"
          >
            <span className="text-white text-sm font-medium col-span-2 sm:col-span-1">{w.name}</span>
            <span className="text-emerald-400 text-sm text-right">{formatCurrency(w.income)}</span>
            <span className="text-red-400 text-sm text-right">{formatCurrency(w.expenses)}</span>
            <span className={`text-sm text-right font-semibold ${w.remainder >= 0 ? "text-cyan-400" : "text-red-400"}`}>
              {formatCurrency(w.remainder)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
