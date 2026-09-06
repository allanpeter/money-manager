"use client"
import { Layers } from "lucide-react"
import { useApp } from "@/components/app/AppDataProvider"
import { IncomeSection } from "@/components/IncomeSection"
import { ExpensesSection } from "@/components/ExpensesSection"
import { RecurringIncomeSection } from "@/components/RecurringIncomeSection"
import { RecurringExpensesSection } from "@/components/RecurringExpensesSection"
import { InvestmentSection } from "@/components/InvestmentSection"
import { WalletBreakdown } from "@/components/WalletBreakdown"
import { DataControls } from "@/components/DataControls"
import { MonthlyPaymentReview } from "@/components/MonthlyPaymentReview"
import { CardPurchasesSection } from "@/components/CardPurchasesSection"
import { shiftMonth } from "@/lib/months"

export default function LancamentosPage() {
  const {
    data, manualIncome, manualExpenses, remainder, totalPct,
    updateIncome, updateExpenses, updateBuckets,
    recurringIncomes, updateRecurringIncomes,
    recurringExpenses, updateRecurringExpenses,
    isConsolidated, walletBreakdown,
    activeMonthId, recurringExpensePayments, setRecurringExpensePayment,
    creditCards, creditCardPurchases, updateCreditCardPurchases, activeCreditCardBills,
    moveExpenseToCreditCard,
    exportJSON, importJSON,
  } = useApp()

  if (isConsolidated) {
    return (
      <>
        <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="bg-cyan-500/10 p-2 rounded-xl">
            <Layers className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <p className="text-white font-medium">Visão consolidada (Todos)</p>
            <p className="text-zinc-500 text-sm">Selecione uma carteira acima para editar seus lançamentos.</p>
          </div>
        </div>
        <WalletBreakdown breakdown={walletBreakdown} />
        <DataControls exportJSON={exportJSON} importJSON={importJSON} />
      </>
    )
  }

  return (
    <>
      <MonthlyPaymentReview
        monthId={activeMonthId}
        items={[
          ...recurringExpenses.filter(item => {
            if (activeMonthId < item.startMonth) return false
            return item.installments == null || activeMonthId <= shiftMonth(item.startMonth, item.installments - 1)
          }),
          ...activeCreditCardBills.map(entry => entry.bill),
        ]}
        payments={recurringExpensePayments}
        details={Object.fromEntries(activeCreditCardBills.map(entry => [entry.bill.id, entry.detail]))}
        onChange={(expenseId, payment) => setRecurringExpensePayment(expenseId, activeMonthId, payment)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IncomeSection sources={data.incomeSources} total={manualIncome} onChange={updateIncome} />
        <ExpensesSection
          categories={data.expenseCategories}
          total={manualExpenses}
          cards={creditCards.filter(card => !card.archived)}
          onChange={updateExpenses}
          onMoveToCard={moveExpenseToCreditCard}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecurringIncomeSection items={recurringIncomes} onChange={updateRecurringIncomes} />
        <RecurringExpensesSection items={recurringExpenses} onChange={updateRecurringExpenses} />
      </div>

      <CardPurchasesSection
        cards={creditCards}
        purchases={creditCardPurchases}
        onPurchasesChange={updateCreditCardPurchases}
      />

      <InvestmentSection buckets={data.investmentBuckets} remainder={remainder} totalPct={totalPct} onChange={updateBuckets} />

      <DataControls exportJSON={exportJSON} importJSON={importJSON} />
    </>
  )
}
