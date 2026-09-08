import assert from "node:assert/strict"
import test from "node:test"
import { archiveCardMessage, creditCardInvoicesForMonth, firstInvoiceMonth, invoiceAsBill, invoiceBreakdown, splitPurchase } from "./credit-cards"
import type { CreditCard, CreditCardPurchase, Wallet } from "./types"

const card: CreditCard = { id: "card", name: "Nubank", color: "#000", closingDay: 25, dueDay: 5 }
const purchase: CreditCardPurchase = { id: "purchase", creditCardId: "card", name: "Mercado Livre", amount: 300, purchasedOn: "2026-08-20", installments: 3 }
const wallet = { id: "wallet", name: "Pessoal", months: [], recurringExpenses: [], recurringIncomes: [], creditCards: [card], creditCardPurchases: [purchase] } as Wallet

test("compra antes do fechamento entra na fatura seguinte", () => {
  assert.equal(firstInvoiceMonth(purchase, card), "2026-09")
})

test("compra após o fechamento entra na fatura posterior", () => {
  assert.equal(firstInvoiceMonth({ ...purchase, purchasedOn: "2026-08-26" }, card), "2026-10")
})

test("considera o vencimento no mesmo mês do fechamento, inclusive na virada do ano", () => {
  const sameMonthCard = { ...card, closingDay: 9, dueDay: 15 }
  for (const [purchasedOn, expected] of [
    ["2026-08-08", "2026-08"],
    ["2026-08-09", "2026-08"],
    ["2026-08-10", "2026-09"],
    ["2026-08-29", "2026-09"],
    ["2026-12-29", "2027-01"],
  ]) {
    assert.equal(firstInvoiceMonth({ ...purchase, purchasedOn }, sameMonthCard), expected)
  }
})

test("Playstation de 29/08 em 1x entra somente em setembro com fechamento 9 e vencimento 15", () => {
  for (const installments of [undefined, 1]) {
    const singleWallet = {
      ...wallet,
      creditCards: [{ ...card, closingDay: 9, dueDay: 15 }],
      creditCardPurchases: [{ ...purchase, name: "Playstation", purchasedOn: "2026-08-29", amount: 277.56, installments }],
    }
    assert.deepEqual(creditCardInvoicesForMonth(singleWallet, "2026-08"), [])
    const [invoice] = creditCardInvoicesForMonth(singleWallet, "2026-09")
    assert.equal(invoice.amount, 277.56)
    assert.equal(invoice.items[0].installment, 1)
    assert.deepEqual(creditCardInvoicesForMonth(singleWallet, "2026-10"), [])
  }
})

test("compra de 29/08 em 6x começa em setembro com fechamento 9 e vencimento 15", () => {
  const installmentWallet = {
    ...wallet,
    creditCards: [{ ...card, closingDay: 9, dueDay: 15 }],
    creditCardPurchases: [{ ...purchase, purchasedOn: "2026-08-29", amount: 3241.2, installments: 6 }],
  }
  for (const [index, month] of ["2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02"].entries()) {
    const [invoice] = creditCardInvoicesForMonth(installmentWallet, month)
    assert.equal(invoice.amount, 540.2)
    assert.equal(invoice.items[0].installment, index + 1)
  }
  assert.deepEqual(creditCardInvoicesForMonth(installmentWallet, "2027-03"), [])
})

test("distribui compras parceladas pelas faturas sem perder centavos", () => {
  const invoices = ["2026-09", "2026-10", "2026-11"].map(month => creditCardInvoicesForMonth(wallet, month)[0])
  assert.deepEqual(invoices.map(invoice => invoice.amount), [100, 100, 100])
})

test("distribui os centavos restantes na primeira parcela", () => {
  const centPurchase = { ...purchase, amount: 100, installments: 3 }
  const centWallet = { ...wallet, creditCardPurchases: [centPurchase] }
  const invoices = ["2026-09", "2026-10", "2026-11"].map(month => creditCardInvoicesForMonth(centWallet, month)[0])
  assert.deepEqual(invoices.map(invoice => invoice.amount), [33.34, 33.33, 33.33])
})

