"use client"
import { useState, useEffect, useCallback } from "react"
import { AppData, IncomeSource, ExpenseCategory, InvestmentBucket } from "./types"
import { DEFAULT_DATA } from "./defaults"

const STORAGE_KEY = "money-manager-data"

export function useAppData() {
  const [data, setData] = useState<AppData>(DEFAULT_DATA)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setData(JSON.parse(saved))
    } catch {}
    setLoaded(true)
  }, [])

  const save = useCallback((next: AppData) => {
    setData(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  }, [])

  const totalIncome = data.incomeSources.reduce((s, i) => s + i.amount, 0)
  const totalExpenses = data.expenseCategories.reduce((s, c) => s + c.amount, 0)
  const remainder = totalIncome - totalExpenses
  const totalPct = data.investmentBuckets.reduce((s, b) => s + b.percentage, 0)

  function updateIncome(sources: IncomeSource[]) {
    save({ ...data, incomeSources: sources })
  }

  function updateExpenses(categories: ExpenseCategory[]) {
    save({ ...data, expenseCategories: categories })
  }

  function updateBuckets(buckets: InvestmentBucket[]) {
    save({ ...data, investmentBuckets: buckets })
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
  }
}
