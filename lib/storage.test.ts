import assert from "node:assert/strict"
import test, { beforeEach } from "node:test"
import { databaseStorageAdapter, StorageConflictError } from "./storage"
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
function stubFetch(response: { data: unknown; revision: number; workspaceId: string } | null) {
  globalThis.fetch = (async (_url: string, init?: { method?: string; body?: string }) => {
    requests.push({ method: init?.method ?? "GET", body: init?.body ? JSON.parse(init.body) : null })
    if (!response) return { ok: false, json: async () => ({}) }
    if (init?.method === "PUT") return { ok: true, status: 200, json: async () => ({ ok: true, revision: (JSON.parse(init.body ?? "{}").revision ?? 0) + 1 }) }
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
  stubFetch({ data: store, revision: 4, workspaceId: "workspace-a" })
  assert.deepEqual(await databaseStorageAdapter.load(), store)
})

test("não entrega o cache do navegador para outra conta", async () => {
  items["money-manager-cache-owner"] = "workspace-a"
  items["money-manager-store"] = JSON.stringify(store)
  stubFetch({ data: null, revision: 0, workspaceId: "workspace-b" })

  assert.equal(await databaseStorageAdapter.load(), null)
  assert.equal(requests.filter(request => request.method === "PUT").length, 0)
  assert.equal(items["money-manager-cache-owner"], "workspace-a")
})

test("adota o blob anterior ao login uma única vez", async () => {
  items["money-manager-store"] = JSON.stringify(store)
  stubFetch({ data: null, revision: 0, workspaceId: "workspace-a" })

  assert.deepEqual(await databaseStorageAdapter.load(), store)
  assert.equal(requests.filter(request => request.method === "PUT").length, 1)
  assert.equal(items["money-manager-cache-owner"], "workspace-a")
})

test("conta nova sem blob não recebe nada e reivindica o navegador", async () => {
  stubFetch({ data: null, revision: 0, workspaceId: "workspace-a" })

  assert.equal(await databaseStorageAdapter.load(), null)
  assert.equal(items["money-manager-cache-owner"], "workspace-a")
})

test("falha de rede rejeita em vez de fingir conta vazia", async () => {
  stubFetch(null)
  await assert.rejects(() => databaseStorageAdapter.load())
})

test("envia a revisão lida ao salvar", async () => {
  stubFetch({ data: store, revision: 4, workspaceId: "workspace-a" })
  await databaseStorageAdapter.load()
  await databaseStorageAdapter.save(store)

  const write = requests.find(request => request.method === "PUT")
  assert.deepEqual(write?.body, { data: store, revision: 4 })
})

test("recusa uma gravação concorrente sem tentar sobrescrever", async () => {
  globalThis.fetch = (async (_url: string, init?: { method?: string; body?: string }) => {
    requests.push({ method: init?.method ?? "GET", body: init?.body ? JSON.parse(init.body) : null })
    if (init?.method === "PUT") return { ok: false, status: 409, json: async () => ({ error: "Conflito" }) }
    return { ok: true, status: 200, json: async () => ({ data: store, revision: 8, workspaceId: "workspace-a" }) }
  }) as unknown as typeof fetch

  await databaseStorageAdapter.load()
  await assert.rejects(() => databaseStorageAdapter.save(store), StorageConflictError)
  assert.deepEqual(requests.find(request => request.method === "PUT")?.body, { data: store, revision: 8 })
})
