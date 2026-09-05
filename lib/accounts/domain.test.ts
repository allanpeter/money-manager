import assert from "node:assert/strict"
import test from "node:test"
import { attentionState, averageLastThree, dueDate, invoiceRemainder, occurrenceApplies } from "./domain"

test("gera meses corretos para parcelamento e avulsa", () => {
  assert.equal(occurrenceApplies("installment", "2026-01", 3, "2026-03"), true)
  assert.equal(occurrenceApplies("installment", "2026-01", 3, "2026-04"), false)
  assert.equal(occurrenceApplies("one_off", "2026-04", null, "2026-04"), true)
  assert.equal(occurrenceApplies("one_off", "2026-04", null, "2026-05"), false)
})

test("dia 31 é limitado ao último dia do mês", () => {
  assert.equal(dueDate("2026-02", 31), "2026-02-28")
  assert.equal(dueDate("2024-02", 31), "2024-02-29")
})

test("atraso é derivado, nunca armazenado", () => {
  const occurrence = { id: "x", referenceMonth: "2026-04", expectedAmountCents: 100, expectedSource: "manual" as const, declaration: null, paidAmountCents: null, paidOn: null, legacyPaymentDateMissing: false, invoiceItems: [] }
  assert.equal(attentionState(occurrence, 10, "2026-04-11", 5), "overdue")
  assert.equal(attentionState(occurrence, 10, "2026-04-08", 5), "due_soon")
})

test("média ignora meses sem cobrança e usa os últimos três realizados", () => {
  assert.equal(averageLastThree([100, null, 200, 400, 1000]), 533)
  assert.equal(averageLastThree([null]), null)
})

test("resto da fatura é derivado", () => {
  assert.equal(invoiceRemainder(10_000, [2_500, 1_250]), 6_250)
})
