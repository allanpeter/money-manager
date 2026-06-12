export type ExpenseType = "fixed" | "variable"
export type PaymentMethod = "pix" | "credit" | "debit" | "cash"

/** Sentinel wallet id selecting the read-only consolidated view across all wallets. */
export const ALL_WALLETS = "__all__"

export interface IncomeSource {
  id: string
  name: string
  amount: number
}

export interface ExpenseCategory {
  id: string
  name: string
  amount: number
  type: ExpenseType
  paymentMethod?: PaymentMethod
  color: string
}

export interface InvestmentBucket {
  id: string
  name: string
  percentage: number
  color: string
  /** Optional savings goal for this bucket. */
  targetAmount?: number
  /** Amount already accumulated toward the goal. */
  saved?: number
}

export interface AppData {
  incomeSources: IncomeSource[]
  expenseCategories: ExpenseCategory[]
  investmentBuckets: InvestmentBucket[]
}

export interface MonthRecord {
  /** Always "YYYY-MM". The display label is derived from this, never stored. */
  id: string
  data: AppData
}

export interface Wallet {
  id: string
  name: string
  months: MonthRecord[]
}

export interface MultiWalletStore {
  schemaVersion: number
  wallets: Wallet[]
  /** A wallet id, or ALL_WALLETS for the consolidated view. */
  activeWalletId: string
  /** "YYYY-MM", shared across wallets. */
  activeMonthId: string
  currency: string
  locale: string
}
