"use client"
import { useState } from "react"
import { CalendarDays, CreditCard as CreditCardIcon, Plus, Trash2, ShoppingCart } from "lucide-react"
import { CreditCard, ExpenseCategory, ExpenseType, PaymentMethod } from "@/lib/types"
import { formatCurrency, uid, COLORS } from "@/lib/utils"

interface Props {
  categories: ExpenseCategory[]
  total: number
  cards: CreditCard[]
  onChange: (categories: ExpenseCategory[]) => void
  onMoveToCard: (expenseId: string, creditCardId: string, purchasedOn: string, installments?: number, recurring?: boolean) => void
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix",
  credit: "Crédito",
  debit: "Débito",
  cash: "Dinheiro",
}

function localDateId() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export function ExpensesSection({ categories, total, cards, onChange, onMoveToCard }: Readonly<Props>) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [cardId, setCardId] = useState("")
  const [purchasedOn, setPurchasedOn] = useState(localDateId())
  const [installments, setInstallments] = useState("1")
  const [recurring, setRecurring] = useState(false)

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
    if (linkingId === id) setLinkingId(null)
  }

  function startCardLink(id: string) {
    setLinkingId(id)
    setCardId(cards[0]?.id ?? "")
    setPurchasedOn(localDateId())
    setInstallments("1")
    setRecurring(false)
  }

  function moveToCard(id: string) {
    const parcels = Math.max(1, Number.parseInt(installments, 10) || 1)
    if (!cardId || !purchasedOn) return
    onMoveToCard(id, cardId, purchasedOn, parcels, recurring)
    setLinkingId(null)
  }

  return (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="bg-red-500/10 p-2 rounded-xl">
            <ShoppingCart className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">Gastos avulsos</h2>
            <p className="text-zinc-500 text-sm">Só neste mês (para fixos, use Gastos Fixos)</p>
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
              {cat.paymentMethod === "credit" && (
                cards.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => linkingId === cat.id ? setLinkingId(null) : startCardLink(cat.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-violet-500/10 px-2 py-1 text-xs text-violet-200 hover:bg-violet-500/20"
                  >
                    <CreditCardIcon className="h-3.5 w-3.5" />
                    {linkingId === cat.id ? "Cancelar vínculo" : "Vincular cartão"}
                  </button>
                ) : (
                  <span className="text-xs text-amber-300">Cadastre um cartão para vincular esta compra.</span>
                )
              )}
            </div>
            {linkingId === cat.id && (
              <div className="mt-3 ml-6 grid gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 sm:grid-cols-[minmax(160px,1fr)_150px_100px_120px_auto] sm:items-end">
                <label className="text-xs text-zinc-400">Cartão
                  <select value={cardId} onChange={event => setCardId(event.target.value)} className="mt-1 w-full rounded-lg bg-zinc-950 px-2.5 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50">
                    {cards.map(card => <option key={card.id} value={card.id}>{card.name}{card.lastFour ? ` •••• ${card.lastFour}` : ""}</option>)}
                  </select>
                </label>
                <label className="text-xs text-zinc-400">Data da compra
                  <div className="relative mt-1"><CalendarDays className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" /><input type="date" value={purchasedOn} onChange={event => setPurchasedOn(event.target.value)} className="w-full rounded-lg bg-zinc-950 py-2 pl-8 pr-2 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50" /></div>
                </label>
                <label className="text-xs text-zinc-400">Parcelas
                  <input type="number" min={1} disabled={recurring} value={installments} onChange={event => setInstallments(event.target.value)} className="mt-1 w-full rounded-lg bg-zinc-950 px-2.5 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50 disabled:cursor-not-allowed disabled:opacity-40" />
                </label>
                <label className="flex h-10 items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={recurring} onChange={event => { setRecurring(event.target.checked); if (event.target.checked) setInstallments("1") }} className="h-4 w-4 accent-violet-500" />Recorrente</label>
                <button type="button" onClick={() => moveToCard(cat.id)} className="rounded-lg bg-violet-500 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-400">Mover para fatura</button>
                <p className="sm:col-span-5 text-xs text-zinc-500">{recurring ? "Entrará em toda fatura até ser desativado." : "Este gasto será removido daqui e entrará na fatura conforme a data de compra e o fechamento."}</p>
              </div>
            )}
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
