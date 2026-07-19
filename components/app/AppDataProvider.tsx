"use client"
import { createContext, useContext } from "react"
import { useAppData } from "@/lib/useAppData"

type AppContext = ReturnType<typeof useAppData>

const Ctx = createContext<AppContext | null>(null)

/** Instantiates the app store once and shares it across the dashboard and lançamentos tabs. */
export function AppDataProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const app = useAppData()
  return <Ctx.Provider value={app}>{children}</Ctx.Provider>
}

export function useApp(): AppContext {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useApp deve ser usado dentro de <AppDataProvider>")
  return ctx
}
