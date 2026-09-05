import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { DEFAULT_DATA } from "@/lib/defaults"
import { currentMonthId } from "@/lib/months"
import { financialStores } from "@/lib/db/schema"
import { withWorkspace } from "@/lib/db"
import type { AppData, MultiWalletStore, Wallet } from "@/lib/types"
import { COLORS, DEFAULT_CURRENCY, DEFAULT_LOCALE } from "@/lib/utils"

const SCHEMA_VERSION = 4

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function createFinancialStore(): MultiWalletStore {
  const monthId = currentMonthId()
  const walletId = randomUUID()
  return {
    schemaVersion: SCHEMA_VERSION,
    wallets: [{ id: walletId, name: "Pessoal", color: COLORS[0], months: [{ id: monthId, data: clone(DEFAULT_DATA) }], recurringExpenses: [], recurringIncomes: [] }],
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

export async function loadFinancialStore(workspaceId: string): Promise<MultiWalletStore> {
  const [row] = await withWorkspace(workspaceId, database => database.select({ data: financialStores.data })
    .from(financialStores).where(eq(financialStores.workspaceId, workspaceId)).limit(1))
  return isStore(row?.data) ? row.data : createFinancialStore()
}

export async function saveFinancialStore(workspaceId: string, store: MultiWalletStore) {
  await withWorkspace(workspaceId, database => database.insert(financialStores).values({
    workspaceId,
    data: store,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: financialStores.workspaceId,
    set: { data: store, updatedAt: new Date() },
  }))
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
