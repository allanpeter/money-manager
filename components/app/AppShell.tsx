"use client"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bot, LogOut, Plus, LayoutDashboard, ListPlus, Settings } from "lucide-react"
import { useRouter } from "next/navigation"
import { AppDataProvider, useApp } from "./AppDataProvider"
import { WalletSelector } from "@/components/WalletSelector"
import { MonthSelector } from "@/components/MonthSelector"
import { AddEntryModal } from "./AddEntryModal"

const TABS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lancamentos", label: "Lançamentos", icon: ListPlus },
  { href: "/assistente", label: "Assistente IA", icon: Bot },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
]

function ShellInner({ children, userName, workspaceName }: Readonly<{ children: React.ReactNode; userName: string; workspaceName: string }>) {
  const app = useApp()
  const pathname = usePathname()
  const router = useRouter()
  const [adding, setAdding] = useState(false)

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  if (!app.loaded) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-6 sm:space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Gestor Financeiro</h1>
            <p className="text-zinc-500 mt-1">Controle seus gastos e distribua o que sobra de forma inteligente</p>
          </div>
          <div className="flex items-center gap-3 text-right">
            <div className="hidden sm:block"><p className="text-sm text-zinc-200">{userName}</p><p className="text-xs text-zinc-500">{workspaceName}</p></div>
            <button type="button" onClick={logout} title="Sair" className="rounded-xl border border-zinc-800 p-2 text-zinc-400 hover:text-white"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>

        <WalletSelector
          wallets={app.wallets}
          activeWalletId={app.activeWalletId}
          onSwitch={app.switchWallet}
          onCreate={app.createWallet}
          onRename={app.renameWallet}
          onDelete={app.deleteWallet}
        />

        <MonthSelector
          windowMonths={app.windowMonths}
          activeMonthId={app.activeMonthId}
          onSwitch={app.switchMonth}
          onPrev={() => app.shiftWindow(-1)}
          onNext={() => app.shiftWindow(1)}
        />

        <nav className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-1.5">
          {TABS.map(tab => {
            const active = pathname === tab.href
            const Icon = tab.icon
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-2 text-sm rounded-xl px-4 py-2 transition-all ${
                  active
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </Link>
            )
          })}
        </nav>

        {children}
      </div>

      <button
        onClick={() => setAdding(true)}
        aria-label="Adicionar lançamento"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-semibold rounded-full pl-4 pr-5 py-3 shadow-lg shadow-cyan-500/20 transition-all"
      >
        <Plus className="w-5 h-5" />
        Adicionar
      </button>

      {adding && <AddEntryModal onClose={() => setAdding(false)} />}
    </div>
  )
}

export function AppShell({ children, userName, workspaceName }: Readonly<{ children: React.ReactNode; userName: string; workspaceName: string }>) {
  return (
    <AppDataProvider>
      <ShellInner userName={userName} workspaceName={workspaceName}>{children}</ShellInner>
    </AppDataProvider>
  )
}
