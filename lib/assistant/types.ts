export type AssistantActionKind =
  | "chat"
  | "record_purchase"
  | "mark_paid"
  | "create_account"
  | "set_due_day"
  | "set_closing_day"
  | "list_upcoming"
  | "unknown"

export type AccountNature = "fixed" | "variable" | "installment" | "one_off"
export type AccountType = "regular" | "credit_card"

export interface AssistantAction {
  kind: AssistantActionKind
  profileHint: string | null
  profileId: string | null
  accountHint: string | null
  accountId: string | null
  walletHint: string | null
  categoryHint: string | null
  description: string | null
  amountCents: number | null
  purchaseDate: string | null
  referenceMonth: string | null
  accountName: string | null
  dueDay: number | null
  closingDay: number | null
  nature: AccountNature | null
  accountType: AccountType | null
  installments: number | null
}

export interface AssistantInterpretation {
  action: AssistantAction
  missingFields: string[]
  explanation: string
  reply: string
}

export interface PendingAssistantAction {
  stage: "collecting" | "ready"
  action: AssistantAction
  operationId: string
}

export interface AssistantMessageInput {
  userId: string
  workspaceId: string
  role: "owner" | "editor" | "viewer"
  channel: string
  conversationKey: string
  externalMessageId: string
  externalUserId: string
  text: string
}

export interface AssistantMessageResult {
  message: string
  status: "pending" | "executed" | "rejected" | "failed"
}

export interface AssistantContext {
  profiles: Array<{ id: string; name: string }>
  wallets: Array<{ id: string; profileId: string; name: string }>
  categories: Array<{ id: string; profileId: string; name: string }>
  accounts: Array<{
    id: string
    profileId: string
    profileName: string
    name: string
    walletName: string
    categoryName: string
    accountType: AccountType
    nature: AccountNature
    dueDay: number | null
    closingDay: number | null
  }>
}

export const EMPTY_ACTION: AssistantAction = {
  kind: "unknown",
  profileHint: null,
  profileId: null,
  accountHint: null,
  accountId: null,
  walletHint: null,
  categoryHint: null,
  description: null,
  amountCents: null,
  purchaseDate: null,
  referenceMonth: null,
  accountName: null,
  dueDay: null,
  closingDay: null,
  nature: null,
  accountType: null,
  installments: null,
}
