import type { ExpenseType, PaymentMethod } from "@/lib/types"
import type { PurchaseAmountMode } from "@/lib/credit-cards"
import type { C6InvoiceCardSummary, C6InvoiceEntry } from "@/lib/accounts/import-c6-invoice"

export type DashboardActionKind =
  | "chat"
  | "create_wallet"
  | "add_income"
  | "add_expense"
  | "add_recurring_income"
  | "add_recurring_expense"
  | "add_card_purchase"
  | "pay_bill"
  | "query_summary"
  | "query_cards"
  | "list_wallets"
  | "unknown"

export interface DashboardAction {
  kind: DashboardActionKind
  walletName: string | null
  walletId: string | null
  itemName: string | null
  amountCents: number | null
  monthId: string | null
  endMonthId: string | null
  expenseType: ExpenseType | null
  paymentMethod: PaymentMethod | null
  installments: number | null
  /** Card the purchase belongs to, as the user named it. */
  cardName: string | null
  /** Resolved by the system, never by the model. */
  cardId: string | null
  /** Resolved by the system, never by the model. */
  billId: string | null
  /** Purchase date, AAAA-MM-DD. Decides which invoice the purchase falls into. */
  purchasedOn: string | null
  /** Card purchase charged again every month until someone deactivates it. */
  recurring: boolean | null
  /** Whether amountCents is the whole purchase or the value of each installment. */
  amountMode: PurchaseAmountMode | null
}

export interface DashboardInterpretation {
  actions: DashboardAction[]
  reply: string
}

export interface PendingDashboardAction {
  stage: "collecting" | "ready"
  actions: DashboardAction[]
  operationId: string
}

/** Parsed data is persisted only until the user confirms or cancels its import. */
export interface PendingC6InvoiceImport {
  type: "c6_invoice_import"
  stage: "mapping" | "ready"
  operationId: string
  filename: string
  checksum: string
  referenceMonth: string
  entries: C6InvoiceEntry[]
  cards: C6InvoiceCardSummary[]
  paymentCount: number
  mappings: Record<string, string>
}

export interface DashboardAssistantInput {
  userId: string
  workspaceId: string
  role: "owner" | "editor" | "viewer"
  channel: string
  conversationKey: string
  externalMessageId: string
  externalUserId: string
  text: string
}

export interface DashboardAssistantResult {
  message: string
  status: "pending" | "executed" | "rejected" | "failed"
  storeUpdated?: boolean
  /** True when the idempotency key was already handled by another worker. */
  duplicate?: boolean
}

export interface DashboardAssistantContext {
  wallets: Array<{ id: string; name: string }>
  /** Cards available for new purchases, archived ones excluded. */
  cards: Array<{ id: string; name: string; label: string; walletId: string; walletName: string }>
  /** Payable lines of the current month, used to resolve "marcar X como pago". */
  bills: Array<{ id: string; name: string; amount: number; walletId: string; walletName: string; monthId: string; settled: boolean }>
}

export const EMPTY_DASHBOARD_ACTION: DashboardAction = {
  kind: "unknown",
  walletName: null,
  walletId: null,
  itemName: null,
  amountCents: null,
  monthId: null,
  endMonthId: null,
  expenseType: null,
  paymentMethod: null,
  installments: null,
  cardName: null,
  cardId: null,
  billId: null,
  purchasedOn: null,
  recurring: null,
  amountMode: null,
}
