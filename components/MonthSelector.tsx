"use client"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface Props {
  windowMonths: { id: string; label: string }[]
  activeMonthId: string
  onSwitch: (id: string) => void
  onPrev: () => void
  onNext: () => void
}

export function MonthSelector({ windowMonths, activeMonthId, onSwitch, onPrev, onNext }: Readonly<Props>) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-2 sm:px-4 py-3 flex items-center gap-2">
      <button
        onClick={onPrev}
        aria-label="Meses anteriores"
        className="flex-shrink-0 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-cyan-400 rounded-xl p-1.5 transition-all"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1">
        {windowMonths.map(month => {
          const isActive = month.id === activeMonthId
          return (
            <button
              key={month.id}
              onClick={() => onSwitch(month.id)}
              className={`flex-shrink-0 text-sm rounded-xl px-3 py-1.5 capitalize transition-all ${
                isActive
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {month.label}
            </button>
          )
        })}
      </div>

      <button
        onClick={onNext}
        aria-label="Próximos meses"
        className="flex-shrink-0 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-cyan-400 rounded-xl p-1.5 transition-all"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
