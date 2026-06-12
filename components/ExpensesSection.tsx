"use client"
import { useState } from "react"
import { Plus, Trash2, ShoppingCart } from "lucide-react"
import { ExpenseCategory, ExpenseType, PaymentMethod } from "@/lib/types"
import { formatCurrency, uid, COLORS } from "@/lib/utils"

interface Props {
  categories: ExpenseCategory[]
  total: number
  onChange: (categories: ExpenseCategory[]) => void
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix",
  credit: "Crédito",
  debit: "Débito",
  cash: "Dinheiro",
}

export function ExpensesSection({ categories, total, onChange }: Readonly<Props>) {
  const [editingId, setEditingId] = useState<string | null>(null)

  function update(id: string, field: keyof ExpenseCategory, value: string | number) {
    onChange(categories.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  function setType(id: string, type: ExpenseType) {
    onChange(categories.map(c => c.id === id ? { ...c, type } : c))
  }

  function setPayment(id: string, paymentMethod: PaymentMethod | undefined) {
    onChange(categories.map(c => c.id === id ? { ...c, paymentMethod } : c))
  }

  function add() {
    const next: ExpenseCategory = {
      id: uid(),
      name: "Nova Categoria",
      amount: 0,
      type: "variable",
      color: COLORS[categories.length % COLORS.length],
    }
    onChange([...categories, next])
    setEditingId(next.id)
  }

  function remove(id: string) {
    onChange(categories.filter(c => c.id !== id))
  }

  return (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="bg-red-500/10 p-2 rounded-xl">
            <ShoppingCart className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">Gastos</h2>
            <p className="text-zinc-500 text-sm">Categorias de despesa mensal</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Total</p>
          <p className="text-red-400 font-bold text-xl">{formatCurrency(total)}</p>
        </div>
      </div>

      {categories.length === 0 && (
        <div className="text-center py-6 px-4 mb-3 rounded-xl border border-dashed border-zinc-800">
          <p className="text-zinc-400 text-sm mb-1">Comece pelos seus 2 ou 3 maiores gastos</p>
          <p className="text-zinc-600 text-xs">Ex.: Moradia, Alimentação, Transporte</p>
        </div>
      )}

      <div className="space-y-3">
        {categories.map(cat => (
          <div key={cat.id} className="bg-zinc-800/50 rounded-xl p-3 group">
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              {editingId === cat.id ? (
                <input
                  autoFocus
                  className="bg-transparent text-white text-sm flex-1 outline-none"
                  value={cat.name}
                  onChange={e => update(cat.id, "name", e.target.value)}
                  onBlur={() => setEditingId(null)}
                  onKeyDown={e => e.key === "Enter" && setEditingId(null)}
                />
              ) : (
                <button
                  className="text-zinc-300 text-sm flex-1 text-left cursor-pointer hover:text-white transition-colors"
                  onClick={() => setEditingId(cat.id)}
                >
                  {cat.name}
                </button>
              )}
              <div className="flex items-center gap-1 text-zinc-400">
                <span className="text-sm">R$</span>
                <input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  enterKeyHint="done"
                  className="bg-zinc-700/60 text-white text-sm rounded-lg px-3 py-1.5 w-24 sm:w-32 outline-none focus:ring-1 focus:ring-red-500/50 text-right"
                  value={cat.amount || ""}
                  placeholder="0,00"
                  onChange={e => update(cat.id, "amount", Number.parseFloat(e.target.value) || 0)}
                />
              </div>
              <button
                onClick={() => remove(cat.id)}
                className="text-zinc-600 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-2 ml-6 flex items-center gap-2 flex-wrap">
              <div className="flex bg-zinc-700/40 rounded-lg p-0.5 text-xs">
                <button
                  onClick={() => setType(cat.id, "fixed")}
                  className={`px-2 py-0.5 rounded-md transition-colors ${
                    cat.type === "fixed" ? "bg-zinc-600 text-white" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Fixo
                </button>
                <button
                  onClick={() => setType(cat.id, "variable")}
                  className={`px-2 py-0.5 rounded-md transition-colors ${
                    cat.type === "variable" ? "bg-zinc-600 text-white" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Variável
                </button>
              </div>
              <select
                value={cat.paymentMethod ?? ""}
                onChange={e => setPayment(cat.id, (e.target.value || undefined) as PaymentMethod | undefined)}
                className="bg-zinc-700/40 text-zinc-400 text-xs rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-red-500/50"
              >
                <option value="">Forma de pgto</option>
                {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map(m => (
                  <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={add}
        className="mt-3 w-full flex items-center justify-center gap-2 text-zinc-500 hover:text-red-400 text-sm py-2.5 rounded-xl border border-dashed border-zinc-700 hover:border-red-500/50 transition-all"
      >
        <Plus className="w-4 h-4" />
        Adicionar categoria
      </button>
    </div>
  )
}
