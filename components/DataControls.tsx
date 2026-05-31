"use client"
import { useRef, useState } from "react"
import { Download, Upload, ShieldCheck } from "lucide-react"

interface Props {
  exportJSON: () => string
  importJSON: (text: string) => boolean
}

export function DataControls({ exportJSON, importJSON }: Readonly<Props>) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)

  function flash(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(null), 3000)
  }

  function handleExport() {
    const blob = new Blob([exportJSON()], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `gestor-financeiro-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    flash(importJSON(text)
      ? "Dados importados com sucesso."
      : "Arquivo inválido. Verifique e tente de novo.")
    e.target.value = ""
  }

  return (
    <div className="flex flex-col items-center gap-3 pb-4">
      <div className="flex items-center gap-3">
        <button
          onClick={handleExport}
          className="flex items-center gap-2 text-zinc-400 hover:text-cyan-400 text-sm bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 transition-colors"
        >
          <Download className="w-4 h-4" />
          Exportar dados
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 text-zinc-400 hover:text-cyan-400 text-sm bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Importar
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImport}
        />
      </div>

      {msg && <p className="text-zinc-400 text-xs">{msg}</p>}

      <p className="flex items-center gap-1.5 text-center text-zinc-600 text-xs">
        <ShieldCheck className="w-3.5 h-3.5" />
        Seus dados ficam só no seu navegador. Exporte para guardar um backup.
      </p>
    </div>
  )
}
