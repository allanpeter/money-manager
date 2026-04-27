import { formatCurrency } from "@/lib/utils"
import { TrendingUp, TrendingDown, Wallet } from "lucide-react"

interface Props {
  income: number
  expenses: number
  remainder: number
}

export function SummaryBar({ income, expenses, remainder }: Props) {
  const savingsRate = income > 0 ? Math.round((remainder / income) * 100) : 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800 flex items-center gap-4">
        <div className="bg-emerald-500/10 p-3 rounded-xl">
          <TrendingUp className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Entradas</p>
          <p className="text-white font-bold text-2xl">{formatCurrency(income)}</p>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800 flex items-center gap-4">
        <div className="bg-red-500/10 p-3 rounded-xl">
          <TrendingDown className="w-6 h-6 text-red-400" />
        </div>
        <div>
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Gastos</p>
          <p className="text-white font-bold text-2xl">{formatCurrency(expenses)}</p>
        </div>
      </div>

      <div className={`rounded-2xl p-5 border flex items-center gap-4 ${
        remainder >= 0
          ? "bg-zinc-900 border-zinc-800"
          : "bg-red-500/5 border-red-500/20"
      }`}>
        <div className={`p-3 rounded-xl ${remainder >= 0 ? "bg-cyan-500/10" : "bg-red-500/10"}`}>
          <Wallet className={`w-6 h-6 ${remainder >= 0 ? "text-cyan-400" : "text-red-400"}`} />
        </div>
        <div>
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">
            Saldo livre · <span className={remainder >= 0 ? "text-cyan-400" : "text-red-400"}>{savingsRate}% da renda</span>
          </p>
          <p className={`font-bold text-2xl ${remainder >= 0 ? "text-white" : "text-red-400"}`}>
            {formatCurrency(remainder)}
          </p>
        </div>
      </div>
    </div>
  )
}
