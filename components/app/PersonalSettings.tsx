"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { Bot, Save, UserRound, WalletCards } from "lucide-react"
import { useApp } from "./AppDataProvider"

interface Props {
  initialName: string
  initialPhone: string | null
  initialAssistantPreferences: {
    preferredName: string | null
    tone: "warm" | "balanced" | "direct"
    verbosity: "brief" | "balanced" | "detailed"
    greetings: boolean
  }
}

function formatBrazilPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 13)
  if (!digits) return ""
  if (digits.length <= 11 && !digits.startsWith("55")) return `+55${digits}`
  return `+${digits}`
}

export function PersonalSettings({ initialName, initialPhone, initialAssistantPreferences }: Readonly<Props>) {
  const app = useApp()
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone ?? "")
  const [assistantPreferredName, setAssistantPreferredName] = useState(initialAssistantPreferences.preferredName ?? "")
  const [assistantTone, setAssistantTone] = useState(initialAssistantPreferences.tone)
  const [assistantVerbosity, setAssistantVerbosity] = useState(initialAssistantPreferences.verbosity)
  const [assistantGreetings, setAssistantGreetings] = useState(initialAssistantPreferences.greetings)
  const [taxIds, setTaxIds] = useState<Record<string, string>>(() => Object.fromEntries(
    app.wallets.map(wallet => [wallet.id, wallet.taxId ?? ""]),
  ))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanedTaxIds = Object.fromEntries(Object.entries(taxIds).map(([id, value]) => [id, value.replace(/\D/g, "")]))
    const invalid = Object.values(cleanedTaxIds).some(value => value.length > 0 && value.length !== 11 && value.length !== 14)
    if (invalid) {
      setMessage("CPF deve ter 11 dígitos e CNPJ deve ter 14 dígitos.")
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, assistantPreferredName, assistantTone, assistantVerbosity, assistantGreetings }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar os dados.")
      app.updateWalletTaxIds(cleanedTaxIds)
      setMessage("Dados salvos.")
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar os dados.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl bg-cyan-500/10 p-2 text-cyan-300"><UserRound className="h-5 w-5" /></div>
          <div><h2 className="font-semibold text-white">Dados pessoais</h2><p className="mt-1 text-sm text-zinc-500">Usados para exibição e futuras integrações.</p></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-zinc-300">Nome completo
            <input required minLength={2} maxLength={120} value={name} onChange={event => setName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-cyan-500/50" placeholder="Ex.: Allan Pimentel" />
          </label>
          <label className="text-sm text-zinc-300">Telefone
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onFocus={() => { if (!phone) setPhone("+55") }}
              onChange={event => setPhone(formatBrazilPhoneInput(event.target.value))}
              className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-cyan-500/50"
              placeholder="+5531988338833"
            />
            <span className="mt-1 block text-xs text-zinc-600">Opcional. Informe DDD e número; o código +55 é preenchido automaticamente.</span>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-300"><Bot className="h-5 w-5" /></div>
          <div><h2 className="font-semibold text-white">Jeito de conversar</h2><p className="mt-1 text-sm text-zinc-500">Essas preferências alteram a comunicação, nunca as regras ou confirmações financeiras.</p></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-zinc-300">Como o assistente deve chamar você
            <input maxLength={60} value={assistantPreferredName} onChange={event => setAssistantPreferredName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-emerald-500/50" placeholder="Ex.: Allan" />
            <span className="mt-1 block text-xs text-zinc-600">Opcional. Se vazio, ele usa seu primeiro nome.</span>
          </label>
          <label className="text-sm text-zinc-300">Tom de conversa
            <select value={assistantTone} onChange={event => setAssistantTone(event.target.value as typeof assistantTone)} className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-emerald-500/50">
              <option value="warm">Acolhedor e próximo</option>
              <option value="balanced">Equilibrado</option>
              <option value="direct">Direto e objetivo</option>
            </select>
          </label>
          <label className="text-sm text-zinc-300">Nível de explicação
            <select value={assistantVerbosity} onChange={event => setAssistantVerbosity(event.target.value as typeof assistantVerbosity)} className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-emerald-500/50">
              <option value="brief">Curto</option>
              <option value="balanced">Equilibrado</option>
              <option value="detailed">Explicativo</option>
            </select>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-300"><input type="checkbox" checked={assistantGreetings} onChange={event => setAssistantGreetings(event.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-400" /><span><span className="font-medium text-zinc-200">Saudações por horário</span><span className="mt-1 block text-xs text-zinc-600">Permitir “bom dia”, “boa tarde” ou “boa noite” no primeiro contato do dia.</span></span></label>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl bg-violet-500/10 p-2 text-violet-300"><WalletCards className="h-5 w-5" /></div>
          <div><h2 className="font-semibold text-white">Documentos das carteiras</h2><p className="mt-1 text-sm text-zinc-500">CPF ou CNPJ opcional, associado a cada carteira.</p></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {app.wallets.map(wallet => (
            <label key={wallet.id} className="text-sm text-zinc-300">{wallet.name}
              <input
                inputMode="numeric"
                maxLength={18}
                value={taxIds[wallet.id] ?? ""}
                onChange={event => setTaxIds(current => ({ ...current, [wallet.id]: event.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-violet-500/50"
                placeholder="CPF ou CNPJ"
              />
            </label>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-cyan-400 disabled:opacity-60"><Save className="h-4 w-4" />{saving ? "Salvando…" : "Salvar dados"}</button>
        {message && <p className={`text-sm ${message === "Dados salvos." ? "text-emerald-400" : "text-red-300"}`}>{message}</p>}
      </div>
    </form>
  )
}
