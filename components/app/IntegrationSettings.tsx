"use client"
import { useState } from "react"

type Provider = "discord" | "telegram"

export function IntegrationSettings({ linked }: { linked: Partial<Record<Provider, string>> }) {
  const [code, setCode] = useState<{ provider: Provider; value: string; expiresAt: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate(provider: Provider) {
    setError(null)
    const response = await fetch("/api/integrations/link-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }) })
    const result = await response.json() as { code?: string; expiresAt?: string; error?: string }
    if (!response.ok || !result.code || !result.expiresAt) return setError(result.error ?? "Falha ao gerar código.")
    setCode({ provider, value: result.code, expiresAt: result.expiresAt })
  }

  return <div className="space-y-4">
    {(["discord", "telegram"] as Provider[]).map(provider => <section key={provider} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center justify-between gap-4"><div><h3 className="font-semibold capitalize">{provider}</h3><p className="text-sm text-zinc-500">{linked[provider] ? `Vinculado como ${linked[provider]}` : "Não vinculado"}</p></div><button onClick={() => generate(provider)} className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-300">{linked[provider] ? "Vincular novamente" : "Gerar código"}</button></div>
    </section>)}
    {code && <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5"><p className="text-sm text-emerald-200">Envie ao bot no {code.provider}:</p><code className="mt-2 block text-xl font-bold text-white">/vincular {code.value}</code><p className="mt-2 text-xs text-zinc-400">Expira em {new Date(code.expiresAt).toLocaleTimeString("pt-BR")} e só pode ser usado uma vez.</p></section>}
    {error && <p className="text-sm text-red-300">{error}</p>}
  </div>
}
