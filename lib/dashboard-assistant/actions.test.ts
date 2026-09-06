import assert from "node:assert/strict"
import test from "node:test"
import { executeDashboardAction, prepareDashboardAction, prepareDashboardActions } from "./actions"
import { createFinancialStore } from "@/lib/financial-api/store"
import { billPayment, billsForMonth } from "@/lib/bills"
import { shiftMonth } from "@/lib/months"
import { EMPTY_DASHBOARD_ACTION } from "./types"

/** Mirrors what the gateway exposes to the assistant runtime. */
function context(store = createFinancialStore()) {
  const monthId = store.activeMonthId
  return {
    wallets: store.wallets.map(wallet => ({ id: wallet.id, name: wallet.name })),
    cards: store.wallets.flatMap(wallet => (wallet.creditCards ?? []).filter(card => !card.archived).map(card => ({
      id: card.id,
      name: card.name,
      label: `${card.name}${card.lastFour ? ` •••• ${card.lastFour}` : ""} (${wallet.name})`,
      walletId: wallet.id,
      walletName: wallet.name,
    }))),
    bills: store.wallets.flatMap(wallet => billsForMonth(wallet, monthId).map(bill => ({
      id: bill.id,
      name: bill.name,
      amount: bill.amount,
      walletId: wallet.id,
      walletName: wallet.name,
      monthId,
      settled: Boolean(billPayment(wallet, bill.id, monthId)),
    }))),
  }
}

function storeWithCard() {
  const store = createFinancialStore()
  store.wallets[0].creditCards = [{ id: "nu", name: "Nubank", lastFour: "0102", color: "#8b5cf6", closingDay: 25, dueDay: 5 }]
  return store
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

test("registra compra no cartão informada como parcelas de N reais", () => {
  const store = storeWithCard()
  const prepared = prepareDashboardAction(context(store), {
    ...EMPTY_DASHBOARD_ACTION,
    kind: "add_card_purchase",
    cardName: "Nubank",
    itemName: "Notebook",
    amountCents: 10000,
    installments: 3,
    amountMode: "installment",
    purchasedOn: "2026-09-10",
  })
  assert.equal(prepared.ready, true)
  assert.equal(prepared.action.amountCents, 30000)
  assert.equal(prepared.action.walletId, store.wallets[0].id)
  assert.match(prepared.summary ?? "", /3x de R\$\s?100,00/)
  const executed = executeDashboardAction(store, prepared.action)
  const purchase = executed.store.wallets[0].creditCardPurchases?.at(-1)
  assert.equal(purchase?.amount, 300)
  assert.equal(purchase?.installments, 3)
  assert.equal(purchase?.creditCardId, "nu")
  assert.match(executed.message, /outubro de 2026/)
})

test("compra recorrente no cartão não vira parcelamento", () => {
  const store = storeWithCard()
  const prepared = prepareDashboardAction(context(store), {
    ...EMPTY_DASHBOARD_ACTION,
    kind: "add_card_purchase",
    cardName: "Nubank",
    itemName: "Spotify",
    amountCents: 2190,
    installments: 12,
    recurring: true,
  })
  assert.equal(prepared.action.installments, null)
  assert.match(prepared.summary ?? "", /todo mês/)
  const purchase = executeDashboardAction(store, prepared.action).store.wallets[0].creditCardPurchases?.at(-1)
  assert.equal(purchase?.recurring, true)
  assert.equal(purchase?.active, true)
  assert.equal(purchase?.installments, undefined)
})

test("pergunta o cartão quando o usuário não indica um", () => {
  const store = storeWithCard()
  store.wallets[0].creditCards!.push({ id: "itau", name: "Itaú", color: "#f97316", closingDay: 20, dueDay: 1 })
  const prepared = prepareDashboardAction(context(store), {
    ...EMPTY_DASHBOARD_ACTION, kind: "add_card_purchase", itemName: "Mercado", amountCents: 5000,
  })
  assert.equal(prepared.ready, false)
  assert.match(prepared.prompt, /Em qual cartão/)
})

test("quita a fatura do cartão pelo nome do cartão", () => {
  const store = storeWithCard()
  const monthId = store.activeMonthId
  store.wallets[0].creditCardPurchases = [{ id: "p1", creditCardId: "nu", name: "Mercado", amount: 200, purchasedOn: `${shiftMonth(monthId, -1)}-10` }]
  const prepared = prepareDashboardAction(context(store), { ...EMPTY_DASHBOARD_ACTION, kind: "pay_bill", itemName: "nubank", monthId })
  assert.equal(prepared.ready, true)
  assert.equal(prepared.action.billId, "card:nu")
  assert.match(prepared.summary ?? "", /R\$\s?200,00/)
  const executed = executeDashboardAction(store, prepared.action)
  assert.equal(executed.changed, true)
  assert.deepEqual(executed.store.wallets[0].recurringExpensePayments?.[`card:nu:${monthId}`]?.status, "paid")
  assert.equal(executeDashboardAction(executed.store, prepared.action).changed, false)
})

test("avisa quando a conta a quitar não existe no mês", () => {
  const store = createFinancialStore()
  const prepared = prepareDashboardAction(context(store), { ...EMPTY_DASHBOARD_ACTION, kind: "pay_bill", itemName: "Aluguel" })
  assert.equal(prepared.ready, true)
  const executed = executeDashboardAction(store, prepared.action)
  assert.equal(executed.changed, false)
  assert.match(executed.message, /Não encontrei/)
})

test("o resumo do mês inclui a fatura do cartão nas despesas", () => {
  const store = storeWithCard()
  const monthId = store.activeMonthId
  store.wallets[0].creditCardPurchases = [{ id: "p1", creditCardId: "nu", name: "Mercado", amount: 200, purchasedOn: `${shiftMonth(monthId, -1)}-10` }]
  const result = executeDashboardAction(store, { ...EMPTY_DASHBOARD_ACTION, kind: "query_summary", monthId })
  assert.match(result.message, /Faturas de cartão: Nubank: R\$\s?200,00/)
  assert.match(result.message, /em aberto/)
})

test("query_cards detalha a fatura do mês", () => {
  const store = storeWithCard()
  const monthId = store.activeMonthId
  store.wallets[0].creditCardPurchases = [{ id: "p1", creditCardId: "nu", name: "Mercado", amount: 300, purchasedOn: `${shiftMonth(monthId, -1)}-10`, installments: 3 }]
  const result = executeDashboardAction(store, { ...EMPTY_DASHBOARD_ACTION, kind: "query_cards", monthId })
  assert.match(result.message, /Nubank •••• 0102/)
  assert.match(result.message, /parcela 1\/3/)
  assert.equal(result.changed, false)
})
