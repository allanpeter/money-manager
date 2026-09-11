import assert from "node:assert/strict"
import test from "node:test"
import { parseC6InvoiceCsv } from "@/lib/accounts/import-c6-invoice"
import { SKIP_CARD, applyInvoiceToStore, listStoreCards, matchCardByLastFour } from "./apply-to-store"
import type { MultiWalletStore } from "@/lib/types"

const CSV = [
  "Data de Compra;Nome no Cartão;Final do Cartão;Categoria;Descrição;Parcela;Valor (em US$);Cotação (em R$);Valor (em R$)",
  "19/07/2026;ALLAN PIMENTEL;6731;Casa / Escritório Mobiliário;VINDI       *DECOVIE;2/6;0;0;286.43",
  "09/08/2026;ALLAN PIMENTEL;3205;Serviços Profissionais;DL *ALIEXPRESS BR ALIP;1/6;0;0;540.20",
  "29/08/2026;ALLAN PIMENTEL;3205;Restaurante / Lanchonete / Bar;JAZZ HAMBURGUERIA;Única;0;0;277.56",
  "11/08/2026;ALLAN P A PIMENTEL;3095;-;Pag Fatura Boleto;Única;0;0;-9752.18",
  "02/09/2026;ALLAN P A PIMENTEL;3095;-;Estorno Tarifa;Única;0;0;-98.00",
].join("\n")

function storeWith(cards: { id: string; name: string; lastFour?: string; archived?: boolean }[]): MultiWalletStore {
  return {
    schemaVersion: 6,
    activeWalletId: "w1",
    activeMonthId: "2026-09",
    currency: "BRL",
    locale: "pt-BR",
    wallets: [{
      id: "w1",
      name: "Pessoal",
      color: "#8b5cf6",
      months: [],
      recurringExpenses: [],
      recurringIncomes: [],
      recurringExpensePayments: {},
      creditCardPurchases: [],
      creditCards: cards.map(card => ({ ...card, color: "#8b5cf6", closingDay: 15, dueDay: 25 })),
    }],
  } as unknown as MultiWalletStore
}

const parsed = parseC6InvoiceCsv(Buffer.from(CSV, "utf-8"))

test("o final do CSV casa com os quatro dígitos do cartão cadastrado", () => {
  const cards = listStoreCards(storeWith([
    { id: "inv", name: "C6 Investimentos", lastFour: "6731" },
    { id: "lazer", name: "C6 Lazer", lastFour: "3205" },
  ]))
  assert.equal(matchCardByLastFour(cards, "6731")?.id, "inv")
  assert.equal(matchCardByLastFour(cards, "3205")?.id, "lazer")
  assert.equal(matchCardByLastFour(cards, "3095"), null)
})

test("cartão arquivado não recebe importação", () => {
  const cards = listStoreCards(storeWith([{ id: "velho", name: "C6 Antigo", lastFour: "6731", archived: true }]))
  assert.deepEqual(cards, [])
})

test("linha parcelada vira a compra inteira com o número de parcelas", () => {
  const store = storeWith([{ id: "inv", name: "C6 Investimentos", lastFour: "6731" }])
  const result = applyInvoiceToStore(store, { entries: parsed.entries, mappings: { "6731": "inv" } })
  const purchase = result.store.wallets[0].creditCardPurchases!.find(item => item.name.includes("DECOVIE"))!
  assert.equal(purchase.installments, 6)
  assert.equal(purchase.amount, 1718.58)
  assert.equal(purchase.purchasedOn, "2026-07-19")
})

test("compra à vista mantém o valor e a data da linha", () => {
  const store = storeWith([{ id: "lazer", name: "C6 Lazer", lastFour: "3205" }])
  const result = applyInvoiceToStore(store, { entries: parsed.entries, mappings: { "3205": "lazer" } })
  const purchase = result.store.wallets[0].creditCardPurchases!.find(item => item.name === "JAZZ HAMBURGUERIA")!
  assert.equal(purchase.installments, undefined)
  assert.equal(purchase.amount, 277.56)
  assert.equal(purchase.purchasedOn, "2026-08-29")
})

