import type { AccountNature, AccountOccurrence, AttentionState } from "./types"

export function monthId(date: Date, timeZone = "America/Sao_Paulo"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" })
    .format(date)
    .slice(0, 7)
}

export function dateId(date: Date, timeZone = "America/Sao_Paulo"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date)
  const value = Object.fromEntries(parts.filter(p => p.type !== "literal").map(p => [p.type, p.value]))
  return `${value.year}-${value.month}-${value.day}`
}

export function centsFromDecimal(value: number): number {
  return Math.round(value * 100)
}

export function occurrenceApplies(
  nature: AccountNature,
  startMonth: string,
  installments: number | null,
  referenceMonth: string,
): boolean {
  if (referenceMonth < startMonth) return false
  if (nature === "one_off") return referenceMonth === startMonth
  if (nature !== "installment" || !installments) return true
  const [year, month] = startMonth.split("-").map(Number)
  const end = new Date(Date.UTC(year, month - 1 + installments - 1, 1))
  const endMonth = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}`
  return referenceMonth <= endMonth
}

export function dueDate(referenceMonth: string, dueDay: number | null): string | null {
  if (!dueDay) return null
  const [year, month] = referenceMonth.split("-").map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${referenceMonth}-${String(Math.min(dueDay, lastDay)).padStart(2, "0")}`
}

export function attentionState(occurrence: AccountOccurrence, dueDay: number | null, today: string, dueSoonDays: number): AttentionState {
  if (occurrence.declaration) return "resolved"
  const due = dueDate(occurrence.referenceMonth, dueDay)
  if (!due) return "missing_due_date"
  if (today < due) {
    const days = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
    return days <= dueSoonDays ? "due_soon" : "future"
  }
  if (today === due) return "due_today"
  return "overdue"
}

export function averageLastThree(values: Array<number | null>): number | null {
  const realized = values.filter((value): value is number => value != null).slice(-3)
  if (!realized.length) return null
  return Math.round(realized.reduce((sum, value) => sum + value, 0) / realized.length)
}

export function invoiceRemainder(totalCents: number, itemCents: number[]): number {
  return totalCents - itemCents.reduce((sum, value) => sum + value, 0)
}
