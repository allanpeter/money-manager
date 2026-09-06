"use client"

import Link from "next/link"
import { FormEvent, useMemo, useState } from "react"
import { CreditCard, CreditCardPurchase } from "@/lib/types"
import { formatCurrency, uid } from "@/lib/utils"
import { PurchaseAmountMode, PurchaseSplit, firstInvoiceMonth, splitPurchase } from "@/lib/credit-cards"
import { monthLabel } from "@/lib/months"
import { ChevronDown, CreditCard as CreditCardIcon, Plus, Trash2 } from "lucide-react"

interface Props {
  /** Every card in the wallet, archived included, so old purchases still show their card name. */
  cards: CreditCard[]
  purchases: CreditCardPurchase[]
  onPurchasesChange: (purchases: CreditCardPurchase[]) => void
}

function localDateId() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

/** Spells out the split so the value typed is never confused with what lands on each invoice. */
function purchasePreview({ total, count, first, rest }: PurchaseSplit) {
  if (count === 1) return `Uma parcela de ${formatCurrency(total)}.`
  if (first === rest) return `${count}x de ${formatCurrency(first)} · total ${formatCurrency(total)}`
  return `${count}x · 1ª de ${formatCurrency(first)} e as demais de ${formatCurrency(rest)} · total ${formatCurrency(total)}`
}

