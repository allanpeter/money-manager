export type ExpenseType = "fixed" | "variable"
export type PaymentMethod = "pix" | "credit" | "debit" | "cash"

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
  id: string
  label: string
  data: AppData
}

export interface MultiMonthStore {
  schemaVersion: number
  activeId: string
  months: MonthRecord[]
  currency: string
  locale: string
}
