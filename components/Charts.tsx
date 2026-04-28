"use client"
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import { ExpenseCategory, InvestmentBucket } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"

interface ExpenseChartProps {
  categories: ExpenseCategory[]
}

interface InvestmentChartProps {
  buckets: InvestmentBucket[]
  remainder: number
}

function CustomTooltip({ active, payload, total }: Readonly<{ active?: boolean; payload?: { name: string; value: number }[]; total: number }>) {
  if (!active || !payload?.length) return null
  const pct = total > 0 ? ((payload[0].value / total) * 100).toFixed(1) : "0.0"
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm">
      <p className="text-zinc-300">{payload[0].name}</p>
      <p className="text-white font-semibold">{formatCurrency(payload[0].value)}</p>
      <p className="text-zinc-400">{pct}%</p>
    </div>
  )
}

export function ExpenseChart({ categories }: ExpenseChartProps) {
  const data = categories.filter(c => c.amount > 0).map(c => ({
    name: c.name,
    value: c.amount,
    color: c.color,
  }))
  const total = data.reduce((s, d) => s + d.value, 0)

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">
        Nenhum gasto registrado ainda
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip total={total} />} />
        <Legend
          formatter={(value) => {
            const entry = data.find(d => d.name === value)
            const pct = entry && total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0.0"
            return <span className="text-zinc-400 text-xs">{value} <span className="text-zinc-500">{pct}%</span></span>
          }}
          iconType="circle"
          iconSize={8}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function InvestmentChart({ buckets, remainder }: InvestmentChartProps) {
  const data = buckets.filter(b => b.percentage > 0).map(b => ({
    name: b.name,
    value: remainder > 0 ? parseFloat(((remainder * b.percentage) / 100).toFixed(2)) : 0,
    color: b.color,
  }))

  const allocated = data.reduce((s, d) => s + d.value, 0)
  const free = remainder > allocated ? remainder - allocated : 0
  if (free > 0) data.push({ name: "Não alocado", value: free, color: "#3f3f46" })
  const total = data.reduce((s, d) => s + d.value, 0)

  if (!data.length || remainder <= 0) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">
        Configure entradas e investimentos
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip total={total} />} />
        <Legend
          formatter={(value) => {
            const entry = data.find(d => d.name === value)
            const pct = entry && total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0.0"
            return <span className="text-zinc-400 text-xs">{value} <span className="text-zinc-500">{pct}%</span></span>
          }}
          iconType="circle"
          iconSize={8}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
