"use client"

import { CheckCircle2, CircleDollarSign, Clock3, XCircle } from "lucide-react"
import type { MonthlyPaymentItem } from "@/lib/useAppData"
import type { RecurringExpensePayment } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import { monthLabel } from "@/lib/months"
import { isRecurringPaymentOverdue } from "@/lib/payment-status"

interface Props {
  monthId: string
  items: MonthlyPaymentItem[]
  /** Current instant provided by the server so every browser sees the same payment status. */
  referenceDate: string
  onChange: (walletId: string, expenseId: string, payment: RecurringExpensePayment | null) => void
}

export function ConsolidatedPayments({ monthId, items, referenceDate, onChange }: Readonly<Props>) {
  const paid = items.filter(item => item.payment?.status === "paid")
  const open = items.filter(item => !item.payment)
  const noCharge = items.filter(item => item.payment?.status === "no_charge")
  const total = items.filter(item => item.payment?.status !== "no_charge").reduce((sum, item) => sum + item.expense.amount, 0)
  const paidTotal = paid.reduce((sum, item) => sum + (item.payment?.paidAmount ?? item.expense.amount), 0)
  const openTotal = open.reduce((sum, item) => sum + item.expense.amount, 0)
  function isOverdue(item: MonthlyPaymentItem): boolean {
    return isRecurringPaymentOverdue(monthId, item.expense.dueDay, Boolean(item.payment), new Date(referenceDate))
  }

  const overdue = open.filter(isOverdue)
  const orderedItems = [...items].sort((a, b) => {
    const priority = (item: MonthlyPaymentItem) => {
      if (isOverdue(item)) return 0
      if (!item.payment) return 1
      if (item.payment.status === "paid") return 2
      return 3
    }
    const priorityDiff = priority(a) - priority(b)
    if (priorityDiff !== 0) return priorityDiff
    return (a.expense.dueDay ?? 32) - (b.expense.dueDay ?? 32) || a.expense.name.localeCompare(b.expense.name)
  })

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-cyan-500/10 p-2 text-cyan-400"><CircleDollarSign className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-semibold text-white">Contas do mês</h2>
            <p className="capitalize text-sm text-zinc-500">{monthLabel(monthId)} · todas as carteiras</p>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-950/40 text-sm">
          <div className="px-4 py-2.5"><p className="text-zinc-500">Previsto</p><p className="font-semibold text-white">{formatCurrency(total)}</p></div>
          <div className="px-4 py-2.5"><p className="text-zinc-500">Pago</p><p className="font-semibold text-emerald-400">{formatCurrency(paidTotal)}</p></div>
          <div className="px-4 py-2.5"><p className="text-zinc-500">Em aberto</p><p className="font-semibold text-amber-400">{formatCurrency(openTotal)}</p>{overdue.length > 0 && <p className="mt-0.5 text-xs text-red-400">{overdue.length} vencida{overdue.length === 1 ? "" : "s"}</p>}</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-10 text-center">
          <p className="text-sm text-zinc-400">Nenhuma conta recorrente neste mês.</p>
          <p className="mt-1 text-xs text-zinc-600">Cadastre gastos fixos em Lançamentos para acompanhá-los aqui.</p>
        </div>
      ) : (
        <>
          <div className="hidden grid-cols-[100px_minmax(180px,1fr)_minmax(120px,0.6fr)_140px_130px_220px] gap-4 border-b border-zinc-800 px-4 pb-3 text-xs font-medium uppercase tracking-wider text-zinc-500 lg:grid">
            <span>Vencimento</span><span>Conta</span><span>Carteira</span><span className="text-right">Valor</span><span>Situação</span><span className="text-right">Ação</span>
          </div>
          <div className="space-y-2 pt-2">
            {orderedItems.map(({ walletId, walletName, walletColor, expense, payment, source, purchaseCount }) => {
              const isPaid = payment?.status === "paid"
              const isNoCharge = payment?.status === "no_charge"
              const overdueItem = isOverdue({ walletId, walletName, walletColor, expense, payment })
              const statusLabel = isPaid ? "Pago" : isNoCharge ? "Sem cobrança" : overdueItem ? "Vencido" : "Em aberto"
              const statusClass = isPaid
                ? "bg-emerald-500/10 text-emerald-400"
                : isNoCharge ? "bg-zinc-700 text-zinc-400" : overdueItem ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
              return (
                <div key={`${walletId}:${expense.id}`} className="grid gap-3 rounded-xl bg-zinc-800/50 p-4 lg:grid-cols-[100px_minmax(180px,1fr)_minmax(120px,0.6fr)_140px_130px_220px] lg:items-center lg:gap-4">
                  <div className={`flex items-center gap-2 text-sm ${overdueItem ? "font-medium text-red-400" : "text-zinc-400"}`}>
                    <Clock3 className="h-4 w-4 text-zinc-600 lg:hidden" />
                    {expense.dueDay ? `Dia ${expense.dueDay}` : "Sem data"}
                  </div>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: expense.color }} />
                    <div className="min-w-0"><p className="truncate text-sm font-medium text-zinc-200">{expense.name}</p>{source === "credit_card" && <p className="text-xs text-zinc-500">{purchaseCount} compra{purchaseCount === 1 ? "" : "s"} na fatura</p>}{source === "manual" && <p className="text-xs text-zinc-500">Lançamento avulso</p>}</div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: walletColor ?? "#71717a" }} />
                    {walletName}
                  </div>
                  <p className="text-sm font-semibold text-white lg:text-right">{formatCurrency(isPaid ? (payment.paidAmount ?? expense.amount) : expense.amount)}</p>
                  <div><span className={`inline-flex rounded-md px-2 py-1 text-xs ${statusClass}`}>{statusLabel}</span></div>
                  <div className="flex gap-2 lg:justify-end">
                    {isPaid || isNoCharge ? (
                      <button onClick={() => onChange(walletId, expense.id, null)} className="rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-white">Reabrir</button>
                    ) : (
                      <>
                        <button onClick={() => onChange(walletId, expense.id, { status: "no_charge" })} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-white"><XCircle className="h-3.5 w-3.5" /> Sem cobrança</button>
                        <button onClick={() => onChange(walletId, expense.id, { status: "paid", paidAmount: expense.amount, paidAt: new Date().toISOString() })} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/25"><CheckCircle2 className="h-3.5 w-3.5" /> Marcar pago</button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {items.length > 0 && <p className="mt-4 text-xs text-zinc-600">{paid.length} paga{paid.length === 1 ? "" : "s"}, {open.length} em aberto{open.length === 1 ? "" : "s"}{overdue.length ? `, sendo ${overdue.length} vencida${overdue.length === 1 ? "" : "s"}` : ""}{noCharge.length ? ` e ${noCharge.length} sem cobrança` : ""}.</p>}
    </section>
  )
}
