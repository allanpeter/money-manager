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

/** Blob pré-autenticação, sem dono. Só pode ser adotado uma única vez. */
const OWNER_KEY = "money-manager-cache-owner"

async function fetchStore(): Promise<{ data: unknown | null; workspaceId: string }> {
  const response = await fetch("/api/financial-store", { cache: "no-store" })
  if (!response.ok) throw new Error("Falha ao carregar dados financeiros.")
  const result = await response.json() as { data?: unknown; workspaceId?: string }
  if (typeof result.workspaceId !== "string") throw new Error("Resposta inválida do servidor.")
  return { data: result.data ?? null, workspaceId: result.workspaceId }
}

/**
 * Fonte única e autenticada dos dados financeiros.
 *
 * O localStorage NUNCA é usado como contingência de leitura: o mesmo navegador
 * pode ser usado por mais de uma conta, e servir esse cache a quem não é dono
 * vaza dados de outra pessoa. Ele só existe para adotar, uma única vez, o blob
 * anterior ao login — e apenas se nenhum outro workspace já o reivindicou.
 * Falha de rede vira exceção, jamais "conta vazia", porque uma conta vazia faz
 * o app criar um store novo e sobrescrever os dados reais no servidor.
 */
export const databaseStorageAdapter: StorageAdapter = {
  async load() {
    if (typeof window === "undefined") return null
    const { data, workspaceId } = await fetchStore()
    if (data) return data

    const owner = localStorage.getItem(OWNER_KEY)
    if (owner && owner !== workspaceId) return null
    localStorage.setItem(OWNER_KEY, workspaceId)
    const legacy = await localStorageAdapter.load()
    if (!legacy) return null
    await this.save(legacy as MultiWalletStore)
    return legacy
  },
  async save(store) {
    if (typeof window === "undefined") return
    const response = await fetch("/api/financial-store", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: store }),
    })
    if (!response.ok) throw new Error("Falha ao salvar dados financeiros.")
  },
}
