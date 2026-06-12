"use client"
import { useState } from "react"
import Link from "next/link"
import { Target, ArrowRight } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export function MonthlyGoalCalculator() {
  const [target, setTarget] = useState<number>(0)
  const [saved, setSaved] = useState<number>(0)
  const [months, setMonths] = useState<number>(12)

  const missing = Math.max(0, target - saved)
  const perMonth = months > 0 ? missing / months : 0

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="bg-cyan-500/10 p-2 rounded-xl">
          <Target className="w-5 h-5 text-cyan-400" />
        </div>
        <h2 className="text-white font-semibold text-lg">Quanto guardar por mês</h2>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="text-zinc-400 text-sm">Qual o valor da sua meta?</span>
          <div className="mt-1.5 flex items-center gap-2 bg-zinc-800/60 rounded-xl px-3 py-2.5">
            <span className="text-zinc-500 text-sm">R$</span>
            <input
              type="number"
              min={0}
              inputMode="decimal"
              className="bg-transparent text-white text-base flex-1 outline-none"
              value={target || ""}
              placeholder="0,00"
              onChange={e => setTarget(Number.parseFloat(e.target.value) || 0)}
            />
          </div>
        </label>

        <label className="block">
          <span className="text-zinc-400 text-sm">Quanto você já tem guardado?</span>
          <div className="mt-1.5 flex items-center gap-2 bg-zinc-800/60 rounded-xl px-3 py-2.5">
            <span className="text-zinc-500 text-sm">R$</span>
            <input
              type="number"
              min={0}
              inputMode="decimal"
              className="bg-transparent text-white text-base flex-1 outline-none"
              value={saved || ""}
              placeholder="0,00"
              onChange={e => setSaved(Number.parseFloat(e.target.value) || 0)}
            />
          </div>
        </label>

        <label className="block">
          <span className="text-zinc-400 text-sm">Em quantos meses você quer atingir?</span>
          <div className="mt-1.5 flex items-center gap-2 bg-zinc-800/60 rounded-xl px-3 py-2.5">
            <input
              type="number"
              min={1}
              inputMode="numeric"
              className="bg-transparent text-white text-base flex-1 outline-none"
              value={months || ""}
              placeholder="12"
              onChange={e => setMonths(Math.max(0, Number.parseInt(e.target.value) || 0))}
            />
            <span className="text-zinc-500 text-sm">meses</span>
          </div>
        </label>
      </div>

      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 text-center">
        <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Você precisa guardar</p>
        <p className="text-cyan-400 font-bold text-3xl">{formatCurrency(perMonth)}<span className="text-zinc-500 text-base font-normal">/mês</span></p>
        {missing > 0 && (
          <p className="text-zinc-400 text-sm mt-2">
            Faltam <strong className="text-white">{formatCurrency(missing)}</strong> para a meta.
          </p>
        )}
      </div>

      <Link
        href="/"
        className="flex items-center justify-center gap-2 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-xl py-3 text-sm font-medium transition-all"
      >
        Acompanhar essa meta no app
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
