import assert from "node:assert/strict"
import test from "node:test"
import { quickDashboardIntent } from "./quick-intents"

test("consulta o resumo quando a saudação vem junto da pergunta financeira", () => {
  assert.equal(quickDashboardIntent("oi, como estão minhas contas")?.kind, "query_summary")
  assert.equal(quickDashboardIntent("bom dia, como está minha vida financeira?")?.kind, "query_summary")
})

test("não transforma conversa comum em consulta financeira", () => {
  assert.equal(quickDashboardIntent("oi, como você está?") , null)
})
