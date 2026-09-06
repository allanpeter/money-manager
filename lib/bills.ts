import { creditCardInvoicesForMonth, invoiceAsBill, invoiceBreakdown, type PaymentItemDetail } from "./credit-cards"
import { shiftMonth } from "./months"
import type { RecurringExpensePayment, Wallet } from "./types"

/** Whether a recurring expense/income entry is active in the given month. */
export function isRecurringActive(entry: { startMonth: string; installments?: number }, monthId: string): boolean {
  if (monthId < entry.startMonth) return false
  if (entry.installments == null) return true
  return monthId <= shiftMonth(entry.startMonth, entry.installments - 1)
}

export type BillSource = "recurring" | "manual" | "credit_card"

/** One payable line of a month, exactly as the payment review screen shows it. */
export interface Bill {
  /** Settlements are stored under `${id}:${monthId}`, so this id must match the UI's. */
  id: string
  name: string
  amount: number
  dueDay?: number
  source: BillSource
  /** Card invoices carry the purchases that make them up; they are settled as a whole. */
  detail?: PaymentItemDetail
}

/** Everything payable in a wallet for one month: fixed bills, dated one-offs and card invoices. */
export function billsForMonth(wallet: Wallet, monthId: string): Bill[] {
  const recurring: Bill[] = wallet.recurringExpenses
    .filter(item => isRecurringActive(item, monthId))
    .map(item => ({ id: item.id, name: item.name, amount: item.amount, dueDay: item.dueDay, source: "recurring" }))
  const manual: Bill[] = (wallet.months.find(month => month.id === monthId)?.data.expenseCategories ?? [])
    .filter(item => item.dueDate?.startsWith(monthId))
    .map(item => ({ id: `manual:${item.id}`, name: item.name, amount: item.amount, dueDay: Number(item.dueDate!.slice(8, 10)), source: "manual" }))
  const invoices: Bill[] = creditCardInvoicesForMonth(wallet, monthId).map(invoice => {
    const bill = invoiceAsBill(invoice)
    return { id: bill.id, name: bill.name, amount: bill.amount, dueDay: bill.dueDay, source: "credit_card", detail: invoiceBreakdown(invoice) }
  })
  return [...recurring, ...manual, ...invoices].sort((a, b) => (a.dueDay ?? 32) - (b.dueDay ?? 32) || a.name.localeCompare(b.name))
}

export function billPayment(wallet: Wallet, billId: string, monthId: string): RecurringExpensePayment | undefined {
  return wallet.recurringExpensePayments?.[`${billId}:${monthId}`]
}

const normalize = (value: string) => value
  .toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ").trim()

/** People say "nubank" or "fatura do nubank" for the same bill, so both have to match. */
export function findBills(bills: Bill[], query: string): Bill[] {
  const wanted = normalize(query).replace(/^fatura( do| da| de)? /, "")
  if (!wanted) return []
  const exact = bills.filter(bill => normalize(bill.name) === wanted)
  if (exact.length) return exact
  return bills.filter(bill => {
    const name = normalize(bill.name)
    return name.includes(wanted) || wanted.includes(name)
  })
}
