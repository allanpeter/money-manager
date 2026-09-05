export type AccountNature = "fixed" | "variable" | "installment" | "one_off"
export type AccountType = "regular" | "credit_card"
export type FinancialProfileType = "person" | "business" | "dependent" | "other"
export type OccurrenceDeclaration = "paid" | "no_charge" | null
export type AttentionState = "resolved" | "future" | "due_soon" | "due_today" | "overdue" | "missing_due_date"

export interface AccountOccurrence {
  id: string
  referenceMonth: string
  expectedAmountCents: number
  expectedSource: "manual" | "auto" | "import" | "assistant"
  declaration: OccurrenceDeclaration
  paidAmountCents: number | null
  paidOn: string | null
  legacyPaymentDateMissing: boolean
  invoiceItems: InvoiceItem[]
}

export interface InvoiceItem {
  id: string
  description: string
  amountCents: number
  purchasedOn: string
  source: string
}

export interface PayableAccount {
  id: string
  profileId: string
  profileName: string
  name: string
  walletId: string
  walletName: string
  categoryId: string
  categoryName: string
  dueDay: number | null
  closingDay: number | null
  plannedAmountCents: number
  nature: AccountNature
  accountType: AccountType
  startMonth: string
  installments: number | null
  archivedAt: string | null
  occurrences: AccountOccurrence[]
}

export interface AccountsGrid {
  year: number
  today: string
  selectedProfileId: string | null
  profiles: { id: string; name: string; type: FinancialProfileType; color: string }[]
  wallets: { id: string; profileId: string; name: string }[]
  categories: { id: string; profileId: string; name: string }[]
  accounts: PayableAccount[]
}
