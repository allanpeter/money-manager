import assert from "node:assert/strict"
import test, { beforeEach } from "node:test"
import { databaseStorageAdapter } from "./storage"
import type { MultiWalletStore } from "./types"

const store = { schemaVersion: 6, wallets: [], activeWalletId: "w", activeMonthId: "2026-09" } as unknown as MultiWalletStore

let items: Record<string, string> = {}
let requests: Array<{ method: string; body: unknown }> = []

function fakeStorage() {
  return {
    getItem: (key: string) => items[key] ?? null,
    setItem: (key: string, value: string) => { items[key] = value },
    removeItem: (key: string) => { delete items[key] },
  }
}

/** Responde o GET com o dono informado e registra as escritas. */
function stubFetch(response: { data: unknown; workspaceId: string } | null) {
  globalThis.fetch = (async (_url: string, init?: { method?: string; body?: string }) => {
    requests.push({ method: init?.method ?? "GET", body: init?.body ? JSON.parse(init.body) : null })
    if (!response) return { ok: false, json: async () => ({}) }
    if (init?.method === "PUT") return { ok: true, json: async () => ({ ok: true }) }
    return { ok: true, json: async () => response }
  }) as unknown as typeof fetch
}

beforeEach(() => {
  items = {}
  requests = []
  ;(globalThis as { window?: unknown }).window = {}
  ;(globalThis as { localStorage?: unknown }).localStorage = fakeStorage()
})

test("retorna os dados da própria conta", async () => {
  stubFetch({ data: store, workspaceId: "workspace-a" })
  assert.deepEqual(await databaseStorageAdapter.load(), store)
})

test("não entrega o cache do navegador para outra conta", async () => {
  items["money-manager-cache-owner"] = "workspace-a"
  items["money-manager-store"] = JSON.stringify(store)
  stubFetch({ data: null, workspaceId: "workspace-b" })

  assert.equal(await databaseStorageAdapter.load(), null)
  assert.equal(requests.filter(request => request.method === "PUT").length, 0)
  assert.equal(items["money-manager-cache-owner"], "workspace-a")
})

test("adota o blob anterior ao login uma única vez", async () => {
  items["money-manager-store"] = JSON.stringify(store)
  stubFetch({ data: null, workspaceId: "workspace-a" })

  assert.deepEqual(await databaseStorageAdapter.load(), store)
  assert.equal(requests.filter(request => request.method === "PUT").length, 1)
  assert.equal(items["money-manager-cache-owner"], "workspace-a")
})

test("conta nova sem blob não recebe nada e reivindica o navegador", async () => {
  stubFetch({ data: null, workspaceId: "workspace-a" })

  assert.equal(await databaseStorageAdapter.load(), null)
  assert.equal(items["money-manager-cache-owner"], "workspace-a")
})

test("falha de rede rejeita em vez de fingir conta vazia", async () => {
  stubFetch(null)
  await assert.rejects(() => databaseStorageAdapter.load())
})
