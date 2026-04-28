"use client"
import { useState } from "react"
import { Plus, Trash2, PiggyBank, AlertTriangle } from "lucide-react"
import { InvestmentBucket } from "@/lib/types"
import { formatCurrency, uid, COLORS } from "@/lib/utils"

interface Props {
  buckets: InvestmentBucket[]
  remainder: number
  totalPct: number
  onChange: (buckets: InvestmentBucket[]) => void
}

export function InvestmentSection({ buckets, remainder, totalPct, onChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)

  function update(id: string, field: keyof InvestmentBucket, value: string | number) {
    onChange(buckets.map(b => b.id === id ? { ...b, [field]: value } : b))
  }

  function add() {
    const next: InvestmentBucket = {
      id: uid(),
      name: "Novo Balde",
      percentage: 0,
      color: COLORS[(buckets.length + 4) % COLORS.length],
    }
    onChange([...buckets, next])
    setEditingId(next.id)
  }

  function remove(id: string) {
    onChange(buckets.filter(b => b.id !== id))
  }

  const pctOver = totalPct > 100

  return (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="bg-cyan-500/10 p-2 rounded-xl">
            <PiggyBank className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">Investimentos</h2>
            <p className="text-zinc-500 text-sm">Distribuição do saldo livre</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Saldo livre</p>
          <p className={`font-bold text-xl ${remainder >= 0 ? "text-cyan-400" : "text-red-400"}`}>
            {formatCurrency(remainder)}
          </p>
        </div>
      </div>

      {pctOver && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4 text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Total de {totalPct}% — ultrapassa 100%. Ajuste as porcentagens.
        </div>
      )}

      {remainder < 0 && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Seus gastos superam a renda em {formatCurrency(Math.abs(remainder))}.
        </div>
      )}

      <div className="space-y-3">
        {buckets.map(bucket => {
          const value = remainder > 0 ? (remainder * bucket.percentage) / 100 : 0
          return (
            <div key={bucket.id} className="bg-zinc-800/50 rounded-xl p-3 group">
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: bucket.color }}
                />
                {editingId === bucket.id ? (
                  <input
                    autoFocus
                    className="bg-transparent text-white text-sm flex-1 outline-none"
                    value={bucket.name}
                    onChange={e => update(bucket.id, "name", e.target.value)}
                    onBlur={() => setEditingId(null)}
                    onKeyDown={e => e.key === "Enter" && setEditingId(null)}
                  />
                ) : (
                  <span
                    className="text-zinc-300 text-sm flex-1 cursor-pointer hover:text-white transition-colors"
                    onClick={() => setEditingId(bucket.id)}
                  >
                    {bucket.name}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="bg-zinc-700/60 text-white text-sm rounded-lg px-3 py-1.5 w-20 outline-none focus:ring-1 focus:ring-cyan-500/50 text-right"
                    value={bucket.percentage || ""}
                    placeholder="0"
                    onChange={e => update(bucket.id, "percentage", parseFloat(e.target.value) || 0)}
                  />
                  <span className="text-zinc-500 text-sm">%</span>
                </div>
                <button
                  onClick={() => remove(bucket.id)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-2 ml-6">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-zinc-300 text-sm font-medium">{formatCurrency(value)}</span>
                  <span className="text-zinc-400 text-sm">{bucket.percentage}% do saldo</span>
                </div>
                <div className="h-2.5 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(bucket.percentage, 100)}%`,
                      backgroundColor: bucket.color,
                    }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {totalPct < 100 && remainder > 0 && (
        <div className="mt-3 text-center text-zinc-500 text-sm">
          {100 - totalPct}% não alocado · {formatCurrency(remainder * (100 - totalPct) / 100)} livre
        </div>
      )}

      <button
        onClick={add}
        className="mt-3 w-full flex items-center justify-center gap-2 text-zinc-500 hover:text-cyan-400 text-sm py-2.5 rounded-xl border border-dashed border-zinc-700 hover:border-cyan-500/50 transition-all"
      >
        <Plus className="w-4 h-4" />
        Adicionar balde
      </button>
    </div>
  )
}
