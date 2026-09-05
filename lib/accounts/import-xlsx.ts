import { createHash } from "node:crypto"
import ExcelJS from "exceljs"
import { centsFromDecimal } from "./domain"
import type { OccurrenceDeclaration } from "./types"

export interface ImportIssueDraft { sheet: string; cell: string; rawValue: string | null; reason: string }
export interface ImportedAccountDraft {
  name: string
  accountType: "regular" | "credit_card"
  nature: "fixed" | "variable"
  plannedAmountCents: number
  occurrences: { referenceMonth: string; expectedAmountCents: number; declaration: OccurrenceDeclaration; legacyPaymentDateMissing: boolean }[]
}
export interface ImportParseResult { checksum: string; accounts: ImportedAccountDraft[]; issues: ImportIssueDraft[] }

const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]
const colors: Record<string, OccurrenceDeclaration> = { FFFF0000: "paid", FF00FF00: "no_charge", FF000000: null }

function rawCellValue(cell: ExcelJS.Cell): unknown {
  const value = cell.value
  if (value && typeof value === "object" && "result" in value) return value.result
  return value
}

function parseMoney(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return centsFromDecimal(value)
  if (typeof value !== "string") return null
  const normalized = value.trim()
  if (!normalized || normalized.includes("+")) return null
  const number = Number(normalized.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(number) ? centsFromDecimal(number) : null
}

function fontColor(cell: ExcelJS.Cell): string {
  return cell.font?.color?.argb?.toUpperCase() ?? "FF000000"
}

export async function parseOfficialWorkbook(buffer: Buffer, year: number): Promise<ImportParseResult> {
  const workbook = new ExcelJS.Workbook()
  // ExcelJS still declares the pre-Node-20 Buffer shape.
  await workbook.xlsx.load(buffer as never)
  const sheet = workbook.getWorksheet("Oficial")
  if (!sheet) throw new Error('A aba "Oficial" não foi encontrada.')
  const issues: ImportIssueDraft[] = []
  const accounts: ImportedAccountDraft[] = []
  let reachedTotal = false

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || reachedTotal) return
    const nameValue = rawCellValue(row.getCell(1))
    const name = typeof nameValue === "string" ? nameValue.trim() : ""
    if (name.toLocaleLowerCase("pt-BR").startsWith("total")) { reachedTotal = true; return }
    if (!name) return
    const occurrences: ImportedAccountDraft["occurrences"] = []
    const values: number[] = []
    for (let column = 2; column <= 13; column++) {
      const cell = row.getCell(column)
      const raw = rawCellValue(cell)
      if (raw == null || raw === "") continue
      const amount = parseMoney(raw)
      const referenceMonth = `${year}-${MONTHS[column - 2]}`
      if (amount == null) {
        issues.push({ sheet: "Oficial", cell: cell.address, rawValue: String(raw), reason: String(raw).includes("+") ? "Valor composto; revisão manual necessária." : "Valor não reconhecido." })
        continue
      }
      if (amount === 0) {
        issues.push({ sheet: "Oficial", cell: cell.address, rawValue: String(raw), reason: "Valor zero; confirme se era ausência de cobrança." })
        continue
      }
      const color = fontColor(cell)
      if (!(color in colors)) {
        issues.push({ sheet: "Oficial", cell: cell.address, rawValue: String(raw), reason: `Cor de fonte ${color} não reconhecida.` })
        continue
      }
      const declaration = colors[color]
      values.push(amount)
      occurrences.push({ referenceMonth, expectedAmountCents: amount, declaration, legacyPaymentDateMissing: declaration === "paid" })
    }
    if (!occurrences.length) return
    const distinct = new Set(values)
    accounts.push({
      name,
      accountType: /cart[aã]o/i.test(name) ? "credit_card" : "regular",
      nature: distinct.size <= 1 ? "fixed" : "variable",
      plannedAmountCents: values.at(-1) ?? 0,
      occurrences,
    })
  })

  return { checksum: createHash("sha256").update(buffer).digest("hex"), accounts, issues }
}
