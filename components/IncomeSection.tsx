"use client"
import { useState } from "react"
import { Plus, Trash2, TrendingUp } from "lucide-react"
import { IncomeSource } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"

interface Props {
  sources: IncomeSource[]
  total: number
  onChange: (sources: IncomeSource[]) => void
}

function uid() { return Math.random().toString(36).slice(2) }

export function IncomeSection({ sources, total, onChange }: Readonly<Props>) {
  const [editingId, setEditingId] = useState<string | null>(null)

  function update(id: string, field: keyof IncomeSource, value: string | number) {
    onChange(sources.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  function add() {
    const next = { id: uid(), name: "Nova Entrada", amount: 0 }
    onChange([...sources, next])
    setEditingId(next.id)
  }

  function remove(id: string) {
    onChange(sources.filter(s => s.id !== id))
  }

  return (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 p-2 rounded-xl">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">Entradas</h2>
            <p className="text-zinc-500 text-sm">Fontes de renda mensal</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Total</p>
          <p className="text-emerald-400 font-bold text-xl">{formatCurrency(total)}</p>
        </div>
      </div>

      <div className="space-y-3">
        {sources.map(source => (
          <div key={source.id} className="flex items-center gap-3 bg-zinc-800/50 rounded-xl p-3 group">
            {editingId === source.id ? (
              <input
                autoFocus
                className="bg-transparent text-white text-sm flex-1 outline-none"
                value={source.name}
                onChange={e => update(source.id, "name", e.target.value)}
                onBlur={() => setEditingId(null)}
                onKeyDown={e => e.key === "Enter" && setEditingId(null)}
              />
            ) : (
              <button
                className="text-zinc-300 text-sm flex-1 text-left cursor-pointer hover:text-white transition-colors"
                onClick={() => setEditingId(source.id)}
              >
                {source.name}
              </button>
            )}
            <div className="flex items-center gap-1 text-zinc-400">
              <span className="text-sm">R$</span>
              <input
                type="number"
                min={0}
                className="bg-zinc-700/60 text-white text-sm rounded-lg px-3 py-1.5 w-24 sm:w-32 outline-none focus:ring-1 focus:ring-emerald-500/50 text-right"
                value={source.amount || ""}
                placeholder="0,00"
                onChange={e => update(source.id, "amount", Number.parseFloat(e.target.value) || 0)}
              />
            </div>
            {sources.length > 1 && (
              <button
                onClick={() => remove(source.id)}
                className="text-zinc-600 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={add}
        className="mt-3 w-full flex items-center justify-center gap-2 text-zinc-500 hover:text-emerald-400 text-sm py-2.5 rounded-xl border border-dashed border-zinc-700 hover:border-emerald-500/50 transition-all"
      >
        <Plus className="w-4 h-4" />
        Adicionar entrada
      </button>
    </div>
  )
}
