"use client"

interface Props {
  label: string
  hint?: string
  children: React.ReactNode
}

/** Labeled form row used inside modals/forms. */
export function Field({ label, hint, children }: Readonly<Props>) {
  return (
    <label className="block">
      <span className="text-zinc-400 text-sm font-medium">{label}</span>
      {hint && <span className="text-zinc-600 text-xs ml-2">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

/** Shared input styling matching the app's dark theme. */
export const inputClass =
  "w-full bg-zinc-800 text-white text-sm rounded-xl px-3 py-2.5 outline-none border border-zinc-700 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/40 transition-all"
