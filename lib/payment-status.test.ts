import assert from "node:assert/strict"
import test from "node:test"
import { isRecurringPaymentOverdue } from "./payment-status"

test("marca como vencida uma conta do mês atual vencida ontem", () => {
  assert.equal(isRecurringPaymentOverdue("2026-09", 5, false, new Date(2026, 8, 6)), true)
})

test("mantém em aberto no próprio dia do vencimento e para contas liquidadas", () => {
  const today = new Date(2026, 8, 5)
  assert.equal(isRecurringPaymentOverdue("2026-09", 5, false, today), false)
  assert.equal(isRecurringPaymentOverdue("2026-09", 4, true, today), false)
})

test("limita o vencimento ao último dia de meses curtos", () => {
  assert.equal(isRecurringPaymentOverdue("2026-02", 31, false, new Date(2026, 2, 1)), true)
})
