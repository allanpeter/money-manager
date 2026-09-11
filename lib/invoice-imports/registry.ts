import { parseC6InvoiceCsv, type C6InvoiceParseResult } from "@/lib/accounts/import-c6-invoice"

export interface InvoiceDocumentInput {
  filename: string
  bytes: Buffer
}

export interface C6InvoiceDocument {
  source: "c6"
  format: "csv"
  filename: string
  parsed: C6InvoiceParseResult
}

export type ParsedInvoiceDocument = C6InvoiceDocument

interface InvoiceDocumentImporter {
  id: string
  supports(input: InvoiceDocumentInput): boolean
  parse(input: InvoiceDocumentInput): ParsedInvoiceDocument
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function hasC6Headers(bytes: Buffer) {
  const header = new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? ""
  const columns = new Set(header.split(";").map(normalize))
  return ["data de compra", "final do cartao", "categoria", "descricao", "parcela", "valor (em r$)"].every(column => columns.has(column))
}

const importers: readonly InvoiceDocumentImporter[] = [{
  id: "c6_invoice_csv",
  supports: input => input.filename.toLocaleLowerCase("pt-BR").endsWith(".csv") && hasC6Headers(input.bytes),
  parse: input => ({ source: "c6", format: "csv", filename: input.filename, parsed: parseC6InvoiceCsv(input.bytes) }),
}]

/** Detects a document adapter. New banks and formats register another adapter here. */
export function parseInvoiceDocument(input: InvoiceDocumentInput): ParsedInvoiceDocument {
  const importer = importers.find(candidate => candidate.supports(input))
  if (!importer) throw new Error("Arquivo não reconhecido. Atualmente aceito somente CSV de fatura exportado pelo C6.")
  return importer.parse(input)
}
