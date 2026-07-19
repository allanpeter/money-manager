"use client"
import { AlertTriangle, CheckCircle2, Info } from "lucide-react"

export type AlertTone = "danger" | "warning" | "good"
export interface DashboardAlert {
  tone: AlertTone
  text: string
}

const STYLES: Record<AlertTone, string> = {
  danger: "bg-red-500/10 border-red-500/20 text-red-400",
  warning: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  good: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
}

const ICONS = { danger: AlertTriangle, warning: AlertTriangle, good: CheckCircle2 }

export function DashboardAlerts({ alerts }: Readonly<{ alerts: DashboardAlert[] }>) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-zinc-500 text-sm">
        <Info className="w-4 h-4 flex-shrink-0" />
        Tudo sob controle neste mês. Nenhum alerta.
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {alerts.map((a, i) => {
        const Icon = ICONS[a.tone]
        return (
          <div key={i} className={`flex items-center gap-2 border rounded-2xl p-4 text-sm ${STYLES[a.tone]}`}>
            <Icon className="w-4 h-4 flex-shrink-0" />
            {a.text}
          </div>
        )
      })}
    </div>
  )
}