test("mantém uma compra recorrente em todas as faturas enquanto estiver ativa", () => {
  const recurringPurchase = { ...purchase, installments: undefined, recurring: true, active: true }
  const recurringWallet = { ...wallet, creditCardPurchases: [recurringPurchase] }
  const invoices = ["2026-09", "2026-10", "2027-03"].map(month => creditCardInvoicesForMonth(recurringWallet, month)[0])
  assert.deepEqual(invoices.map(invoice => invoice.amount), [300, 300, 300])
  assert.equal(creditCardInvoicesForMonth({ ...recurringWallet, creditCardPurchases: [{ ...recurringPurchase, active: false }] }, "2026-10").length, 0)
})

test("a confirmação de arquivamento avisa sobre as compras recorrentes ativas", () => {
  const recurringPurchase = { ...purchase, id: "rec", installments: undefined, recurring: true, active: true }
  const message = archiveCardMessage({ ...card, lastFour: "0102" }, [purchase, recurringPurchase])
  assert.match(message, /Arquivar Nubank •••• 0102\?/)
  assert.match(message, /1 compra recorrente continuará entrando na fatura todo mês/)
  assert.match(message, /parcelas em andamento/)
})

test("a confirmação de arquivamento omite o aviso quando não há recorrente ativa", () => {
  const message = archiveCardMessage(card, [purchase, { ...purchase, id: "off", recurring: true, active: false }])
  assert.doesNotMatch(message, /recorrente/)
})

test("a fatura vira uma conta da revisão de pagamentos, com vencimento do cartão", () => {
  const [invoice] = creditCardInvoicesForMonth(wallet, "2026-09")
  const bill = invoiceAsBill(invoice)
  assert.equal(bill.id, "card:card")
  assert.equal(bill.name, "Fatura Nubank")
  assert.equal(bill.amount, 100)
  assert.equal(bill.dueDay, 5)
  assert.equal(bill.startMonth, "2026-09")
})

test("aceita o valor como total dividido ou como valor de cada parcela", () => {
  assert.deepEqual(splitPurchase(300, 3, "total"), { total: 300, count: 3, first: 100, rest: 100 })
  assert.deepEqual(splitPurchase(100, 3, "installment"), { total: 300, count: 3, first: 100, rest: 100 })
})

test("mostra a sobra de centavos na primeira parcela ao dividir o total", () => {
  assert.deepEqual(splitPurchase(100, 3, "total"), { total: 100, count: 3, first: 33.34, rest: 33.33 })
})

test("valor por parcela não cria sobra de centavos", () => {
  const split = splitPurchase(33.33, 3, "installment")
  assert.equal(split.total, 99.99)
  assert.equal(split.first, split.rest)
})

test("a fatura detalha cada compra sem virar itens pagáveis separados", () => {
  const recurringPurchase: CreditCardPurchase = { id: "rec", creditCardId: "card", name: "Spotify", amount: 21.9, purchasedOn: "2026-08-10", recurring: true, active: true }
  const detailWallet = { ...wallet, creditCardPurchases: [purchase, recurringPurchase] }
  const detail = invoiceBreakdown(creditCardInvoicesForMonth(detailWallet, "2026-10")[0])
  assert.equal(detail.summary, "2 compras na fatura")
  assert.deepEqual(detail.lines, [
    { id: "purchase", name: "Mercado Livre", amount: 100, hint: "parcela 2/3" },
    { id: "rec", name: "Spotify", amount: 21.9, hint: "recorrente" },
  ])
})

test("compra à vista aparece na fatura sem rótulo de parcela", () => {
  const single = { ...purchase, installments: undefined }
  const detail = invoiceBreakdown(creditCardInvoicesForMonth({ ...wallet, creditCardPurchases: [single] }, "2026-09")[0])
  assert.deepEqual(detail.lines, [{ id: "purchase", name: "Mercado Livre", amount: 300, hint: undefined }])
  assert.equal(detail.summary, "1 compra na fatura")
})
