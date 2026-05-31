"use client"
import { useState, useEffect, useCallback } from "react"
import { AppData, IncomeSource, ExpenseCategory, InvestmentBucket, MonthRecord, MultiMonthStore } from "./types"
import { DEFAULT_DATA } from "./defaults"
import { uid, DEFAULT_CURRENCY, DEFAULT_LOCALE } from "./utils"

const LEGACY_KEY = "money-manager-data"
const STORE_KEY  = "money-manager-store"
const SCHEMA_VERSION = 1

function currentMonthId() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function currentMonthLabel() {
  return new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
}

function nextMonthLabel() {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return next.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
}

function makeStore(data: AppData, label: string, id: string): MultiMonthStore {
  return {
    schemaVersion: SCHEMA_VERSION,
    activeId: id,
    months: [{ id, label, data }],
    currency: DEFAULT_CURRENCY,
    locale: DEFAULT_LOCALE,
  }
}

/** Upgrades a parsed store from any older shape to the current schema. */
function migrate(raw: unknown): MultiMonthStore {
  const store = raw as Partial<MultiMonthStore> & {
    months?: { id: string; label: string; data: Partial<AppData> }[]
  }
  const months: MonthRecord[] = (store.months ?? []).map(m => ({
    id: m.id,
    label: m.label,
    data: {
      incomeSources: m.data?.incomeSources ?? [],
      // v0 expenses carried a free-text `card` field and no `type`; drop card, default type.
      expenseCategories: (m.data?.expenseCategories ?? []).map((c) => {
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
      investmentBuckets: m.data?.investmentBuckets ?? [],
    },
  }))
  return {
    schemaVersion: SCHEMA_VERSION,
    activeId: store.activeId ?? months[0]?.id ?? "",
    months,
    currency: store.currency ?? DEFAULT_CURRENCY,
    locale: store.locale ?? DEFAULT_LOCALE,
  }
}

export function useAppData() {
  const [store, setStore] = useState<MultiMonthStore | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        const store = parsed?.schemaVersion === SCHEMA_VERSION ? parsed : migrate(parsed)
        if (store !== parsed) localStorage.setItem(STORE_KEY, JSON.stringify(store))
        setStore(store)
        setLoaded(true)
        return
      }
      const legacy = localStorage.getItem(LEGACY_KEY)
      if (legacy) {
        const migrated = migrate(makeStore(JSON.parse(legacy), "Mês atual", uid()))
        localStorage.setItem(STORE_KEY, JSON.stringify(migrated))
        setStore(migrated)
        setLoaded(true)
        return
      }
    } catch {}
    const id = currentMonthId()
    const fresh = makeStore(DEFAULT_DATA, currentMonthLabel(), id)
    try { localStorage.setItem(STORE_KEY, JSON.stringify(fresh)) } catch {}
    setStore(fresh)
    setLoaded(true)
  }, [])

  const saveStore = useCallback((next: MultiMonthStore) => {
    setStore(next)
    try { localStorage.setItem(STORE_KEY, JSON.stringify(next)) } catch {}
  }, [])

  const activeMonth = store?.months.find(m => m.id === store.activeId) ?? { data: DEFAULT_DATA }
  const data = activeMonth.data

  const totalIncome = data.incomeSources.reduce((s, i) => s + i.amount, 0)
  const totalExpenses = data.expenseCategories.reduce((s, c) => s + c.amount, 0)
  const remainder = totalIncome - totalExpenses
  const totalPct = data.investmentBuckets.reduce((s, b) => s + b.percentage, 0)

  function patchActive(next: AppData) {
    if (!store) return
    saveStore({
      ...store,
      months: store.months.map(m => m.id === store.activeId ? { ...m, data: next } : m),
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

  function switchMonth(id: string) {
    if (!store) return
    saveStore({ ...store, activeId: id })
  }

  function createMonth(label: string, copyBuckets: boolean) {
    if (!store) return
    const id = uid()
    const buckets = copyBuckets
      ? activeMonth.data.investmentBuckets.map(b => ({ ...b, id: uid() }))
      : DEFAULT_DATA.investmentBuckets.map(b => ({ ...b, id: uid() }))
    const newData: AppData = {
      incomeSources: [{ id: uid(), name: "Salário", amount: 0 }],
      expenseCategories: [],
      investmentBuckets: buckets,
    }
    const newMonth: MonthRecord = { id, label, data: newData }
    saveStore({ ...store, activeId: id, months: [...store.months, newMonth] })
  }

  function renameMonth(id: string, label: string) {
    if (!store) return
    saveStore({ ...store, months: store.months.map(m => m.id === id ? { ...m, label } : m) })
  }

  function deleteMonth(id: string) {
    if (!store || store.months.length <= 1) return
    const remaining = store.months.filter(m => m.id !== id)
    const activeId = store.activeId === id ? remaining[0].id : store.activeId
    saveStore({ ...store, activeId, months: remaining })
  }

  function exportJSON(): string {
    return JSON.stringify(store, null, 2)
  }

  /** Parses, migrates and replaces the whole store. Returns false on invalid input. */
  function importJSON(text: string): boolean {
    try {
      const parsed = JSON.parse(text)
      if (!parsed || !Array.isArray(parsed.months) || parsed.months.length === 0) return false
      saveStore(migrate(parsed))
      return true
    } catch {
      return false
    }
  }

  return {
    data,
    loaded,
    totalIncome,
    totalExpenses,
    remainder,
    totalPct,
    updateIncome,
    updateExpenses,
    updateBuckets,
    months: store?.months ?? [],
    activeId: store?.activeId ?? "",
    switchMonth,
    createMonth,
    renameMonth,
    deleteMonth,
    nextMonthLabel,
    currency: store?.currency ?? DEFAULT_CURRENCY,
    locale: store?.locale ?? DEFAULT_LOCALE,
    exportJSON,
    importJSON,
  }
}
