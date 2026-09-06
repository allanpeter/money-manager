"use client"

import Link from "next/link"
import { useState } from "react"
import { Archive, ArchiveRestore, ChevronDown, CreditCard as CreditCardIcon, Plus, ReceiptText, Trash2 } from "lucide-react"
import { useApp } from "@/components/app/AppDataProvider"
import { archiveCardMessage, creditCardInvoicesForMonth, firstInvoiceMonth } from "@/lib/credit-cards"
import { COLORS, formatCurrency, uid } from "@/lib/utils"
import { monthLabel } from "@/lib/months"

export default function CartoesPage() {
  const {
    wallets, activeMonthId, activeWalletId,
    addCreditCardTo, updateCreditCardIn, removeCreditCardFrom, setCreditCardArchived,
    updateCreditCardPurchaseIn, removeCreditCardPurchaseFrom,
  } = useApp()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editingDays, setEditingDays] = useState<Record<string, string>>({})

  const entries = wallets.flatMap(wallet =>
    (wallet.creditCards ?? []).map(card => {
      const invoice = creditCardInvoicesForMonth(wallet, activeMonthId).find(item => item.card.id === card.id)
      const purchases = (wallet.creditCardPurchases ?? []).filter(purchase => purchase.creditCardId === card.id)
      return { wallet, card, invoice, purchases, key: `${wallet.id}:${card.id}` }
    }),
  ).sort((a, b) => Number(a.card.archived ?? false) - Number(b.card.archived ?? false))

  function dayKey(cardKey: string, field: "closingDay" | "dueDay") {
    return `${cardKey}:${field}`
  }

  /** Days are committed on blur so a half-typed value never lands in the store. */
  function commitDay(walletId: string, cardId: string, cardKey: string, field: "closingDay" | "dueDay") {
    const key = dayKey(cardKey, field)
    const value = Number(editingDays[key])
    if (value >= 1 && value <= 31) updateCreditCardIn(walletId, cardId, { [field]: value })
    setEditingDays(current => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-500/10 p-2 text-violet-300"><CreditCardIcon className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-semibold text-white">Cartões de crédito</h2>
            <p className="text-sm text-zinc-500">Abra um cartão para ver a fatura de {monthLabel(activeMonthId)}, editar os dados e conferir as compras.</p>
          </div>
        </div>
        <button onClick={() => setCreating(current => !current)} className="inline-flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-200 hover:bg-violet-500/20"><Plus className="h-4 w-4" />Novo cartão</button>
      </div>

      {creating && <NewCardForm wallets={wallets.map(wallet => ({ id: wallet.id, name: wallet.name }))} defaultWalletId={activeWalletId} onCancel={() => setCreating(false)} onCreate={(walletId, card) => { addCreditCardTo(walletId, card); setCreating(false); setExpandedId(`${walletId}:${card.id}`) }} />}

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 px-5 py-10 text-center">
          <CreditCardIcon className="mx-auto mb-3 h-7 w-7 text-zinc-600" />
          <p className="text-zinc-300">Nenhum cartão cadastrado.</p>
          <p className="mt-1 text-sm text-zinc-500">Use o botão “Novo cartão” para começar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(({ wallet, card, invoice, purchases, key }) => {
            const expanded = expandedId === key
            return (
              <article key={key} className={`overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/50 ${card.archived ? "opacity-60" : ""}`}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : key)}
                  aria-expanded={expanded}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left hover:bg-zinc-900/60"
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: card.color }} />
                  <span className="min-w-0 font-medium text-white">{card.name}{card.lastFour ? ` •••• ${card.lastFour}` : ""}</span>
                  <span className="text-xs text-zinc-500">{wallet.name}</span>
                  {card.archived && <span title="Cartão arquivado: não aparece em novas compras, mas as faturas e o histórico continuam" className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">Arquivado</span>}
                  <span className="ml-auto flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-xs text-zinc-500"><ReceiptText className="h-3.5 w-3.5" />{purchases.length}</span>
                    <span className="text-sm text-zinc-400">Fatura <span className="font-semibold text-violet-200">{formatCurrency(invoice?.amount ?? 0)}</span></span>
                    <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </span>
                </button>

                {expanded && (
                  <div className="border-t border-zinc-800 px-4 py-4">
                    <div className="grid gap-3 sm:grid-cols-[minmax(160px,1fr)_120px_100px_100px]">
                      <label className="text-xs text-zinc-500">Cartão
                        <input value={card.name} onChange={event => updateCreditCardIn(wallet.id, card.id, { name: event.target.value })} className="mt-1 w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50" />
                      </label>
                      <label className="text-xs text-zinc-500">Últimos 4 dígitos
                        <input inputMode="numeric" maxLength={4} value={card.lastFour ?? ""} onChange={event => updateCreditCardIn(wallet.id, card.id, { lastFour: event.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="Ex.: 1234" className="mt-1 w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50" />
                      </label>
                      <label className="text-xs text-zinc-500" title="Último dia de compras que entram nesta fatura">Fecha dia
                        <input inputMode="numeric" maxLength={2} value={editingDays[dayKey(key, "closingDay")] ?? String(card.closingDay)} onChange={event => setEditingDays(current => ({ ...current, [dayKey(key, "closingDay")]: event.target.value.replace(/\D/g, "").slice(0, 2) }))} onBlur={() => commitDay(wallet.id, card.id, key, "closingDay")} className="mt-1 w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50" />
                      </label>
                      <label className="text-xs text-zinc-500" title="Dia em que a fatura é paga">Vence dia
                        <input inputMode="numeric" maxLength={2} value={editingDays[dayKey(key, "dueDay")] ?? String(card.dueDay)} onChange={event => setEditingDays(current => ({ ...current, [dayKey(key, "dueDay")]: event.target.value.replace(/\D/g, "").slice(0, 2) }))} onBlur={() => commitDay(wallet.id, card.id, key, "dueDay")} className="mt-1 w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50" />
                      </label>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (card.archived) return setCreditCardArchived(wallet.id, card.id, false)
                          if (window.confirm(archiveCardMessage(card, purchases))) setCreditCardArchived(wallet.id, card.id, true)
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-violet-500/40 hover:text-violet-200"
                        title={card.archived ? "Desarquivar: o cartão volta a aparecer ao cadastrar novas compras" : "Arquivar: o cartão para de aparecer em novas compras, mas as faturas e o histórico continuam"}
                      >
                        {card.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                        {card.archived ? "Desarquivar" : "Arquivar"}
                      </button>
                      <button
                        type="button"
                        disabled={purchases.length > 0}
                        onClick={() => { if (window.confirm(`Excluir ${card.name} da carteira ${wallet.name}?`)) removeCreditCardFrom(wallet.id, card.id) }}
                        className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-500/40 hover:text-red-300 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-700 disabled:hover:border-zinc-800 disabled:hover:text-zinc-700"
                        title={purchases.length > 0 ? "Remova as compras deste cartão para poder excluí-lo, ou arquive-o" : "Excluir cartão"}
                      >
                        <Trash2 className="h-4 w-4" />Excluir
                      </button>
                      {purchases.length > 0 && <span className="text-xs text-zinc-600">Só dá para excluir um cartão sem compras. Se ele apenas saiu de uso, arquive.</span>}
                    </div>

                    <div className="mt-5 border-t border-zinc-800 pt-4">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Compras neste cartão</p>
                      {purchases.length === 0 ? (
                        <p className="text-sm text-zinc-500">Nenhuma compra. Lance a primeira em <Link href="/lancamentos" className="text-violet-300 underline underline-offset-2">Lançamentos</Link>.</p>
                      ) : (
                        <div className="space-y-2">
                          {[...purchases].sort((a, b) => b.purchasedOn.localeCompare(a.purchasedOn)).map(purchase => {
                            const firstMonth = firstInvoiceMonth(purchase, card)
                            return (
                              <div key={purchase.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-zinc-800/30 px-3 py-2 text-sm">
                                <span className="font-medium text-zinc-200">{purchase.name}</span>
                                <span className="text-zinc-400">{formatCurrency(purchase.amount)}{purchase.recurring ? " · recorrente" : purchase.installments ? ` em ${purchase.installments}x` : ""}</span>
                                <span className="text-xs text-violet-300">{firstMonth ? `${purchase.recurring ? "Início: " : "1ª fatura: "}${monthLabel(firstMonth)}` : "Data inválida"}</span>
                                {purchase.recurring && <button type="button" onClick={() => updateCreditCardPurchaseIn(wallet.id, purchase.id, { active: purchase.active === false })} className={`rounded-lg px-2 py-1 text-xs ${purchase.active === false ? "bg-zinc-700 text-zinc-300" : "bg-emerald-500/10 text-emerald-300"}`}>{purchase.active === false ? "Ativar" : "Desativar"}</button>}
                                <button type="button" onClick={() => removeCreditCardPurchaseFrom(wallet.id, purchase.id)} className="ml-auto text-zinc-600 hover:text-red-400" aria-label={`Excluir ${purchase.name}`}><Trash2 className="h-4 w-4" /></button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

interface NewCardFormProps {
  wallets: { id: string; name: string }[]
  defaultWalletId: string
  onCancel: () => void
  onCreate: (walletId: string, card: { id: string; name: string; color: string; lastFour?: string; closingDay: number; dueDay: number }) => void
}

function NewCardForm({ wallets, defaultWalletId, onCancel, onCreate }: Readonly<NewCardFormProps>) {
  const [walletId, setWalletId] = useState(wallets.some(wallet => wallet.id === defaultWalletId) ? defaultWalletId : wallets[0]?.id ?? "")
  const [name, setName] = useState("")
  const [lastFour, setLastFour] = useState("")
  const [closingDay, setClosingDay] = useState("25")
  const [dueDay, setDueDay] = useState("5")

  const closing = Number(closingDay)
  const due = Number(dueDay)
  const valid = walletId !== "" && name.trim().length > 0 && closing >= 1 && closing <= 31 && due >= 1 && due <= 31

  return (
    <div className="mb-5 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(140px,1fr)_minmax(160px,1fr)_120px_100px_100px]">
        <label className="text-xs text-zinc-500">Carteira
          <select value={walletId} onChange={event => setWalletId(event.target.value)} className="mt-1 w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50">{wallets.map(wallet => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select>
        </label>
        <label className="text-xs text-zinc-500">Cartão
          <input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Nubank" className="mt-1 w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50" />
        </label>
        <label className="text-xs text-zinc-500">Últimos 4 dígitos
          <input inputMode="numeric" maxLength={4} value={lastFour} onChange={event => setLastFour(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Ex.: 1234" className="mt-1 w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50" />
        </label>
        <label className="text-xs text-zinc-500" title="Último dia de compras que entram na fatura">Fecha dia
          <input inputMode="numeric" maxLength={2} value={closingDay} onChange={event => setClosingDay(event.target.value.replace(/\D/g, "").slice(0, 2))} className="mt-1 w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50" />
        </label>
        <label className="text-xs text-zinc-500" title="Dia em que a fatura é paga">Vence dia
          <input inputMode="numeric" maxLength={2} value={dueDay} onChange={event => setDueDay(event.target.value.replace(/\D/g, "").slice(0, 2))} className="mt-1 w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50" />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={!valid}
          onClick={() => onCreate(walletId, { id: uid(), name: name.trim(), color: COLORS[Math.floor(Math.random() * COLORS.length)], lastFour: lastFour || undefined, closingDay: closing, dueDay: due })}
          className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-50"
        >
          Criar cartão
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancelar</button>
      </div>
    </div>
  )
}
