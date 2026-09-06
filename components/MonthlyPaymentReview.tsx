"use client"

import { useState } from "react"
import { CheckCircle2, ChevronDown, CircleDollarSign, RotateCcw, XCircle } from "lucide-react"
import { RecurringExpense, RecurringExpensePayment } from "@/lib/types"
import { PaymentItemDetail } from "@/lib/credit-cards"
import { formatCurrency } from "@/lib/utils"
import { monthLabel } from "@/lib/months"

interface Props {
  monthId: string
  items: RecurringExpense[]
  payments: Record<string, RecurringExpensePayment>
  /** Read-only breakdown per item id, e.g. the purchases inside a card invoice. */
  details?: Record<string, PaymentItemDetail>
  onChange: (expenseId: string, payment: RecurringExpensePayment | null) => void
}

function paymentKey(expenseId: string, monthId: string) {
  return `${expenseId}:${monthId}`
}

export function MonthlyPaymentReview({ monthId, items, payments, details, onChange }: Readonly<Props>) {
  /** Only one breakdown open at a time, so the list stays short. "" means all collapsed. */
  const [openId, setOpenId] = useState("")
  const rows = items.map(item => ({ item, payment: payments[paymentKey(item.id, monthId)] }))
  const paid = rows.filter(row => row.payment?.status === "paid")
  const open = rows.filter(row => !row.payment)
  const noCharge = rows.filter(row => row.payment?.status === "no_charge")
  const paidTotal = paid.reduce((sum, row) => sum + (row.payment?.paidAmount ?? row.item.amount), 0)
  const openTotal = open.reduce((sum, row) => sum + row.item.amount, 0)

  return (
    <section className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="bg-cyan-500/10 p-2 rounded-xl">
            <CircleDollarSign className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">Revisão de pagamentos</h2>
            <p className="text-zinc-500 text-sm capitalize">{monthLabel(monthId)} · acompanhe cada gasto fixo e as faturas</p>
          </div>
        </div>
        <div className="flex gap-4 text-sm">
          <div>
            <p className="text-zinc-500">Pago</p>
            <p className="text-emerald-400 font-semibold">{formatCurrency(paidTotal)}</p>
          </div>
          <div>
            <p className="text-zinc-500">Em aberto</p>
            <p className="text-amber-400 font-semibold">{formatCurrency(openTotal)}</p>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-6 px-4 rounded-xl border border-dashed border-zinc-800">
          <p className="text-zinc-400 text-sm">Nenhum gasto fixo ou fatura neste mês.</p>
          <p className="text-zinc-600 text-xs mt-1">Cadastre contas como aluguel e condomínio em “Gastos Fixos” abaixo.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(({ item, payment }) => {
            const isPaid = payment?.status === "paid"
            const isNoCharge = payment?.status === "no_charge"
            const label = isPaid ? "Pago" : isNoCharge ? "Sem cobrança" : "Em aberto"
            const labelClass = isPaid
              ? "bg-emerald-500/10 text-emerald-400"
              : isNoCharge
                ? "bg-zinc-700 text-zinc-400"
                : "bg-amber-500/10 text-amber-400"
            const detail = details?.[item.id]
            const expanded = openId === item.id
            /** Same block whether or not it is clickable, so the row looks identical in both cases. */
            const summary = (
              <>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <p className="truncate text-sm font-medium text-zinc-200">{item.name}</p>
                  <span className={`rounded-md px-2 py-0.5 text-xs ${labelClass}`}>{label}</span>
                  {detail && <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`} />}
                </div>
                <p className="ml-4.5 mt-1 text-left text-xs text-zinc-500">
                  {item.dueDay ? `Vence dia ${item.dueDay}` : "Sem vencimento cadastrado"}
                  {detail ? ` · ${detail.summary}` : ""}
                  {isPaid && payment.paidAt ? ` · pago em ${new Date(payment.paidAt).toLocaleDateString("pt-BR")}` : ""}
                </p>
              </>
            )
            return (
              <div key={item.id} className="rounded-xl bg-zinc-800/50">
                <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                  {detail ? (
                    <button type="button" onClick={() => setOpenId(expanded ? "" : item.id)} aria-expanded={expanded} className="min-w-0 flex-1 rounded-lg text-left">
                      {summary}
                    </button>
                  ) : (
                    <div className="min-w-0 flex-1">{summary}</div>
                  )}
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="text-sm font-semibold text-white">{formatCurrency(isPaid ? (payment.paidAmount ?? item.amount) : item.amount)}</span>
                    {isPaid || isNoCharge ? (
                      <button
                        type="button"
                        onClick={() => onChange(item.id, null)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-white"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Reabrir
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => onChange(item.id, { status: "no_charge" })}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-white"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Sem cobrança
                        </button>
                        <button
                          type="button"
                          onClick={() => onChange(item.id, { status: "paid", paidAmount: item.amount, paidAt: new Date().toISOString() })}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/25"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Marcar pago
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {detail && expanded && (
                  <div className="space-y-1.5 border-t border-zinc-800 px-3 py-2.5">
                    {detail.lines.map(line => (
                      <div key={line.id} className="flex items-center gap-2 text-xs">
                        <span className="truncate text-zinc-300">{line.name}</span>
                        {line.hint && <span className="shrink-0 text-zinc-600">{line.hint}</span>}
                        <span className="ml-auto shrink-0 text-zinc-400">{formatCurrency(line.amount)}</span>
                      </div>
                    ))}
                    <p className="pt-1 text-xs text-zinc-600">A fatura é paga inteira: use os botões acima para quitá-la.</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {items.length > 0 && (
        <p className="mt-4 text-xs text-zinc-600">
          {paid.length} pago{paid.length === 1 ? "" : "s"}, {open.length} em aberto{open.length === 1 ? "" : "s"}
          {noCharge.length ? ` e ${noCharge.length} sem cobrança` : ""}.
        </p>
      )}
    </section>
  )
}
