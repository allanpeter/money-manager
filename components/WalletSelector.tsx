"use client"
import { useState, useRef, useEffect } from "react"
import { Plus, X, Layers } from "lucide-react"
import { Wallet, ALL_WALLETS } from "@/lib/types"

interface Props {
  wallets: Wallet[]
  activeWalletId: string
  onSwitch: (id: string) => void
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

export function WalletSelector({ wallets, activeWalletId, onSwitch, onCreate, onRename, onDelete }: Readonly<Props>) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [showPopover, setShowPopover] = useState(false)
  const [newName, setNewName] = useState("")
  const popoverRef = useRef<HTMLDivElement>(null)

  function openPopover() {
    setNewName("")
    setShowPopover(true)
  }

  function handleCreate() {
    const name = newName.trim()
    if (!name) return
    onCreate(name)
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

  function handleDelete(id: string, name: string) {
    if (window.confirm(`Excluir a carteira "${name}"? Todos os dados dela serão perdidos.`)) onDelete(id)
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

  const consolidatedActive = activeWalletId === ALL_WALLETS

  return (
    <div className="relative">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
        {wallets.map(wallet => {
          const isActive = wallet.id === activeWalletId
          return (
            <div key={wallet.id} className="group flex items-center gap-1 flex-shrink-0">
              {renamingId === wallet.id ? (
                <input
                  autoFocus
                  className="bg-zinc-800 text-white text-sm rounded-xl px-3 py-1.5 outline-none focus:ring-1 focus:ring-cyan-500/50 w-32"
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
                  className={`flex items-center gap-1.5 text-sm rounded-xl px-3 py-1.5 transition-all ${
                    isActive
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                      : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                  onClick={() => (isActive ? startRename(wallet.id, wallet.name) : onSwitch(wallet.id))}
                  onDoubleClick={() => startRename(wallet.id, wallet.name)}
                >
                  {wallet.emoji ? (
                    <span className="text-xs leading-none">{wallet.emoji}</span>
                  ) : (
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: wallet.color ?? "#71717a" }}
                    />
                  )}
                  {wallet.name}
                </button>
              )}
              {!isActive && wallets.length > 1 && (
                <button
                  className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all"
                  onClick={() => handleDelete(wallet.id, wallet.name)}
                  aria-label={`Excluir ${wallet.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )
        })}

        <button
          onClick={() => onSwitch(ALL_WALLETS)}
          className={`flex-shrink-0 flex items-center gap-1.5 text-sm rounded-xl px-3 py-1.5 transition-all ${
            consolidatedActive
              ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
              : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Todos
        </button>

        <button
          onClick={openPopover}
          aria-label="Nova carteira"
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
          <p className="text-white font-semibold text-sm mb-3">Nova carteira</p>
          <input
            autoFocus
            className="w-full bg-zinc-800 text-white text-sm rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-cyan-500/50 mb-4"
            placeholder="Ex.: PJ, PF, Investimentos"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
          />
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
