"use client"
import { useState, useRef, useEffect } from "react"
import { Plus, X } from "lucide-react"
import { MonthRecord } from "@/lib/types"

interface Props {
  months: MonthRecord[]
  activeId: string
  nextMonthLabel: () => string
  onSwitch: (id: string) => void
  onCreate: (label: string, copyBuckets: boolean) => void
  onRename: (id: string, label: string) => void
  onDelete: (id: string) => void
}

export function MonthSelector({ months, activeId, nextMonthLabel, onSwitch, onCreate, onRename, onDelete }: Readonly<Props>) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [showPopover, setShowPopover] = useState(false)
  const [newLabel, setNewLabel] = useState("")
  const [copyBuckets, setCopyBuckets] = useState(true)
  const popoverRef = useRef<HTMLDivElement>(null)

  function openPopover() {
    setNewLabel(nextMonthLabel())
    setCopyBuckets(true)
    setShowPopover(true)
  }

  function handleCreate() {
    const label = newLabel.trim()
    if (!label) return
    onCreate(label, copyBuckets)
    setShowPopover(false)
  }

  function startRename(id: string, current: string) {
    setRenamingId(id)
    setRenameValue(current)
  }

  function commitRename() {
    if (renamingId && renameValue.trim()) onRename(renamingId, renameValue.trim())
    setRenamingId(null)
  }

  function handleDelete(id: string, label: string) {
    if (window.confirm(`Excluir o mês "${label}"? Os dados serão perdidos.`)) onDelete(id)
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false)
      }
    }
    if (showPopover) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showPopover])

  return (
    <div className="relative">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
        {months.map(month => {
          const isActive = month.id === activeId
          return (
            <div key={month.id} className="group flex items-center gap-1 flex-shrink-0">
              {renamingId === month.id ? (
                <input
                  autoFocus
                  className="bg-zinc-800 text-white text-sm rounded-xl px-3 py-1.5 outline-none focus:ring-1 focus:ring-cyan-500/50 w-36"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={e => {
                    if (e.key === "Enter") commitRename()
                    if (e.key === "Escape") setRenamingId(null)
                  }}
                />
              ) : (
                <button
                  className={`text-sm rounded-xl px-3 py-1.5 transition-all ${
                    isActive
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                      : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                  onClick={() => isActive ? startRename(month.id, month.label) : onSwitch(month.id)}
                  onDoubleClick={() => startRename(month.id, month.label)}
                >
                  {month.label}
                </button>
              )}
              {!isActive && months.length > 1 && (
                <button
                  className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all"
                  onClick={() => handleDelete(month.id, month.label)}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )
        })}

        <button
          onClick={openPopover}
          className="flex-shrink-0 ml-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-cyan-400 rounded-xl p-1.5 transition-all"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {showPopover && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full mt-2 z-50 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl w-72"
        >
          <p className="text-white font-semibold text-sm mb-3">Novo mês</p>
          <input
            autoFocus
            className="w-full bg-zinc-800 text-white text-sm rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-cyan-500/50 mb-3"
            placeholder="Nome do mês"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
          />
          <label className="flex items-center gap-2 text-zinc-400 text-sm mb-4 cursor-pointer select-none">
            <input
              type="checkbox"
              className="accent-cyan-400"
              checked={copyBuckets}
              onChange={e => setCopyBuckets(e.target.checked)}
            />
            Copiar investimentos do mês actual
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCreate}
              className="flex-1 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-sm rounded-xl py-2 transition-all"
            >
              Criar
            </button>
            <button
              onClick={() => setShowPopover(false)}
              className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
