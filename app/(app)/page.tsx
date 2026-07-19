"use client"
import { useApp } from "@/components/app/AppDataProvider"
import { formatCurrency } from "@/lib/utils"
import { SummaryBar } from "@/components/SummaryBar"
import { ExpenseChart, InvestmentChart } from "@/components/Charts"
import { MonthlyForecast } from "@/components/MonthlyForecast"
import { WalletBreakdown } from "@/components/WalletBreakdown"
import { DashboardAlerts, type DashboardAlert } from "@/components/app/DashboardAlerts"
import { FixedVsVariable } from "@/components/app/FixedVsVariable"
import { TopExpenses } from "@/components/app/TopExpenses"

export default function DashboardPage() {
  const {
    data, activeRecurringExpenses,
    totalIncome, totalExpenses, remainder, totalPct,
    forecast, forecastByWallet, walletBreakdown, wallets,
  } = useApp()

  const allExpenses = [...data.expenseCategories, ...activeRecurringExpenses]
  const fixed = allExpenses.filter(c => c.type === "fixed").reduce((s, c) => s + c.amount, 0)
  const variable = allExpenses.filter(c => c.type === "variable").reduce((s, c) => s + c.amount, 0)
  const savingsRate = totalIncome > 0 ? Math.round((remainder / totalIncome) * 100) : 0

  const alerts: DashboardAlert[] = []
  if (remainder < 0) {
    alerts.push({ tone: "danger", text: `Seus gastos superam a renda em ${formatCurrency(Math.abs(remainder))}.` })
  }
  if (totalIncome > 0 && fixed / totalIncome > 0.6) {
    alerts.push({ tone: "warning", text: `Gastos fixos são ${Math.round((fixed / totalIncome) * 100)}% da renda — acima de 60%.` })
  }
  if (totalPct > 100) {
    alerts.push({ tone: "warning", text: `Suas metas somam ${totalPct}% do saldo — acima de 100%.` })
  }
  if (totalIncome > 0 && remainder >= 0 && savingsRate >= 20) {
    alerts.push({ tone: "good", text: `Você está poupando ${savingsRate}% da renda neste mês.` })
  }
  const reached = data.investmentBuckets.find(b => (b.targetAmount ?? 0) > 0 && (b.saved ?? 0) >= (b.targetAmount ?? 0))
  if (reached) {
    alerts.push({ tone: "good", text: `Meta "${reached.name}" atingida!` })
  }

  return (
    <>
      <SummaryBar income={totalIncome} expenses={totalExpenses} remainder={remainder} />

      <DashboardAlerts alerts={alerts} />

      {wallets.length > 1 && <WalletBreakdown breakdown={walletBreakdown} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FixedVsVariable fixed={fixed} variable={variable} />
        <TopExpenses items={allExpenses} total={totalExpenses} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          <h3 className="text-white font-semibold mb-1">Distribuição de Gastos</h3>
          <p className="text-zinc-500 text-sm mb-4">Por categoria</p>
          <ExpenseChart categories={allExpenses} />
        </div>
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          <h3 className="text-white font-semibold mb-1">Distribuição de Investimentos</h3>
          <p className="text-zinc-500 text-sm mb-4">Sobre o saldo livre</p>
          <InvestmentChart buckets={data.investmentBuckets} remainder={remainder} />
        </div>
      </div>

      <MonthlyForecast months={forecast} byWallet={forecastByWallet} />
    </>
  )
}
