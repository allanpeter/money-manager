"use client"
import { useState } from "react"
import { formatCurrency } from "@/lib/utils"
import { currentMonthId } from "@/lib/months"
import { CalendarClock } from "lucide-react"

interface ForecastMonth {
  id: string
  label: string
  income: number
  fixed: number
  manual: number
  total: number
  saldo: number
}

interface WalletForecast {
  id: string
  name: string
  color?: string
  months: ForecastMonth[]
}

interface Props {
  months: ForecastMonth[]
  byWallet?: WalletForecast[]
}

type View = "consolidado" | "carteira"

function ForecastTable({ months }: Readonly<{ months: ForecastMonth[] }>) {
  const today = currentMonthId()
  return (
    <div className="space-y-2">
      <div className="hidden sm:grid grid-cols-6 gap-4 text-zinc-500 text-xs uppercase tracking-wider px-3">
        <span>Mês</span>
        <span className="text-right">Renda prevista</span>
        <span className="text-right">Fixo</span>
        <span className="text-right">Já lançado</span>
        <span className="text-right">Total previsto</span>
        <span className="text-right">Saldo previsto</span>
      </div>
      {months.map(m => (
        <div
          key={m.id}
          className={`grid grid-cols-2 sm:grid-cols-6 gap-2 sm:gap-4 items-center rounded-xl px-3 py-2.5 ${
            m.id === today ? "bg-cyan-500/10 border border-cyan-500/30" : "bg-zinc-800/40"
          }`}
        >
          <span className="text-white text-sm font-medium col-span-2 sm:col-span-1 capitalize">{m.label}</span>
          <span className="text-emerald-400 text-sm text-right">{formatCurrency(m.income)}</span>
          <span className="text-zinc-300 text-sm text-right">{formatCurrency(m.fixed)}</span>
          <span className="text-zinc-300 text-sm text-right">{formatCurrency(m.manual)}</span>
          <span className="text-red-400 text-sm text-right">{formatCurrency(m.total)}</span>
          <span className={`text-sm text-right font-semibold ${m.saldo >= 0 ? "text-cyan-400" : "text-red-400"}`}>
            {formatCurrency(m.saldo)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function MonthlyForecast({ months, byWallet }: Readonly<Props>) {
  const [view, setView] = useState<View>("consolidado")
  const canSplit = (byWallet?.length ?? 0) > 1

  return (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="flex items-center gap-3">
          <div className="bg-cyan-500/10 p-2 rounded-xl">
            <CalendarClock className="w-5 h-5 text-cyan-400" />
          </div>
          <h3 className="text-white font-semibold">Planejamento dos próximos 12 meses</h3>
        </div>

        {canSplit && (
          <div className="flex bg-zinc-800 rounded-xl p-1 text-xs flex-shrink-0">
            <button
              onClick={() => setView("consolidado")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                view === "consolidado" ? "bg-cyan-500/15 text-cyan-300" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Consolidado
            </button>
            <button
              onClick={() => setView("carteira")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                view === "carteira" ? "bg-cyan-500/15 text-cyan-300" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Por carteira
            </button>
          </div>
        )}
      </div>
      <p className="text-zinc-500 text-sm mb-4">
        Entradas e gastos fixos cadastrados, mais o que já foi lançado em cada mês
      </p>

      {canSplit && view === "carteira" ? (
        <div className="space-y-6">
          {byWallet!.map(w => (
            <div key={w.id}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: w.color ?? "#71717a" }}
                />
                <span className="text-white text-sm font-semibold">{w.name}</span>
              </div>
              <ForecastTable months={w.months} />
            </div>
          ))}
        </div>
      ) : (
        <ForecastTable months={months} />
      )}
    </div>
  )
}
