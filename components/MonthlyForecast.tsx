import { formatCurrency } from "@/lib/utils"
import { currentMonthId } from "@/lib/months"
import { CalendarClock } from "lucide-react"

interface ForecastMonth {
  id: string
  label: string
  fixed: number
  manual: number
  total: number
}

interface Props {
  months: ForecastMonth[]
  incomeReference: number
}

export function MonthlyForecast({ months, incomeReference }: Readonly<Props>) {
  const today = currentMonthId()

  return (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <div className="flex items-center gap-3 mb-1">
        <div className="bg-cyan-500/10 p-2 rounded-xl">
          <CalendarClock className="w-5 h-5 text-cyan-400" />
        </div>
        <h3 className="text-white font-semibold">Planejamento dos próximos 12 meses</h3>
      </div>
      <p className="text-zinc-500 text-sm mb-4">
        Gastos fixos cadastrados + o que já foi lançado em cada mês, comparado com a renda atual de{" "}
        {formatCurrency(incomeReference)}
      </p>

      <div className="space-y-2">
        <div className="hidden sm:grid grid-cols-5 gap-4 text-zinc-500 text-xs uppercase tracking-wider px-3">
          <span>Mês</span>
          <span className="text-right">Fixo</span>
          <span className="text-right">Já lançado</span>
          <span className="text-right">Total previsto</span>
          <span className="text-right">Saldo previsto</span>
        </div>
        {months.map(m => {
          const saldo = incomeReference - m.total
          return (
            <div
              key={m.id}
              className={`grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4 items-center rounded-xl px-3 py-2.5 ${
                m.id === today
                  ? "bg-cyan-500/10 border border-cyan-500/30"
                  : "bg-zinc-800/40"
              }`}
            >
              <span className="text-white text-sm font-medium col-span-2 sm:col-span-1 capitalize">{m.label}</span>
              <span className="text-zinc-300 text-sm text-right">{formatCurrency(m.fixed)}</span>
              <span className="text-zinc-300 text-sm text-right">{formatCurrency(m.manual)}</span>
              <span className="text-red-400 text-sm text-right">{formatCurrency(m.total)}</span>
              <span className={`text-sm text-right font-semibold ${saldo >= 0 ? "text-cyan-400" : "text-red-400"}`}>
                {formatCurrency(saldo)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
