import assert from "node:assert/strict"
import test from "node:test"
import { EMPTY_ACTION } from "./types"
import { isCancellation, isConfirmation, mergeAction } from "./interpreter"

test("reconhece confirmação e cancelamento em português", () => {
  assert.equal(isConfirmation("Sim"), true)
  assert.equal(isConfirmation("pode salvar"), true)
  assert.equal(isCancellation("não"), true)
  assert.equal(isCancellation("Cancela"), true)
})

test("completa uma ação pendente sem perder campos anteriores", () => {
  const previous = { ...EMPTY_ACTION, kind: "record_purchase" as const, amountCents: 12990, description: "Mercado" }
  const next = { ...EMPTY_ACTION, kind: "record_purchase" as const, accountHint: "Nubank" }
  const merged = mergeAction(previous, next)
  assert.equal(merged.amountCents, 12990)
  assert.equal(merged.description, "Mercado")
  assert.equal(merged.accountHint, "Nubank")
})

test("mantém o tipo pendente quando a resposta contém somente um complemento", () => {
  const previous = { ...EMPTY_ACTION, kind: "record_purchase" as const, amountCents: 5000 }
  const next = { ...EMPTY_ACTION, kind: "unknown" as const, description: "Combustível" }
  assert.equal(mergeAction(previous, next).kind, "record_purchase")
})

test("permite uma resposta conversacional sem transformar em operação financeira", () => {
  const next = { ...EMPTY_ACTION, kind: "chat" as const }
  assert.equal(mergeAction(null, next).kind, "chat")
})
