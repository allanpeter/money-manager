import assert from "node:assert/strict"
import test from "node:test"
import { executeDashboardAction, prepareDashboardAction, prepareDashboardActions } from "./actions"
import { createFinancialStore } from "@/lib/financial-api/store"
import { EMPTY_DASHBOARD_ACTION } from "./types"

function context(store = createFinancialStore()) {
  return { wallets: store.wallets.map(wallet => ({ id: wallet.id, name: wallet.name })) }
}

test("sempre pede carteira quando ela não foi informada", () => {
  const store = createFinancialStore()
  const prepared = prepareDashboardAction(context(store), {
    ...EMPTY_DASHBOARD_ACTION,
    kind: "add_expense",
    itemName: "Combustível",
    amountCents: 5000,
  })
  assert.equal(prepared.ready, false)
  assert.match(prepared.prompt, /Em qual carteira/)
})

test("mantém despesas independentes em um lote e exibe confirmação detalhada", () => {
  const store = createFinancialStore()
  const prepared = prepareDashboardActions(context(store), [
    { ...EMPTY_DASHBOARD_ACTION, kind: "add_recurring_expense", walletName: "Pessoal", itemName: "Aluguel", amountCents: 370000, monthId: "2028-07", endMonthId: "2028-07" },
    { ...EMPTY_DASHBOARD_ACTION, kind: "add_recurring_expense", walletName: "Pessoal", itemName: "Condomínio", amountCents: 30000, monthId: "2026-09" },
  ])
  assert.equal(prepared.ready, true)
  assert.equal(prepared.actions.length, 2)
  assert.match(prepared.summary ?? "", /Aluguel/)
  assert.match(prepared.summary ?? "", /Condomínio/)
  assert.match(prepared.summary ?? "", /R\$\s?4\.000,00/)
  assert.match(prepared.summary ?? "", /julho de 2028/)
  assert.deepEqual(prepared.actions.map(action => action.installments), [23, 23])
  assert.deepEqual(prepared.actions.map(action => action.monthId), ["2026-09", "2026-09"])

  const result = prepared.actions.reduce((current, action) => executeDashboardAction(current.store, action), { store, message: "", changed: false })
  assert.equal(result.store.wallets[0].recurringExpenses.length, 2)
  assert.deepEqual(result.store.wallets[0].recurringExpenses.map(item => item.name), ["Aluguel", "Condomínio"])
})

test("prepara e registra despesa na carteira indicada", () => {
  const store = createFinancialStore()
  const prepared = prepareDashboardAction(context(store), {
    ...EMPTY_DASHBOARD_ACTION,
    kind: "add_expense",
    walletName: "Pessoal",
    itemName: "Combustível",
    amountCents: 5000,
    paymentMethod: "credit",
  })
  assert.equal(prepared.ready, true)
  assert.equal(prepared.action.walletId, store.wallets[0].id)
  const executed = executeDashboardAction(store, prepared.action)
  assert.equal(executed.changed, true)
  const expense = executed.store.wallets[0].months[0].data.expenseCategories.at(-1)
  assert.equal(expense?.name, "Combustível")
  assert.equal(expense?.amount, 50)
  assert.equal(expense?.paymentMethod, "credit")
})

test("consulta consolidada soma receitas e recorrências", () => {
  const store = createFinancialStore()
  const monthId = store.activeMonthId
  store.wallets[0].months[0].data.incomeSources.push({ id: "bonus", name: "Bônus", amount: 100 })
  store.wallets[0].recurringExpenses.push({ id: "rent", name: "Aluguel", amount: 40, color: "#000", startMonth: monthId })
  const result = executeDashboardAction(store, { ...EMPTY_DASHBOARD_ACTION, kind: "query_summary", monthId })
  assert.equal(result.changed, false)
  assert.match(result.message, /R\$\s?100,00/)
  assert.match(result.message, /R\$\s?40,00/)
})
