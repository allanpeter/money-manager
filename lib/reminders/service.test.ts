import assert from "node:assert/strict"
import test from "node:test"
import { formatUpcoming } from "./service"

test("formata lembretes com conta, carteira, valor e vencimento", () => {
  const text = formatUpcoming([{
    occurrenceId: "occurrence",
    profileName: "Pessoa Física",
    accountName: "Energia",
    walletName: "Pessoal",
    amountCents: 12345,
    dueDate: "2026-08-30",
    daysUntilDue: 4,
  }])
  assert.match(text, /Energia/)
  assert.match(text, /Pessoal/)
  assert.match(text, /123,45/)
  assert.match(text, /30\/08\/2026/)
})

test("informa quando não há vencimentos", () => {
  assert.match(formatUpcoming([]), /Não há contas/)
})