test("estorno entra como valor negativo e o pagamento da fatura nem chega aqui", () => {
  const store = storeWith([{ id: "anuidade", name: "C6 Titular", lastFour: "3095" }])
  const result = applyInvoiceToStore(store, { entries: parsed.entries, mappings: { "3095": "anuidade" } })
  const purchases = result.store.wallets[0].creditCardPurchases!
  assert.equal(purchases.length, 1)
  assert.equal(purchases[0].name, "Estorno Tarifa")
  assert.equal(purchases[0].amount, -98)
  assert.equal(parsed.paymentCount, 1)
})

test("a mesma parcela em outra fatura não duplica a compra", () => {
  const store = storeWith([{ id: "inv", name: "C6 Investimentos", lastFour: "6731" }])
  const first = applyInvoiceToStore(store, { entries: parsed.entries, mappings: { "6731": "inv" } })
  const nextMonth = parsed.entries.map(entry => entry.cardLastFour === "6731" ? { ...entry, installmentNumber: 3 } : entry)
  const second = applyInvoiceToStore(first.store, { entries: nextMonth, mappings: { "6731": "inv" } })
  assert.equal(second.imported, 0)
  assert.equal(second.duplicates, 1)
  assert.equal(second.store.wallets[0].creditCardPurchases!.length, 1)
})

test("compra já lançada à mão no mesmo dia e valor é pulada", () => {
  const store = storeWith([{ id: "lazer", name: "C6 Lazer", lastFour: "3205" }])
  store.wallets[0].creditCardPurchases = [
    { id: "manual", creditCardId: "lazer", name: "Jazz Hamburgueria", amount: 277.56, purchasedOn: "2026-08-29" },
  ]
  const result = applyInvoiceToStore(store, { entries: parsed.entries, mappings: { "3205": "lazer" } })
  assert.equal(result.duplicates, 1)
  assert.equal(result.store.wallets[0].creditCardPurchases!.filter(item => item.purchasedOn === "2026-08-29").length, 1)
})

test("final marcado como ignorado não grava nada", () => {
  const store = storeWith([{ id: "lazer", name: "C6 Lazer", lastFour: "3205" }])
  const result = applyInvoiceToStore(store, { entries: parsed.entries, mappings: { "3205": "lazer", "3095": SKIP_CARD } })
  // O estorno do 3095 foi ignorado de propósito; o 6731 ficou de fora por não ter cartão.
  assert.equal(result.skipped, 2)
  assert.equal(result.store.wallets[0].creditCardPurchases!.some(item => item.name === "Estorno Tarifa"), false)
  assert.equal(result.store.wallets[0].creditCardPurchases!.every(item => item.creditCardId === "lazer"), true)
})

test("duas corridas iguais no mesmo dia entram as duas", () => {
  const csv = [
    "Data de Compra;Nome no Cartão;Final do Cartão;Categoria;Descrição;Parcela;Valor (em US$);Cotação (em R$);Valor (em R$)",
    "21/08/2026;ALLAN PIMENTEL;5629;Transporte;DL*UBERRIDES;Única;0;0;15.96",
    "21/08/2026;ALLAN PIMENTEL;5629;Transporte;DL*UBERRIDES;Única;0;0;14.95",
  ].join("\n")
  const store = storeWith([{ id: "trans", name: "C6 Transporte", lastFour: "5629" }])
  const entries = parseC6InvoiceCsv(Buffer.from(csv, "utf-8")).entries
  const result = applyInvoiceToStore(store, { entries, mappings: { "5629": "trans" } })
  assert.equal(result.imported, 2)
  assert.equal(result.duplicates, 0)
})

test("finais sem mapeamento ficam de fora em vez de cair em outro cartão", () => {
  const store = storeWith([{ id: "lazer", name: "C6 Lazer", lastFour: "3205" }])
  const result = applyInvoiceToStore(store, { entries: parsed.entries, mappings: { "3205": "lazer" } })
  assert.equal(result.imported, 2)
  assert.equal(result.skipped, 2)
  assert.equal(result.perCard.length, 1)
})
