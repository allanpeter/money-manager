"use client"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bot, CalendarDays, CreditCard, LogOut, Plus, LayoutDashboard, ListPlus, Menu, PanelLeftClose,
  PanelLeftOpen, Settings, WalletCards, X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { AppDataProvider, useApp } from "./AppDataProvider"
import { WalletSelector } from "@/components/WalletSelector"
import { MonthSelector } from "@/components/MonthSelector"
import { AddEntryModal } from "./AddEntryModal"

const TABS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/consolidado", label: "Consolidado", icon: CalendarDays },
  { href: "/lancamentos", label: "Lançamentos", icon: ListPlus },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/assistente", label: "Assistente IA", icon: Bot },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
]

function ShellInner({ children, userName }: Readonly<{ children: React.ReactNode; userName: string }>) {
  const app = useApp()
  const pathname = usePathname()
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const showFinancialControls = pathname !== "/assistente" && pathname !== "/configuracoes"

  function toggleSidebar() {
    setCollapsed(value => !value)
  }

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
      {mobileMenuOpen && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-zinc-800 bg-zinc-900 transition-all duration-200 lg:translate-x-0 ${
        collapsed ? "lg:w-20" : "lg:w-64"
      } ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-20 items-center border-b border-zinc-800 px-4">
          <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
            <div className="rounded-xl bg-cyan-500/15 p-2 text-cyan-400"><WalletCards className="h-5 w-5" /></div>
            <div className={collapsed ? "lg:hidden" : "min-w-0"}>
              <p className="truncate font-semibold text-white">Gestor Financeiro</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={toggleSidebar}
            className="hidden rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white lg:block"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {TABS.map(tab => {
            const active = pathname === tab.href
            const Icon = tab.icon
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setMobileMenuOpen(false)}
                title={collapsed ? tab.label : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-all ${
                  active
                    ? "bg-cyan-500/15 text-cyan-300"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                } ${collapsed ? "lg:justify-center lg:px-2" : ""}`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className={collapsed ? "lg:hidden" : ""}>{tab.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-zinc-800 p-3">
          <div className={`flex items-center gap-3 rounded-xl px-3 py-2 ${collapsed ? "lg:justify-center lg:px-2" : ""}`}>
            <div className="min-w-0 flex-1 text-sm">
              <p className={collapsed ? "lg:hidden" : "truncate text-zinc-200"}>{userName}</p>
            </div>
            <button type="button" onClick={logout} title="Sair" className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className={`min-h-screen transition-[margin] duration-200 ${collapsed ? "lg:ml-20" : "lg:ml-64"}`}>
        <div className="flex h-16 items-center border-b border-zinc-900 px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="ml-3 font-semibold">Gestor Financeiro</p>
        </div>

        <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-10">
          <header>
            <h1 className="text-3xl font-bold tracking-tight text-white">Gestor Financeiro</h1>
            <p className="mt-1 text-zinc-500">Controle seus gastos e distribua o que sobra de forma inteligente</p>
          </header>

          {showFinancialControls && <>
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
          </>}

          {children}
        </div>
      </main>

      {showFinancialControls && <button
        onClick={() => setAdding(true)}
        aria-label="Adicionar lançamento"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-semibold rounded-full pl-4 pr-5 py-3 shadow-lg shadow-cyan-500/20 transition-all"
      >
        <Plus className="w-5 h-5" />
        Adicionar
      </button>}

      {adding && <AddEntryModal onClose={() => setAdding(false)} />}
    </div>
  )
}

export function AppShell({ children, userName }: Readonly<{ children: React.ReactNode; userName: string }>) {
  return (
    <AppDataProvider>
      <ShellInner userName={userName}>{children}</ShellInner>
    </AppDataProvider>
  )
}
