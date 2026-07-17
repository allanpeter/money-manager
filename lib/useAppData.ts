"use client"
import { useState, useEffect, useCallback, useMemo } from "react"
import {
  AppData, IncomeSource, ExpenseCategory, InvestmentBucket, RecurringExpense,
  MonthRecord, Wallet, MultiWalletStore, ALL_WALLETS,
} from "./types"
import { DEFAULT_DATA } from "./defaults"
import { uid, DEFAULT_CURRENCY, DEFAULT_LOCALE } from "./utils"
import { currentMonthId, isMonthId, monthLabel, shiftMonth, monthWindow, monthRange } from "./months"

const LEGACY_KEY = "money-manager-data"
const STORE_KEY  = "money-manager-store"
const SCHEMA_VERSION = 3
const FORECAST_MONTHS = 12

const PT_MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]

function deaccent(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
}

/** Best-effort parse of an old pt-BR label like "junho de 2026" into "YYYY-MM". */
function labelToMonthId(label?: string): string | null {
  if (!label) return null
  const norm = deaccent(label)
  const year = norm.match(/\d{4}/)?.[0]
  if (!year) return null
  for (let i = 0; i < PT_MONTHS.length; i++) {
    if (norm.includes(deaccent(PT_MONTHS[i]))) {
      return `${year}-${String(i + 1).padStart(2, "0")}`
    }
  }
  return null
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

/** Normalizes a possibly-legacy AppData blob (drops v0 `card`, defaults expense type). */
function cleanData(d: Partial<AppData> | undefined): AppData {
  return {
    incomeSources: d?.incomeSources ?? [],
    expenseCategories: (d?.expenseCategories ?? []).map(c => {
      const cat = c as ExpenseCategory
      return {
        id: cat.id,
        name: cat.name,
        amount: cat.amount,
        type: cat.type ?? "variable",
        paymentMethod: cat.paymentMethod,
        color: cat.color,
      }
    }),
    investmentBuckets: d?.investmentBuckets ?? [],
  }
}

function freshStore(): MultiWalletStore {
  const id = currentMonthId()
  const walletId = uid()
  return {
    schemaVersion: SCHEMA_VERSION,
    wallets: [{ id: walletId, name: "Pessoal", months: [{ id, data: clone(DEFAULT_DATA) }], recurringExpenses: [] }],
    activeWalletId: walletId,
    activeMonthId: id,
    currency: DEFAULT_CURRENCY,
    locale: DEFAULT_LOCALE,
  }
}

type LegacyMonth = { id: string; label?: string; data?: Partial<AppData> }

/** Upgrades a parsed store of any older shape (v0/v1) to the current v2 schema. */
function migrate(raw: unknown): MultiWalletStore {
  const obj = raw as Partial<MultiWalletStore> & {
    wallets?: Wallet[]
    months?: LegacyMonth[]
    activeId?: string
  }

  // Already v2/v3-shaped: just normalize month data and validate ids.
  if (Array.isArray(obj.wallets)) {
    const wallets: Wallet[] = obj.wallets.map(w => ({
      id: w.id ?? uid(),
      name: w.name ?? "Carteira",
      months: (w.months ?? [])
        .filter(m => isMonthId(m.id))
        .map(m => ({ id: m.id, data: cleanData(m.data) })),
      recurringExpenses: w.recurringExpenses ?? [],
    }))
    return {
      schemaVersion: SCHEMA_VERSION,
      wallets: wallets.length ? wallets : freshStore().wallets,
      activeWalletId:
        obj.activeWalletId === ALL_WALLETS || wallets.some(w => w.id === obj.activeWalletId)
          ? (obj.activeWalletId as string)
          : wallets[0]?.id ?? "",
      activeMonthId: isMonthId(obj.activeMonthId ?? "") ? (obj.activeMonthId as string) : currentMonthId(),
      currency: obj.currency ?? DEFAULT_CURRENCY,
      locale: obj.locale ?? DEFAULT_LOCALE,
    }
  }

  // v1: months[] at the root → wrap into a single "Pessoal" wallet, normalizing month ids.
  const seen = new Set<string>()
  const months: MonthRecord[] = []
  const idMap: Record<string, string> = {}
  for (const m of obj.months ?? []) {
    const id = isMonthId(m.id) ? m.id : (labelToMonthId(m.label) ?? currentMonthId())
    idMap[m.id] = id
    if (seen.has(id)) continue // collision: keep the first month mapped to this id
    seen.add(id)
    months.push({ id, data: cleanData(m.data) })
  }
  if (months.length === 0) months.push({ id: currentMonthId(), data: clone(DEFAULT_DATA) })

  const walletId = uid()
  const activeMonthId =
    (obj.activeId && idMap[obj.activeId]) || months[0]?.id || currentMonthId()

  return {
    schemaVersion: SCHEMA_VERSION,
    wallets: [{ id: walletId, name: "Pessoal", months, recurringExpenses: [] }],
    activeWalletId: walletId,
    activeMonthId,
    currency: obj.currency ?? DEFAULT_CURRENCY,
    locale: obj.locale ?? DEFAULT_LOCALE,
  }
}

/** Data for a month, materializing a sensible default (copying the latest prior goals) if absent. */
function getMonthData(wallet: Wallet, monthId: string): AppData {
  const found = wallet.months.find(m => m.id === monthId)
  if (found) return found.data
  const prior = wallet.months
    .filter(m => m.id < monthId)
    .sort((a, b) => (a.id < b.id ? 1 : -1))[0]
  const buckets = (prior?.data.investmentBuckets ?? DEFAULT_DATA.investmentBuckets)
    .map(b => ({ ...b, id: uid() }))
  return {
    incomeSources: [{ id: uid(), name: "Salário", amount: 0 }],
    expenseCategories: [],
    investmentBuckets: buckets,
  }
}

/** Whether a recurring expense is active in the given month. */
function isRecurringActive(r: RecurringExpense, monthId: string): boolean {
  if (monthId < r.startMonth) return false
  if (r.installments == null) return true
  return monthId <= shiftMonth(r.startMonth, r.installments - 1)
}

/** Recurring expenses of a wallet active in the given month. */
function recurringForWallet(wallet: Wallet, monthId: string): RecurringExpense[] {
  return wallet.recurringExpenses.filter(r => isRecurringActive(r, monthId))
}

/** Consolidated data across all wallets for a month. Ids are wallet-prefixed to stay unique. */
function aggregateData(wallets: Wallet[], monthId: string): AppData {
  const result: AppData = { incomeSources: [], expenseCategories: [], investmentBuckets: [] }
  for (const w of wallets) {
    const md = w.months.find(m => m.id === monthId)
    if (!md) continue
    result.incomeSources.push(...md.data.incomeSources.map(i => ({ ...i, id: `${w.id}:${i.id}` })))
    result.expenseCategories.push(...md.data.expenseCategories.map(c => ({ ...c, id: `${w.id}:${c.id}` })))
    result.investmentBuckets.push(...md.data.investmentBuckets.map(b => ({ ...b, id: `${w.id}:${b.id}` })))
  }
  return result
}

export function useAppData() {
  const [store, setStore] = useState<MultiWalletStore | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [windowCenter, setWindowCenter] = useState(currentMonthId)

  useEffect(() => {
    let next: MultiWalletStore
    try {
      const saved = localStorage.getItem(STORE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        next = parsed?.schemaVersion === SCHEMA_VERSION ? parsed : migrate(parsed)
        if (next !== parsed) localStorage.setItem(STORE_KEY, JSON.stringify(next))
      } else {
        const legacy = localStorage.getItem(LEGACY_KEY)
        if (legacy) {
          next = migrate({ months: [{ id: currentMonthId(), data: JSON.parse(legacy) }] })
          localStorage.setItem(STORE_KEY, JSON.stringify(next))
        } else {
          next = freshStore()
          localStorage.setItem(STORE_KEY, JSON.stringify(next))
        }
      }
    } catch {
      next = freshStore()
    }
    setStore(next)
    setWindowCenter(next.activeMonthId)
    setLoaded(true)
  }, [])

  const saveStore = useCallback((next: MultiWalletStore) => {
    setStore(next)
    try { localStorage.setItem(STORE_KEY, JSON.stringify(next)) } catch {}
  }, [])

  const isConsolidated = store?.activeWalletId === ALL_WALLETS
  const activeWallet = store?.wallets.find(w => w.id === store.activeWalletId)

  const data = useMemo<AppData>(() => {
    if (!store) return DEFAULT_DATA
    if (store.activeWalletId === ALL_WALLETS) return aggregateData(store.wallets, store.activeMonthId)
    const wallet = store.wallets.find(w => w.id === store.activeWalletId)
    return wallet ? getMonthData(wallet, store.activeMonthId) : DEFAULT_DATA
  }, [store])

  /** Recurring expenses active in the active month, shaped as ExpenseCategory so they can join the manual list in totals/charts. */
  const activeRecurringExpenses = useMemo<ExpenseCategory[]>(() => {
    if (!store) return []
    const toExpenseCategory = (r: RecurringExpense): ExpenseCategory => ({
      id: r.id, name: r.name, amount: r.amount, type: "fixed", paymentMethod: r.paymentMethod, color: r.color,
    })
    if (store.activeWalletId === ALL_WALLETS) {
      return store.wallets.flatMap(w =>
        recurringForWallet(w, store.activeMonthId).map(r => ({ ...toExpenseCategory(r), id: `${w.id}:${r.id}` })),
      )
    }
    const wallet = store.wallets.find(w => w.id === store.activeWalletId)
    return wallet ? recurringForWallet(wallet, store.activeMonthId).map(toExpenseCategory) : []
  }, [store])

  const totalIncome = data.incomeSources.reduce((s, i) => s + i.amount, 0)
  const manualExpenses = data.expenseCategories.reduce((s, c) => s + c.amount, 0)
  const totalExpenses = manualExpenses + activeRecurringExpenses.reduce((s, c) => s + c.amount, 0)
  const remainder = totalIncome - totalExpenses
  const totalPct = data.investmentBuckets.reduce((s, b) => s + b.percentage, 0)

  const windowMonths = useMemo(
    () => monthWindow(windowCenter).map(id => ({ id, label: monthLabel(id, store?.locale) })),
    [windowCenter, store?.locale],
  )

  const walletBreakdown = useMemo(() => {
    if (!store) return []
    return store.wallets.map(w => {
      const md = w.months.find(m => m.id === store.activeMonthId)
      const income = md ? md.data.incomeSources.reduce((s, i) => s + i.amount, 0) : 0
      const manual = md ? md.data.expenseCategories.reduce((s, c) => s + c.amount, 0) : 0
      const recurring = recurringForWallet(w, store.activeMonthId).reduce((s, r) => s + r.amount, 0)
      const expenses = manual + recurring
      return { id: w.id, name: w.name, income, expenses, remainder: income - expenses }
    })
  }, [store])

  /** Projected total expenses (recurring + already-entered manual) for the next FORECAST_MONTHS months, starting today. */
  const forecast = useMemo(() => {
    if (!store) return []
    const relevantWallets =
      store.activeWalletId === ALL_WALLETS
        ? store.wallets
        : store.wallets.filter(w => w.id === store.activeWalletId)
    return monthRange(currentMonthId(), FORECAST_MONTHS).map(id => {
      let fixed = 0
      let manual = 0
      for (const w of relevantWallets) {
        fixed += recurringForWallet(w, id).reduce((s, r) => s + r.amount, 0)
        const md = w.months.find(m => m.id === id)
        if (md) manual += md.data.expenseCategories.reduce((s, c) => s + c.amount, 0)
      }
      return { id, label: monthLabel(id, store.locale), fixed, manual, total: fixed + manual }
    })
  }, [store])

  function patchActive(next: AppData) {
    if (!store || isConsolidated || !activeWallet) return
    const monthId = store.activeMonthId
    const exists = activeWallet.months.some(m => m.id === monthId)
    const months = exists
      ? activeWallet.months.map(m => (m.id === monthId ? { id: monthId, data: next } : m))
      : [...activeWallet.months, { id: monthId, data: next }]
    saveStore({
      ...store,
      wallets: store.wallets.map(w => (w.id === activeWallet.id ? { ...w, months } : w)),
    })
  }

  function updateIncome(sources: IncomeSource[]) {
    patchActive({ ...data, incomeSources: sources })
  }

  function updateExpenses(categories: ExpenseCategory[]) {
    patchActive({ ...data, expenseCategories: categories })
  }

  function updateBuckets(buckets: InvestmentBucket[]) {
    patchActive({ ...data, investmentBuckets: buckets })
  }

  function updateRecurringExpenses(items: RecurringExpense[]) {
    if (!store || isConsolidated || !activeWallet) return
    saveStore({
      ...store,
      wallets: store.wallets.map(w => (w.id === activeWallet.id ? { ...w, recurringExpenses: items } : w)),
    })
  }

  function switchMonth(id: string) {
    if (!store) return
    saveStore({ ...store, activeMonthId: id })
  }

  function shiftWindow(dir: -1 | 1) {
    setWindowCenter(c => shiftMonth(c, dir))
  }

  function switchWallet(id: string) {
    if (!store) return
    saveStore({ ...store, activeWalletId: id })
  }

  function createWallet(name: string) {
    if (!store) return
    const id = uid()
    const wallet: Wallet = { id, name, months: [], recurringExpenses: [] }
    saveStore({ ...store, wallets: [...store.wallets, wallet], activeWalletId: id })
  }

  function renameWallet(id: string, name: string) {
    if (!store) return
    saveStore({ ...store, wallets: store.wallets.map(w => (w.id === id ? { ...w, name } : w)) })
  }

  function deleteWallet(id: string) {
    if (!store || store.wallets.length <= 1) return
    const remaining = store.wallets.filter(w => w.id !== id)
    const activeWalletId = store.activeWalletId === id ? remaining[0].id : store.activeWalletId
    saveStore({ ...store, wallets: remaining, activeWalletId })
  }

  function exportJSON(): string {
    return JSON.stringify(store, null, 2)
  }

  /** Parses, migrates and replaces the whole store. Returns false on invalid input. */
  function importJSON(text: string): boolean {
    try {
      const parsed = JSON.parse(text)
      const ok =
        parsed &&
        ((Array.isArray(parsed.wallets) && parsed.wallets.length > 0) ||
          (Array.isArray(parsed.months) && parsed.months.length > 0))
      if (!ok) return false
      const migrated = migrate(parsed)
      saveStore(migrated)
      setWindowCenter(migrated.activeMonthId)
      return true
    } catch {
      return false
    }
  }

  return {
    data,
    loaded,
    totalIncome,
    manualExpenses,
    totalExpenses,
    remainder,
    totalPct,
    updateIncome,
    updateExpenses,
    updateBuckets,
    // recurring expenses
    recurringExpenses: activeWallet?.recurringExpenses ?? [],
    activeRecurringExpenses,
    updateRecurringExpenses,
    forecast,
    // months
    windowMonths,
    activeMonthId: store?.activeMonthId ?? "",
    switchMonth,
    shiftWindow,
    // wallets
    wallets: store?.wallets ?? [],
    activeWalletId: store?.activeWalletId ?? "",
    isConsolidated,
    walletBreakdown,
    switchWallet,
    createWallet,
    renameWallet,
    deleteWallet,
    // misc
    currency: store?.currency ?? DEFAULT_CURRENCY,
    locale: store?.locale ?? DEFAULT_LOCALE,
    exportJSON,
    importJSON,
  }
}
