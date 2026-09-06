"use client"

import { ConsolidatedPayments } from "@/components/ConsolidatedPayments"
import { useApp } from "@/components/app/AppDataProvider"

export function ConsolidatedPageClient({ referenceDate }: Readonly<{ referenceDate: string }>) {
  const { activeMonthId, monthlyPaymentItems, setRecurringExpensePaymentForWallet } = useApp()

  return (
    <ConsolidatedPayments
      monthId={activeMonthId}
      items={monthlyPaymentItems}
      referenceDate={referenceDate}
      onChange={(walletId, expenseId, payment) => setRecurringExpensePaymentForWallet(walletId, expenseId, activeMonthId, payment)}
    />
  )
}
