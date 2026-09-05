import { MultiWalletStore } from "./types"
import { currentMonthId } from "./months"

/**
 * Persistence boundary for the whole app store.
 *
 * `load()` returns the *raw* persisted value (any schema version) or `null` when
 * nothing is stored — domain migration (`migrate()`) lives in `useAppData`, so a
 * future database adapter only has to move bytes, not understand the schema.
 * Both methods are async so a `fetch`/API-backed adapter can drop in without
 * re-plumbing the hook.
 */
export interface StorageAdapter {
  load(): Promise<unknown | null>
  save(store: MultiWalletStore): Promise<void>
}

const STORE_KEY = "money-manager-store"
const LEGACY_KEY = "money-manager-data"

/** Default adapter: browser localStorage. Swap for a DB/API adapter in phase 2. */
export const localStorageAdapter: StorageAdapter = {
  async load() {
    if (typeof window === "undefined") return null
    try {
      const saved = localStorage.getItem(STORE_KEY)
      if (saved) return JSON.parse(saved)
      // Pre-multi-wallet blob: wrap it so migrate() can lift it into a wallet.
      const legacy = localStorage.getItem(LEGACY_KEY)
      if (legacy) return { months: [{ id: currentMonthId(), data: JSON.parse(legacy) }] }
      return null
    } catch {
      return null
    }
  },
  async save(store) {
    if (typeof window === "undefined") return
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store))
    } catch {}
  },
}

/** Fonte principal autenticada. O localStorage é usado apenas para migrar dados
 * já existentes no navegador ou como contingência temporária se a rede cair. */
export const databaseStorageAdapter: StorageAdapter = {
  async load() {
    if (typeof window === "undefined") return null
    try {
      const response = await fetch("/api/financial-store", { cache: "no-store" })
      if (!response.ok) throw new Error("Falha ao carregar dados financeiros.")
      const result = await response.json() as { data?: unknown }
      if (result.data) return result.data

      const legacy = await localStorageAdapter.load()
      if (legacy) await this.save(legacy as MultiWalletStore)
      return legacy
    } catch {
      return localStorageAdapter.load()
    }
  },
  async save(store) {
    if (typeof window === "undefined") return
    try {
      const response = await fetch("/api/financial-store", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: store }),
      })
      if (!response.ok) throw new Error("Falha ao salvar dados financeiros.")
    } catch {
      await localStorageAdapter.save(store)
    }
  },
}
