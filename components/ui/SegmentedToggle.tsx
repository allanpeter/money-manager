"use client"

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

type Accent = "cyan" | "emerald" | "red"

/** Full, literal class strings so Tailwind's static scanner keeps them in the bundle. */
const ACTIVE: Record<Accent, string> = {
  cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  red: "bg-red-500/15 text-red-300 border-red-500/30",
}

interface Props<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  accent?: Accent
}

/** A pill-style segmented control. Full-width, one active option. */
export function SegmentedToggle<T extends string>({ options, value, onChange, accent = "cyan" }: Readonly<Props<T>>) {
  return (
    <div className="flex bg-zinc-800 rounded-xl p-1 gap-1">
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 text-sm rounded-lg px-3 py-2 border transition-all ${
              active ? ACTIVE[accent] : "text-zinc-400 hover:text-zinc-200 border-transparent"
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
