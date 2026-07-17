"use client"
import { useState } from "react"
import { Plus, Trash2, Repeat } from "lucide-react"
import { RecurringExpense, PaymentMethod } from "@/lib/types"
import { formatCurrency, uid, COLORS } from "@/lib/utils"
import { currentMonthId, monthLabel, shiftMonth } from "@/lib/months"

interface Props {
  items: RecurringExpense[]
  onChange: (items: RecurringExpense[]) => void
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix",
  credit: "Crédito",
  debit: "Débito",
  cash: "Dinheiro",
}

/** Number of whole months between two "YYYY-MM" ids (b - a). */
function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number)
  const [by, bm] = b.split("-").map(Number)
  return (by - ay) * 12 + (bm - am)
}

function isActiveNow(item: RecurringExpense): boolean {
  const today = currentMonthId()
  if (today < item.startMonth) return false
  if (item.installments == null) return true
  return today <= shiftMonth(item.startMonth, item.installments - 1)
}

function statusLabel(item: RecurringExpense): string {
  const today = currentMonthId()
  if (today < item.startMonth) return `Começa em ${monthLabel(item.startMonth)}`
  if (item.installments == null) return "Fixo mensal"
  const endMonth = shiftMonth(item.startMonth, item.installments - 1)
  if (today > endMonth) return `Encerrado em ${monthLabel(endMonth)}`
  const current = Math.min(monthsBetween(item.startMonth, today) + 1, item.installments)
  return `Parcela ${current}/${item.installments}`
}

export function RecurringExpensesSection({ items, onChange }: Readonly<Props>) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const total = items.filter(isActiveNow).reduce((s, i) => s + i.amount, 0)

  function update(id: string, field: keyof RecurringExpense, value: string | number | undefined) {
    onChange(items.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  function setInstallmentMode(id: string, installments: number | undefined) {
    onChange(items.map(i => i.id === id ? { ...i, installments } : i))
  }

  function add() {
    const next: RecurringExpense = {
      id: uid(),
      name: "Novo gasto fixo",
      amount: 0,
      color: COLORS[items.length % COLORS.length],
      startMonth: currentMonthId(),
    }
    onChange([...items, next])
    setEditingId(next.id)
  }

  function remove(id: string) {
    onChange(items.filter(i => i.id !== id))
  }

  return (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500/10 p-2 rounded-xl">
            <Repeat className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">Gastos Fixos</h2>
            <p className="text-zinc-500 text-sm">Cadastre uma vez e ele se repete todo mês (ou por N parcelas)</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Ativos agora</p>
          <p className="text-orange-400 font-bold text-xl">{formatCurrency(total)}</p>
        </div>
      </div>

      {items.length === 0 && (
        <div className="text-center py-6 px-4 mb-3 rounded-xl border border-dashed border-zinc-800">
          <p className="text-zinc-400 text-sm mb-1">Nenhum gasto fixo cadastrado</p>
          <p className="text-zinc-600 text-xs">Ex.: Aluguel, assinaturas, ou um parcelamento de 10x</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="bg-zinc-800/50 rounded-xl p-3 group">
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              {editingId === item.id ? (
                <input
                  autoFocus
                  className="bg-transparent text-white text-sm flex-1 outline-none"
                  value={item.name}
                  onChange={e => update(item.id, "name", e.target.value)}
                  onBlur={() => setEditingId(null)}
                  onKeyDown={e => e.key === "Enter" && setEditingId(null)}
                />
              ) : (
                <button
                  className="text-zinc-300 text-sm flex-1 text-left cursor-pointer hover:text-white transition-colors"
                  onClick={() => setEditingId(item.id)}
                >
                  {item.name}
                </button>
              )}
              <div className="flex items-center gap-1 text-zinc-400">
                <span className="text-sm">R$</span>
                <input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  enterKeyHint="done"
                  className="bg-zinc-700/60 text-white text-sm rounded-lg px-3 py-1.5 w-24 sm:w-32 outline-none focus:ring-1 focus:ring-orange-500/50 text-right"
                  value={item.amount || ""}
                  placeholder="0,00"
                  onChange={e => update(item.id, "amount", Number.parseFloat(e.target.value) || 0)}
                />
              </div>
              <button
                onClick={() => remove(item.id)}
                className="text-zinc-600 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-2 ml-6 flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-1.5 text-zinc-500 text-xs bg-zinc-700/40 rounded-lg px-2 py-1">
                desde
                <input
                  type="month"
                  value={item.startMonth}
                  onChange={e => update(item.id, "startMonth", e.target.value)}
                  className="bg-transparent text-zinc-300 outline-none"
                />
              </label>

              <div className="flex bg-zinc-700/40 rounded-lg p-0.5 text-xs">
                <button
                  onClick={() => setInstallmentMode(item.id, undefined)}
                  className={`px-2 py-0.5 rounded-md transition-colors ${
                    item.installments == null ? "bg-zinc-600 text-white" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Indeterminado
                </button>
                <button
                  onClick={() => setInstallmentMode(item.id, item.installments ?? 12)}
                  className={`px-2 py-0.5 rounded-md transition-colors ${
                    item.installments != null ? "bg-zinc-600 text-white" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Parcelado
                </button>
              </div>

              {item.installments != null && (
                <label className="flex items-center gap-1.5 text-zinc-500 text-xs bg-zinc-700/40 rounded-lg px-2 py-1">
                  em
                  <input
                    type="number"
                    min={1}
                    value={item.installments}
                    onChange={e => setInstallmentMode(item.id, Math.max(1, Number.parseInt(e.target.value) || 1))}
                    className="bg-transparent text-zinc-300 outline-none w-10"
                  />
                  x
                </label>
              )}

              <select
                value={item.paymentMethod ?? ""}
                onChange={e => update(item.id, "paymentMethod", (e.target.value || undefined) as PaymentMethod | undefined)}
                className="bg-zinc-700/40 text-zinc-400 text-xs rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-orange-500/50"
              >
                <option value="">Forma de pgto</option>
                {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map(m => (
                  <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>
                ))}
              </select>

              <span className="text-orange-400/80 text-xs ml-auto">{statusLabel(item)}</span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={add}
        className="mt-3 w-full flex items-center justify-center gap-2 text-zinc-500 hover:text-orange-400 text-sm py-2.5 rounded-xl border border-dashed border-zinc-700 hover:border-orange-500/50 transition-all"
      >
        <Plus className="w-4 h-4" />
        Adicionar gasto fixo
      </button>
    </div>
  )
}
