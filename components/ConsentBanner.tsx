"use client"
import { useEffect, useState } from "react"
import Link from "next/link"

const CONSENT_KEY = "money-manager-consent"

export function ConsentBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_KEY)) setShow(true)
    } catch {}
  }, [])

  function decide(value: "accepted" | "rejected") {
    try { localStorage.setItem(CONSENT_KEY, value) } catch {}
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="max-w-3xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <p className="text-zinc-400 text-sm flex-1">
          Usamos armazenamento local e, futuramente, cookies de medição e anúncios para manter o
          serviço gratuito. Seus dados financeiros ficam só no seu navegador.{" "}
          <Link href="/privacidade" className="text-cyan-400 hover:underline">
            Política de privacidade
          </Link>
          .
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => decide("rejected")}
            className="text-zinc-400 hover:text-zinc-200 text-sm px-3 py-2 transition-colors"
          >
            Recusar
          </button>
          <button
            onClick={() => decide("accepted")}
            className="bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-sm rounded-xl px-4 py-2 transition-all"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  )
}
