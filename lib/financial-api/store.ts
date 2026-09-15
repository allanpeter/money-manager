import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { DEFAULT_DATA } from "@/lib/defaults"
import { currentMonthId } from "@/lib/months"
import { financialStores } from "@/lib/db/schema"
import { withWorkspace } from "@/lib/db"
import type { AppData, MultiWalletStore, Wallet } from "@/lib/types"
import { COLORS, DEFAULT_CURRENCY, DEFAULT_LOCALE } from "@/lib/utils"

const SCHEMA_VERSION = 6

export class FinancialStoreConflictError extends Error {
  constructor() {
    super("Os dados financeiros foram alterados por outra sessão.")
    this.name = "FinancialStoreConflictError"
  }
}

export interface FinancialStoreSnapshot {
  store: MultiWalletStore
  revision: number
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function createFinancialStore(): MultiWalletStore {
  const monthId = currentMonthId()
  const walletId = randomUUID()
  return {
    schemaVersion: SCHEMA_VERSION,
    wallets: [{ id: walletId, name: "Pessoal", color: COLORS[0], months: [{ id: monthId, data: clone(DEFAULT_DATA) }], recurringExpenses: [], recurringIncomes: [], creditCards: [], creditCardPurchases: [], recurringExpensePayments: {} }],
    activeWalletId: walletId,
    activeMonthId: monthId,
    currency: DEFAULT_CURRENCY,
    locale: DEFAULT_LOCALE,
  }
}

function isStore(value: unknown): value is MultiWalletStore {
  if (!value || typeof value !== "object") return false
  const store = value as Partial<MultiWalletStore>
  return Array.isArray(store.wallets) && typeof store.activeMonthId === "string" && typeof store.activeWalletId === "string"
}

export async function loadFinancialStoreSnapshot(workspaceId: string): Promise<FinancialStoreSnapshot> {
  const [row] = await withWorkspace(workspaceId, database => database.select({ data: financialStores.data, revision: financialStores.revision })
    .from(financialStores).where(eq(financialStores.workspaceId, workspaceId)).limit(1))
  return { store: isStore(row?.data) ? row.data : createFinancialStore(), revision: row?.revision ?? 0 }
}

export async function loadFinancialStore(workspaceId: string): Promise<MultiWalletStore> {
  return (await loadFinancialStoreSnapshot(workspaceId)).store
}

export async function saveFinancialStore(workspaceId: string, store: MultiWalletStore, expectedRevision: number) {
  const nextRevision = expectedRevision + 1
  const saved = await withWorkspace(workspaceId, async database => {
    if (expectedRevision === 0) {
      const [created] = await database.insert(financialStores).values({ workspaceId, data: store, revision: nextRevision, updatedAt: new Date() })
        .onConflictDoNothing().returning({ revision: financialStores.revision })
      return created
    }
    const [updated] = await database.update(financialStores).set({ data: store, revision: nextRevision, updatedAt: new Date() })
      .where(and(eq(financialStores.workspaceId, workspaceId), eq(financialStores.revision, expectedRevision)))
      .returning({ revision: financialStores.revision })
    return updated
  })
  if (!saved) throw new FinancialStoreConflictError()
  return saved.revision
}

export function materializeMonth(wallet: Wallet, monthId: string): AppData {
  const current = wallet.months.find(month => month.id === monthId)
  if (current) return clone(current.data)
  const prior = wallet.months.filter(month => month.id < monthId).sort((a, b) => b.id.localeCompare(a.id))[0]
  return {
    incomeSources: [{ id: randomUUID(), name: "Salário", amount: 0 }],
    expenseCategories: [],
    investmentBuckets: (prior?.data.investmentBuckets ?? DEFAULT_DATA.investmentBuckets)
      .map(bucket => ({ ...bucket, id: randomUUID() })),
  }
}

export function withMonthData(wallet: Wallet, monthId: string, transform: (data: AppData) => AppData): Wallet {
  const data = transform(materializeMonth(wallet, monthId))
  const hasMonth = wallet.months.some(month => month.id === monthId)
  return {
    ...wallet,
    months: hasMonth
      ? wallet.months.map(month => month.id === monthId ? { id: monthId, data } : month)
      : [...wallet.months, { id: monthId, data }],
  }
}

export function nextWalletColor(store: MultiWalletStore) {
  return COLORS[store.wallets.length % COLORS.length]
}

export const newId = randomUUID
