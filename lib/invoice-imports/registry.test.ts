import assert from "node:assert/strict"
import test from "node:test"
import { parseInvoiceDocument } from "./registry"

const c6Csv = `Data de Compra;Nome no Cartão;Final do Cartão;Categoria;Descrição;Parcela;Valor (em US$);Cotação (em R$);Valor (em R$)
02/09/2026;TITULAR;3095;Lazer;Teste;Única;0;0;10.00
`

test("registro reconhece o CSV C6 e preserva seu preview", () => {
  const result = parseInvoiceDocument({ filename: "Fatura_2026-09-15.csv", bytes: Buffer.from(c6Csv) })
  assert.equal(result.source, "c6")
  assert.equal(result.parsed.entries[0]?.cardLastFour, "3095")
})

test("registro rejeita CSV de banco ainda não cadastrado", () => {
  assert.throws(
    () => parseInvoiceDocument({ filename: "nubank.csv", bytes: Buffer.from("data,valor\n01/09/2026,10") }),
    /Arquivo não reconhecido/,
  )
})
