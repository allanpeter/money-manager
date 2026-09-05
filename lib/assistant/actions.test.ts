import assert from "node:assert/strict"
import test from "node:test"
import { inferredInvoiceMonth } from "./actions"

test("compra antes do fechamento fica na fatura do mês", () => {
  assert.equal(inferredInvoiceMonth("2026-08-03", 5), "2026-08")
})

test("compra após o fechamento vai para a próxima fatura", () => {
  assert.equal(inferredInvoiceMonth("2026-12-06", 5), "2027-01")
})
