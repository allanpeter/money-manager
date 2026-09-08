import type { CreditCard, CreditCardPurchase, RecurringExpense, Wallet } from "./types"
import { shiftMonth } from "./months"

export interface CreditCardInvoiceItem {
  purchase: CreditCardPurchase
  installment: number
  amount: number
}

export interface CreditCardInvoice {
  card: CreditCard
  monthId: string
  amount: number
  items: CreditCardInvoiceItem[]
}

function parsePurchaseDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [year, month, day] = match.slice(1).map(Number)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

/** Invoice month is the month in which the card bill is due. */
export function firstInvoiceMonth(purchase: CreditCardPurchase, card: CreditCard): string | null {
  const date = parsePurchaseDate(purchase.purchasedOn)
  if (!date) return null
  const purchaseMonth = `${date.year}-${String(date.month).padStart(2, "0")}`
  // The closing day is already the first purchase day of the next billing cycle.
  const closingMonthOffset = date.day >= card.closingDay ? 1 : 0
  // A bill only moves to the month after closing when its due day precedes closing.
  const dueMonthOffset = card.dueDay < card.closingDay ? 1 : 0
  return shiftMonth(purchaseMonth, closingMonthOffset + dueMonthOffset)
}

function installmentAmount(total: number, installments: number, installment: number): number {
  const totalCents = Math.round(total * 100)
  const base = Math.floor(totalCents / installments)
  const remainder = totalCents % installments
  return (base + (installment <= remainder ? 1 : 0)) / 100
}

/** Calculates all card invoices due in a wallet for a given month. */
export function creditCardInvoicesForMonth(wallet: Wallet, monthId: string): CreditCardInvoice[] {
  return (wallet.creditCards ?? []).map(card => {
    const items = (wallet.creditCardPurchases ?? []).flatMap(purchase => {
      if (purchase.creditCardId !== card.id) return []
      const firstMonth = firstInvoiceMonth(purchase, card)
      if (!firstMonth || monthId < firstMonth) return []
      const installment = (Number(monthId.slice(0, 4)) - Number(firstMonth.slice(0, 4))) * 12
        + Number(monthId.slice(5, 7)) - Number(firstMonth.slice(5, 7)) + 1
      if (purchase.recurring) {
        if (purchase.active === false) return []
        return [{ purchase, installment, amount: purchase.amount }]
      }
      const installments = Math.max(1, purchase.installments ?? 1)
      if (installment < 1 || installment > installments) return []
      return [{ purchase, installment, amount: installmentAmount(purchase.amount, installments, installment) }]
    })
    return { card, monthId, items, amount: items.reduce((sum, item) => sum + item.amount, 0) }
  }).filter(invoice => invoice.amount > 0)
}

/** Spells out what archiving changes, so the confirmation is not a blank "tem certeza?". */
export function archiveCardMessage(card: CreditCard, purchases: CreditCardPurchase[]): string {
  const label = `${card.name}${card.lastFour ? ` •••• ${card.lastFour}` : ""}`
  const linked = purchases.filter(purchase => purchase.creditCardId === card.id)
  const recurring = linked.filter(purchase => purchase.recurring && purchase.active !== false).length
  const lines = [
    `Arquivar ${label}?`,
    "",
    "O que acontece:",
    "• O cartão deixa de aparecer quando você cadastra uma nova compra.",
    "• As compras já lançadas e as faturas continuam iguais, inclusive as parcelas em andamento.",
  ]
  if (recurring === 1) lines.push("• 1 compra recorrente continuará entrando na fatura todo mês. Desative-a em Lançamentos se ela não for mais cobrada.")
  if (recurring > 1) lines.push(`• ${recurring} compras recorrentes continuarão entrando na fatura todo mês. Desative-as em Lançamentos se não forem mais cobradas.`)
  lines.push("• Você pode desarquivar quando quiser.")
  return lines.join("\n")
}

/** A card invoice is settled like any other bill, so the payment review screens see it as a recurring row. */
export function invoiceAsBill(invoice: CreditCardInvoice): RecurringExpense {
  return {
    id: `card:${invoice.card.id}`,
    name: `Fatura ${invoice.card.name}${invoice.card.lastFour ? ` •••• ${invoice.card.lastFour}` : ""}`,
    amount: invoice.amount,
    color: invoice.card.color,
    dueDay: invoice.card.dueDay,
    startMonth: invoice.monthId,
  }
}

export interface PaymentItemLine {
  id: string
  name: string
  amount: number
  hint?: string
}

/** Read-only breakdown of a payment row: the invoice is settled as a whole, never purchase by purchase. */
export interface PaymentItemDetail {
  summary: string
  lines: PaymentItemLine[]
}

/** Explains what a card invoice is made of, for the payment review dropdown. */
export function invoiceBreakdown(invoice: CreditCardInvoice): PaymentItemDetail {
  return {
    summary: `${invoice.items.length} ${invoice.items.length === 1 ? "compra" : "compras"} na fatura`,
    lines: invoice.items.map(item => {
      const installments = item.purchase.installments ?? 1
      let hint: string | undefined
      if (item.purchase.recurring) hint = "recorrente"
      else if (installments > 1) hint = `parcela ${item.installment}/${installments}`
      return { id: item.purchase.id, name: item.purchase.name, amount: item.amount, hint }
    }),
  }
}

export type PurchaseAmountMode = "total" | "installment"

export interface PurchaseSplit {
  /** Full purchase value, which is what gets stored. */
  total: number
  count: number
  /** First installment carries the leftover cents. */
  first: number
  rest: number
}

/** Lets a purchase be entered either as "R$ 300 em 3x" or as "3x de R$ 100", always storing the full value. */
export function splitPurchase(value: number, count: number, mode: PurchaseAmountMode): PurchaseSplit {
  const installments = Math.max(1, Math.trunc(count) || 1)
  const cents = Math.round(value * 100)
  const totalCents = mode === "installment" ? cents * installments : cents
  const total = totalCents / 100
  return {
    total,
    count: installments,
    first: installmentAmount(total, installments, 1),
    rest: installmentAmount(total, installments, installments),
  }
}
