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
  /** Optional ISO due date for a one-off payable. */
  dueDate?: string
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
  /** Day of the month the bill is due. Used for payment review and reminders. */
  dueDay?: number
}

export type RecurringExpensePaymentStatus = "paid" | "no_charge"

/** The settlement of one recurring expense in one specific month. Missing means open. */
export interface RecurringExpensePayment {
  status: RecurringExpensePaymentStatus
  paidAmount?: number
  paidAt?: string
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

/** Credit card associated with one wallet. Its due date applies to every invoice. */
export interface CreditCard {
  id: string
  name: string
  /** Last four digits printed on the physical or virtual card. */
  lastFour?: string
  color: string
  /** Invoice payment day (1–31). */
  dueDay: number
  /** Day after which purchases move to the following invoice (1–31). */
  closingDay: number
  /** Keeps the card out of the pickers for new purchases without touching its existing invoices. */
  archived?: boolean
}

/** A purchase whose installments are automatically placed in the card invoices. */
export interface CreditCardPurchase {
  id: string
  creditCardId: string
  name: string
  /** Full purchase value, not the installment value. */
  amount: number
  /** ISO date: YYYY-MM-DD. */
  purchasedOn: string
  /** Adds the same amount to every following invoice until it is deactivated. */
  recurring?: boolean
  /** Only applies to recurring purchases. Missing means active for backward compatibility. */
  active?: boolean
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
  /** Accent color (hex) for at-a-glance distinction between PF/PJ/family wallets. */
  color?: string
  /** Optional emoji shown before the wallet name. */
  emoji?: string
  /** CPF or CNPJ associated with this wallet, stored as digits only. */
  taxId?: string
  months: MonthRecord[]
  recurringExpenses: RecurringExpense[]
  recurringIncomes: RecurringIncome[]
  creditCards?: CreditCard[]
  creditCardPurchases?: CreditCardPurchase[]
  /** Key format: "{recurringExpenseId}:{YYYY-MM}". */
  recurringExpensePayments?: Record<string, RecurringExpensePayment>
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
