import type { ExpenseType, PaymentMethod } from "@/lib/types"

export type DashboardActionKind =
  | "chat"
  | "create_wallet"
  | "add_income"
  | "add_expense"
  | "add_recurring_income"
  | "add_recurring_expense"
  | "query_summary"
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
}

export interface DashboardAssistantContext {
  wallets: Array<{ id: string; name: string }>
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
}
