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
