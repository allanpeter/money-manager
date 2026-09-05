"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(formData: FormData) {
    setLoading(true)
    setError(null)
    const body = Object.fromEntries(formData.entries())
    const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const result = await response.json() as { error?: string }
    if (!response.ok) {
      setError(result.error ?? "Não foi possível entrar.")
      setLoading(false)
      return
    }
    router.push("/")
    router.refresh()
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit(new FormData(event.currentTarget))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === "register" && <>
        <label className="block text-sm text-zinc-300">Nome<input name="name" required autoComplete="name" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-white" /></label>
      </>}
      <label className="block text-sm text-zinc-300">E-mail<input name="email" required type="email" autoComplete="email" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-white" /></label>
      <label className="block text-sm text-zinc-300">Senha<input name="password" required type="password" minLength={mode === "register" ? 12 : undefined} autoComplete={mode === "register" ? "new-password" : "current-password"} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-white" /></label>
      {mode === "register" && <p className="text-xs text-zinc-500">Use ao menos 12 caracteres, com letra, número e símbolo.</p>}
      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      <button type="submit" disabled={loading} className="w-full rounded-xl bg-cyan-500 px-4 py-2.5 font-semibold text-zinc-950 disabled:opacity-50">{loading ? "Aguarde…" : mode === "register" ? "Criar conta" : "Entrar"}</button>
      <p className="text-center text-sm text-zinc-500">
        {mode === "login" ? "Ainda não tem uma conta? " : "Já possui uma conta? "}
        <Link href={mode === "login" ? "/cadastro" : "/login"} className="text-cyan-300 hover:text-cyan-200">
          {mode === "login" ? "Cadastre-se" : "Entrar"}
        </Link>
      </p>
    </form>
  )
}
