export interface IncomeSource {
  id: string
  name: string
  amount: number
}

export interface ExpenseCategory {
  id: string
  name: string
  amount: number
  card?: string
  color: string
}

export interface InvestmentBucket {
  id: string
  name: string
  percentage: number
  color: string
}

export interface AppData {
  incomeSources: IncomeSource[]
  expenseCategories: ExpenseCategory[]
  investmentBuckets: InvestmentBucket[]
}
