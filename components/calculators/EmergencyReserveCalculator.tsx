"use client"
import { useState } from "react"
import Link from "next/link"
import { ShieldCheck, ArrowRight } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

const MONTH_OPTIONS = [3, 6, 12]

export function EmergencyReserveCalculator() {
  const [essential, setEssential] = useState<number>(0)
  const [months, setMonths] = useState<number>(6)
  const [monthlySaving, setMonthlySaving] = useState<number>(0)

  const target = essential * months
  const monthsToReach = monthlySaving > 0 ? Math.ceil(target / monthlySaving) : 0

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="bg-cyan-500/10 p-2 rounded-xl">
          <ShieldCheck className="w-5 h-5 text-cyan-400" />
        </div>
        <h2 className="text-white font-semibold text-lg">Calculadora de reserva de emergência</h2>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="text-zinc-400 text-sm">Quanto você gasta por mês com o essencial?</span>
          <div className="mt-1.5 flex items-center gap-2 bg-zinc-800/60 rounded-xl px-3 py-2.5">
            <span className="text-zinc-500 text-sm">R$</span>
            <input
              type="number"
              min={0}
              inputMode="decimal"
              className="bg-transparent text-white text-base flex-1 outline-none"
              value={essential || ""}
              placeholder="0,00"
              onChange={e => setEssential(Number.parseFloat(e.target.value) || 0)}
            />
          </div>
          <span className="text-zinc-600 text-xs mt-1 block">
            Moradia, contas, alimentação, transporte e saúde — o que você não pode cortar.
          </span>
        </label>

        <div>
          <span className="text-zinc-400 text-sm">Quantos meses de reserva você quer?</span>
          <div className="mt-1.5 flex gap-2">
            {MONTH_OPTIONS.map(m => (
              <button
                key={m}
                onClick={() => setMonths(m)}
                className={`flex-1 rounded-xl py-2.5 text-sm transition-all border ${
                  months === m
                    ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                    : "bg-zinc-800/60 text-zinc-400 border-transparent hover:text-zinc-200"
                }`}
              >
                {m} meses
              </button>
            ))}
          </div>
          <span className="text-zinc-600 text-xs mt-1.5 block">
            3 meses para quem tem renda estável (CLT); 6 a 12 para autônomos ou renda variável.
          </span>
        </div>

        <label className="block">
          <span className="text-zinc-400 text-sm">Quanto consegue guardar por mês? (opcional)</span>
          <div className="mt-1.5 flex items-center gap-2 bg-zinc-800/60 rounded-xl px-3 py-2.5">
            <span className="text-zinc-500 text-sm">R$</span>
            <input
              type="number"
              min={0}
              inputMode="decimal"
              className="bg-transparent text-white text-base flex-1 outline-none"
              value={monthlySaving || ""}
              placeholder="0,00"
              onChange={e => setMonthlySaving(Number.parseFloat(e.target.value) || 0)}
            />
          </div>
        </label>
      </div>

      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 text-center">
        <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Sua reserva ideal</p>
        <p className="text-cyan-400 font-bold text-3xl">{formatCurrency(target)}</p>
        {monthsToReach > 0 && (
          <p className="text-zinc-400 text-sm mt-2">
            Guardando {formatCurrency(monthlySaving)}/mês, você chega lá em{" "}
            <strong className="text-white">~{monthsToReach} {monthsToReach === 1 ? "mês" : "meses"}</strong>.
          </p>
        )}
      </div>

      <Link
        href="/"
        className="flex items-center justify-center gap-2 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-xl py-3 text-sm font-medium transition-all"
      >
        Criar essa meta no app gratuito
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
