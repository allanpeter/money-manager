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

/** A wallet-level expense that repeats across months without needing to be re-entered. */
export interface RecurringExpense {
  id: string
  name: string
  amount: number
  color: string
  paymentMethod?: PaymentMethod
  /** "YYYY-MM", the first month it applies. */
  startMonth: string
  /** Total number of months it repeats for. Absent means it repeats indefinitely. */
  installments?: number
}

/** A wallet-level income source that repeats across months without needing to be re-entered. */
export interface RecurringIncome {
  id: string
  name: string
  amount: number
  /** "YYYY-MM", the first month it applies. */
  startMonth: string
  /** Total number of months it repeats for. Absent means it repeats indefinitely. */
  installments?: number
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
  recurringExpenses: RecurringExpense[]
  recurringIncomes: RecurringIncome[]
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
