"use client"

type Variant = "primary" | "ghost"

const VARIANTS: Record<Variant, string> = {
  primary: "bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-semibold",
  ghost: "text-zinc-400 hover:text-zinc-200",
}

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export function Button({ variant = "primary", className = "", ...rest }: Readonly<Props>) {
  return (
    <button
      {...rest}
      className={`text-sm rounded-xl px-4 py-2.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  )
}
