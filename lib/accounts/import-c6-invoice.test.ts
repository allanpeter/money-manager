import assert from "node:assert/strict"
import test from "node:test"
import { parseC6InvoiceCsv } from "./import-c6-invoice"

const csv = `Data de Compra;Nome no Cartão;Final do Cartão;Categoria;Descrição;Parcela;Valor (em US$);Cotação (em R$);Valor (em R$)
26/10/2025;TITULAR;1857;Associação;CIDADE NOVA;11/12;0;0;149.90
11/08/2026;TITULAR;3095;-;Pag Fatura Boleto;Única;0;0;-9752.18
02/09/2026;TITULAR;3095;-;Estorno Tarifa;Única;0;0;-98.00
02/09/2026;TITULAR;3095;-;Anuidade Diferenciada;2/12;0;0;98.00
`

test("parser C6 separa pagamento de fatura e preserva créditos", () => {
  const result = parseC6InvoiceCsv(Buffer.from(csv))
  assert.equal(result.paymentCount, 1)
  assert.equal(result.entries.length, 3)
  assert.equal(result.entries.find(entry => entry.description === "Estorno Tarifa")?.amountCents, -9800)
  assert.deepEqual(result.cards, [
    { lastFour: "1857", entryCount: 1, creditCount: 0, totalCents: 14990 },
    { lastFour: "3095", entryCount: 2, creditCount: 1, totalCents: 0 },
  ])
})

test("parser C6 reporta dados obrigatórios inválidos sem importar a linha", () => {
  const result = parseC6InvoiceCsv(Buffer.from(`${csv}invalida;linha\n`))
  assert.equal(result.entries.length, 3)
  assert.deepEqual(result.issues, [{ lineNumber: 6, reason: "Data, cartão, descrição, parcela ou valor inválido." }])
})
