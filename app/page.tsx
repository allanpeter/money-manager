"use client"
import { useAppData } from "@/lib/useAppData"
import { IncomeSection } from "@/components/IncomeSection"
import { ExpensesSection } from "@/components/ExpensesSection"
import { RecurringExpensesSection } from "@/components/RecurringExpensesSection"
import { InvestmentSection } from "@/components/InvestmentSection"
import { SummaryBar } from "@/components/SummaryBar"
import { ExpenseChart, InvestmentChart } from "@/components/Charts"
import { MonthSelector } from "@/components/MonthSelector"
import { WalletSelector } from "@/components/WalletSelector"
import { WalletBreakdown } from "@/components/WalletBreakdown"
import { MonthlyForecast } from "@/components/MonthlyForecast"
import { DataControls } from "@/components/DataControls"

export default function Home() {
  const {
    data, loaded,
    totalIncome, manualExpenses, totalExpenses, remainder, totalPct,
    updateIncome, updateExpenses, updateBuckets,
    recurringExpenses, activeRecurringExpenses, updateRecurringExpenses, forecast,
    windowMonths, activeMonthId, switchMonth, shiftWindow,
    wallets, activeWalletId, isConsolidated, walletBreakdown,
    switchWallet, createWallet, renameWallet, deleteWallet,
    exportJSON, importJSON,
  } = useAppData()

  if (!loaded) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-6 sm:space-y-8">

        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Gestor Financeiro
          </h1>
          <p className="text-zinc-500 mt-1">
            Controle seus gastos e distribua o que sobra de forma inteligente
          </p>
        </div>

        <WalletSelector
          wallets={wallets}
          activeWalletId={activeWalletId}
          onSwitch={switchWallet}
          onCreate={createWallet}
          onRename={renameWallet}
          onDelete={deleteWallet}
        />

        <MonthSelector
          windowMonths={windowMonths}
          activeMonthId={activeMonthId}
          onSwitch={switchMonth}
          onPrev={() => shiftWindow(-1)}
          onNext={() => shiftWindow(1)}
        />

        <SummaryBar
          income={totalIncome}
          expenses={totalExpenses}
          remainder={remainder}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <h3 className="text-white font-semibold mb-1">Distribuição de Gastos</h3>
            <p className="text-zinc-500 text-sm mb-4">Por categoria</p>
            <ExpenseChart categories={[...data.expenseCategories, ...activeRecurringExpenses]} />
          </div>
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <h3 className="text-white font-semibold mb-1">Distribuição de Investimentos</h3>
            <p className="text-zinc-500 text-sm mb-4">Sobre o saldo livre</p>
            <InvestmentChart buckets={data.investmentBuckets} remainder={remainder} />
          </div>
        </div>

        <MonthlyForecast months={forecast} incomeReference={totalIncome} />

        {isConsolidated ? (
          <WalletBreakdown breakdown={walletBreakdown} />
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <IncomeSection
                sources={data.incomeSources}
                total={totalIncome}
                onChange={updateIncome}
              />
              <ExpensesSection
                categories={data.expenseCategories}
                total={manualExpenses}
                onChange={updateExpenses}
              />
            </div>

            <RecurringExpensesSection
              items={recurringExpenses}
              onChange={updateRecurringExpenses}
            />

            <InvestmentSection
              buckets={data.investmentBuckets}
              remainder={remainder}
              totalPct={totalPct}
              onChange={updateBuckets}
            />
          </>
        )}

        <DataControls exportJSON={exportJSON} importJSON={importJSON} />
      </div>
    </div>
  )
}