/** Registers purchases on existing cards. Creating and editing the cards themselves lives in the Cartões tab. */
export function CardPurchasesSection({ cards, purchases, onPurchasesChange }: Readonly<Props>) {
  const [cardId, setCardId] = useState(cards.find(card => !card.archived)?.id ?? "")
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [purchasedOn, setPurchasedOn] = useState(localDateId())
  const [installments, setInstallments] = useState("1")
  /** "R$ 300 em 3x" and "3x de R$ 100" are the two ways people read a card slip. */
  const [amountMode, setAmountMode] = useState<PurchaseAmountMode>("total")
  const [recurring, setRecurring] = useState(false)
  const orderedPurchases = useMemo(() => [...purchases].sort((a, b) => b.purchasedOn.localeCompare(a.purchasedOn)), [purchases])
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  /** Archived cards keep their history but cannot receive new purchases. */
  const selectableCards = useMemo(() => cards.filter(card => !card.archived), [cards])
  const selectedCard = selectableCards.find(card => card.id === cardId) ?? selectableCards[0]

  /** One panel per card, so a long list stays readable and each card's total is visible at a glance. */
  const groups = useMemo(() => {
    const byCard = new Map<string, CreditCardPurchase[]>()
    for (const purchase of orderedPurchases) {
      byCard.set(purchase.creditCardId, [...(byCard.get(purchase.creditCardId) ?? []), purchase])
    }
    return [...byCard.entries()].map(([id, items]) => ({
      id,
      card: cards.find(card => card.id === id),
      items,
      total: items.reduce((sum, item) => sum + item.amount, 0),
    })).sort((a, b) => Number(a.card?.archived ?? false) - Number(b.card?.archived ?? false))
  }, [cards, orderedPurchases])

  /** Falls back to the card picked in the form, so the panel you are lançando into is already open. */
  const expandedId = openCardId ?? selectedCard?.id ?? groups[0]?.id

  /** Recurring purchases charge the same value every month, so they always read the field as a whole. */
  const parcels = recurring ? 1 : Math.max(1, Number.parseInt(installments) || 1)
  const typedValue = Number.parseFloat(amount.replace(",", "."))
  const split = Number.isFinite(typedValue) && typedValue > 0
    ? splitPurchase(typedValue, parcels, recurring ? "total" : amountMode)
    : null

  function addPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedCard || !name.trim() || !split || split.total <= 0) return
    onPurchasesChange([...purchases, {
      id: uid(), creditCardId: selectedCard.id, name: name.trim(), amount: split.total, purchasedOn,
      installments: recurring || split.count === 1 ? undefined : split.count,
      recurring: recurring || undefined,
      active: recurring ? true : undefined,
    }])
    setName("")
    setAmount("")
    setInstallments("1")
    setAmountMode("total")
    setRecurring(false)
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-500/10 p-2 text-violet-300"><CreditCardIcon className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-semibold text-white">Compras no cartão</h2>
            <p className="text-sm text-zinc-500">A fatura usa o vencimento do cartão e reúne compras e parcelas.</p>
          </div>
        </div>
        <Link href="/cartoes" className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-200 hover:bg-violet-500/20">Gerenciar cartões</Link>
      </div>

      {selectableCards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 px-5 py-8 text-center">
          <p className="text-zinc-300">{cards.length === 0 ? "Nenhum cartão cadastrado nesta carteira." : "Todos os cartões desta carteira estão arquivados."}</p>
          <p className="mt-1 text-sm text-zinc-500">Cadastre um cartão na aba <Link href="/cartoes" className="text-violet-300 underline underline-offset-2">Cartões</Link> para lançar compras aqui.</p>
        </div>
      ) : (
        <form onSubmit={addPurchase} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[150px_minmax(160px,1fr)_130px_145px_150px_90px_120px_auto] lg:items-end">
          <label className="text-xs text-zinc-500">Cartão
            <select value={selectedCard?.id ?? ""} onChange={event => setCardId(event.target.value)} className="mt-1 w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50">{selectableCards.map(card => <option key={card.id} value={card.id}>{card.name}{card.lastFour ? ` •••• ${card.lastFour}` : ""}</option>)}</select>
          </label>
          <label className="text-xs text-zinc-500">Compra
            <input value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Mercado Livre" className="mt-1 w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50" />
          </label>
          <label className="text-xs text-zinc-500">{recurring || amountMode === "total" ? "Valor total" : "Valor da parcela"}
            <input type="number" min={0} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0,00" className="mt-1 w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50" />
          </label>
          <label className="text-xs text-zinc-500">O valor é
            <select value={amountMode} disabled={recurring} onChange={event => setAmountMode(event.target.value as PurchaseAmountMode)} className="mt-1 w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50 disabled:cursor-not-allowed disabled:opacity-40">
              <option value="total">o total da compra</option>
              <option value="installment">de cada parcela</option>
            </select>
          </label>
          <label className="text-xs text-zinc-500">Data da compra
            <input type="date" value={purchasedOn} onChange={event => setPurchasedOn(event.target.value)} className="mt-1 w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50" />
          </label>
          <label className="text-xs text-zinc-500">Parcelas
            <input type="number" min={1} disabled={recurring} value={installments} onChange={event => setInstallments(event.target.value)} className="mt-1 w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50 disabled:cursor-not-allowed disabled:opacity-40" />
          </label>
          <label className="flex h-10 items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={recurring} onChange={event => { setRecurring(event.target.checked); if (event.target.checked) setInstallments("1") }} className="h-4 w-4 accent-violet-500" />Recorrente</label>
          <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-500 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-400"><Plus className="h-4 w-4" />Adicionar</button>
          {recurring
            ? <p className="text-xs text-violet-200 lg:col-span-8">Será lançada todo mês na fatura até você desativá-la.</p>
            : split && <p className="text-xs text-violet-200 lg:col-span-8">{purchasePreview(split)}</p>}
        </form>
      )}

      {groups.length > 0 && <div className="mt-5 space-y-2 border-t border-zinc-800 pt-4">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Compras cadastradas</p>
        {groups.map(group => {
          const expanded = expandedId === group.id
          return (
            <div key={group.id} className={`overflow-hidden rounded-xl border border-zinc-800 ${group.card?.archived ? "opacity-60" : ""}`}>
              <button
                type="button"
                onClick={() => setOpenCardId(expanded ? "" : group.id)}
                aria-expanded={expanded}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left hover:bg-zinc-800/40"
              >
                {group.card && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: group.card.color }} />}
                <span className="font-medium text-zinc-200">{group.card ? `${group.card.name}${group.card.lastFour ? ` •••• ${group.card.lastFour}` : ""}` : "Cartão removido"}</span>
                {group.card?.archived && <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">Arquivado</span>}
                <span className="ml-auto flex items-center gap-4 text-sm text-zinc-500">
                  <span>{group.items.length} {group.items.length === 1 ? "compra" : "compras"}</span>
                  <span className="text-zinc-400">{formatCurrency(group.total)}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </span>
              </button>

              {expanded && <div className="space-y-2 border-t border-zinc-800 p-3">
                {group.items.map(purchase => {
                  const firstMonth = group.card ? firstInvoiceMonth(purchase, group.card) : null
                  return (
                    <div key={purchase.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-zinc-800/30 px-3 py-2 text-sm">
                      <span className="font-medium text-zinc-200">{purchase.name}</span>
                      <span className="text-zinc-400">{formatCurrency(purchase.amount)}{purchase.recurring ? " · recorrente" : purchase.installments ? ` em ${purchase.installments}x` : ""}</span>
                      <span className="text-xs text-violet-300">{firstMonth ? `${purchase.recurring ? "Início: " : "1ª fatura: "}${monthLabel(firstMonth)}` : ""}</span>
                      {purchase.recurring && <button type="button" onClick={() => onPurchasesChange(purchases.map(item => item.id === purchase.id ? { ...item, active: item.active === false } : item))} className={`rounded-lg px-2 py-1 text-xs ${purchase.active === false ? "bg-zinc-700 text-zinc-300" : "bg-emerald-500/10 text-emerald-300"}`}>{purchase.active === false ? "Ativar" : "Desativar"}</button>}
                      <button type="button" onClick={() => onPurchasesChange(purchases.filter(item => item.id !== purchase.id))} className="ml-auto text-zinc-600 hover:text-red-400" aria-label={`Excluir ${purchase.name}`}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )
                })}
              </div>}
            </div>
          )
        })}
      </div>}
    </section>
  )
}
