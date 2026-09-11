import { createHash } from "node:crypto"

export interface C6InvoiceEntry {
  lineNumber: number
  purchasedOn: string
  cardLastFour: string
  category: string
  description: string
  installmentNumber: number | null
  installmentCount: number | null
  amountCents: number
}

export interface C6InvoiceCardSummary {
  lastFour: string
  entryCount: number
  creditCount: number
  totalCents: number
}

export interface C6InvoiceIssue {
  lineNumber: number
  reason: string
}

export interface C6InvoiceParseResult {
  checksum: string
  entries: C6InvoiceEntry[]
  cards: C6InvoiceCardSummary[]
  paymentCount: number
  issues: C6InvoiceIssue[]
}

const REQUIRED_HEADERS = ["Data de Compra", "Final do Cartão", "Categoria", "Descrição", "Parcela", "Valor (em R$)"]

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let value = ""
  let quoted = false

  for (let index = 0; index < line.length; index++) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index++; continue }
      quoted = !quoted
      continue
    }
    if (character === ";" && !quoted) { values.push(value.trim()); value = ""; continue }
    value += character
  }
  if (quoted) throw new Error("Aspas não fechadas.")
  values.push(value.trim())
  return values
}

function parseDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim())
  if (!match) return null
  const [, day, month, year] = match
  const date = new Date(`${year}-${month}-${day}T12:00:00Z`)
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day)) return null
  return `${year}-${month}-${day}`
}

function parseCents(value: string): number | null {
  const raw = value.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "")
  if (!raw) return null
  const lastComma = raw.lastIndexOf(",")
  const lastDot = raw.lastIndexOf(".")
  const decimalSeparator = lastComma > lastDot ? "," : lastDot >= 0 ? "." : null
  const normalized = decimalSeparator
    ? `${raw.slice(0, raw.lastIndexOf(decimalSeparator)).replace(/[.,]/g, "")}.${raw.slice(raw.lastIndexOf(decimalSeparator) + 1)}`
    : raw
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null
  const cents = Math.round(Number(normalized) * 100)
  return Number.isSafeInteger(cents) ? cents : null
}

function parseInstallment(value: string): { number: number | null; count: number | null } | null {
  if (normalize(value) === "unica") return { number: null, count: null }
  const match = /^(\d{1,2})\/(\d{1,2})$/.exec(value.trim())
  if (!match) return null
  const number = Number(match[1])
  const count = Number(match[2])
  if (number < 1 || count < number) return null
  return { number, count }
}

function isInvoicePayment(description: string) {
  const text = normalize(description)
  return /\bpag(?:amento)?\s+(?:da\s+)?fatura\b/.test(text)
}

/** Parses the semicolon-delimited invoice export produced by C6 Bank. */
export function parseC6InvoiceCsv(buffer: Buffer): C6InvoiceParseResult {
  const text = new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "")
  const lines = text.split(/\r?\n/).filter(line => line.trim())
  if (!lines.length) throw new Error("O CSV está vazio.")

  const headers = parseCsvLine(lines[0])
  const headerIndex = new Map(headers.map((header, index) => [normalize(header), index]))
  for (const header of REQUIRED_HEADERS) if (!headerIndex.has(normalize(header))) throw new Error(`CSV do C6 inválido: coluna “${header}” não encontrada.`)

  const valueAt = (row: string[], header: string) => row[headerIndex.get(normalize(header))!] ?? ""
  const entries: C6InvoiceEntry[] = []
  const issues: C6InvoiceIssue[] = []
  let paymentCount = 0

  for (let index = 1; index < lines.length; index++) {
    const lineNumber = index + 1
    try {
      const row = parseCsvLine(lines[index])
      const purchasedOn = parseDate(valueAt(row, "Data de Compra"))
      const cardLastFour = valueAt(row, "Final do Cartão").replace(/\D/g, "")
      const category = valueAt(row, "Categoria").trim()
      const description = valueAt(row, "Descrição").trim()
      const installment = parseInstallment(valueAt(row, "Parcela"))
      const amountCents = parseCents(valueAt(row, "Valor (em R$)"))
      if (!purchasedOn || cardLastFour.length !== 4 || !description || !installment || amountCents == null || amountCents === 0) {
        issues.push({ lineNumber, reason: "Data, cartão, descrição, parcela ou valor inválido." })
        continue
      }
      if (isInvoicePayment(description)) { paymentCount++; continue }
      entries.push({ lineNumber, purchasedOn, cardLastFour, category, description, installmentNumber: installment.number, installmentCount: installment.count, amountCents })
    } catch (error) {
      issues.push({ lineNumber, reason: error instanceof Error ? error.message : "Linha inválida." })
    }
  }

  if (!entries.length && !issues.length) throw new Error("O CSV não possui compras para importar.")
  const grouped = new Map<string, C6InvoiceEntry[]>()
  for (const entry of entries) grouped.set(entry.cardLastFour, [...(grouped.get(entry.cardLastFour) ?? []), entry])
  const cards = [...grouped.entries()].map(([lastFour, cardEntries]) => ({
    lastFour,
    entryCount: cardEntries.length,
    creditCount: cardEntries.filter(entry => entry.amountCents < 0).length,
    totalCents: cardEntries.reduce((total, entry) => total + entry.amountCents, 0),
  })).sort((a, b) => a.lastFour.localeCompare(b.lastFour))

  return { checksum: createHash("sha256").update(buffer).digest("hex"), entries, cards, paymentCount, issues }
}
