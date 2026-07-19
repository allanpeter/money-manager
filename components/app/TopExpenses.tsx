"use client"
import { formatCurrency } from "@/lib/utils"

export interface TopExpenseItem {
  id: string
  name: string
  amount: number
  color: string
}

interface Props {
  items: TopExpenseItem[]
  total: number
}

/** The 5 largest expenses of the month, with each one's share of total spending. */
export function TopExpenses({ items, total }: Readonly<Props>) {
  const top = [...items].filter(i => i.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 5)

  return (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <h3 className="text-white font-semibold mb-1">Maiores gastos</h3>
      <p className="text-zinc-500 text-sm mb-4">Onde o dinheiro está indo</p>

      {top.length === 0 ? (
        <p className="text-zinc-600 text-sm py-4 text-center">Sem gastos registrados neste mês.</p>
      ) : (
        <div className="space-y-2.5">
          {top.map(item => {
            const pct = total > 0 ? Math.round((item.amount / total) * 100) : 0
            return (
              <div key={item.id} className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-zinc-300 text-sm flex-1 truncate">{item.name}</span>
                <span className="text-zinc-500 text-xs w-10 text-right">{pct}%</span>
                <span className="text-white text-sm font-medium w-28 text-right">{formatCurrency(item.amount)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
