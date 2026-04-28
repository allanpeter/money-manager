"use client"
import { useState, useEffect, useCallback } from "react"
import { AppData, IncomeSource, ExpenseCategory, InvestmentBucket, MonthRecord, MultiMonthStore } from "./types"
import { DEFAULT_DATA } from "./defaults"
import { uid } from "./utils"

const LEGACY_KEY = "money-manager-data"
const STORE_KEY  = "money-manager-store"

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
  return { activeId: id, months: [{ id, label, data }] }
}

export function useAppData() {
  const [store, setStore] = useState<MultiMonthStore | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY)
      if (saved) {
        setStore(JSON.parse(saved))
        setLoaded(true)
        return
      }
      const legacy = localStorage.getItem(LEGACY_KEY)
      if (legacy) {
        const migrated = makeStore(JSON.parse(legacy), "Mês atual", uid())
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
    saveStore({ activeId: id, months: [...store.months, newMonth] })
  }

  function renameMonth(id: string, label: string) {
    if (!store) return
    saveStore({ ...store, months: store.months.map(m => m.id === id ? { ...m, label } : m) })
  }

  function deleteMonth(id: string) {
    if (!store || store.months.length <= 1) return
    const remaining = store.months.filter(m => m.id !== id)
    const activeId = store.activeId === id ? remaining[0].id : store.activeId
    saveStore({ activeId, months: remaining })
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
  }
}
