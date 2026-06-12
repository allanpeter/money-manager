"use client"
import { useState } from "react"
import Link from "next/link"
import { PieChart, ArrowRight } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

const SLICES = [
  { key: "needs", label: "Necessidades", pct: 50, color: "#ef4444", hint: "Moradia, contas, mercado, transporte, saúde." },
  { key: "wants", label: "Desejos", pct: 30, color: "#f59e0b", hint: "Lazer, restaurantes, assinaturas, compras." },
  { key: "savings", label: "Poupança e metas", pct: 20, color: "#06b6d4", hint: "Reserva, investimentos e objetivos." },
]

export function BudgetRuleCalculator() {
  const [income, setIncome] = useState<number>(0)

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="bg-cyan-500/10 p-2 rounded-xl">
          <PieChart className="w-5 h-5 text-cyan-400" />
        </div>
        <h2 className="text-white font-semibold text-lg">Calculadora 50/30/20</h2>
      </div>

      <label className="block">
        <span className="text-zinc-400 text-sm">Qual a sua renda líquida mensal?</span>
        <div className="mt-1.5 flex items-center gap-2 bg-zinc-800/60 rounded-xl px-3 py-2.5">
          <span className="text-zinc-500 text-sm">R$</span>
          <input
            type="number"
            min={0}
            inputMode="decimal"
            className="bg-transparent text-white text-base flex-1 outline-none"
            value={income || ""}
            placeholder="0,00"
            onChange={e => setIncome(Number.parseFloat(e.target.value) || 0)}
          />
        </div>
        <span className="text-zinc-600 text-xs mt-1 block">
          O valor que cai na sua conta, já descontados impostos.
        </span>
      </label>

      <div className="space-y-3">
        {SLICES.map(s => (
          <div key={s.key} className="bg-zinc-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-zinc-200 text-sm font-medium">{s.label}</span>
                <span className="text-zinc-500 text-xs">{s.pct}%</span>
              </div>
              <span className="text-white font-bold">{formatCurrency((income * s.pct) / 100)}</span>
            </div>
            <p className="text-zinc-600 text-xs mt-1">{s.hint}</p>
          </div>
        ))}
      </div>

      <Link
        href="/"
        className="flex items-center justify-center gap-2 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-xl py-3 text-sm font-medium transition-all"
      >
        Aplicar isso no app gratuito
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
