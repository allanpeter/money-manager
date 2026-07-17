import { DEFAULT_LOCALE } from "./utils"

/** Returns "YYYY-MM" for the current month. */
export function currentMonthId(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

/** Returns true if a string is a valid "YYYY-MM" month id. */
export function isMonthId(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value)
}

/** Localized label for a "YYYY-MM" id, e.g. "junho de 2026". */
export function monthLabel(id: string, locale: string = DEFAULT_LOCALE): string {
  const [year, month] = id.split("-").map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  })
}

/** Shifts a "YYYY-MM" id by `delta` months (can be negative). */
export function shiftMonth(id: string, delta: number): string {
  const [year, month] = id.split("-").map(Number)
  const d = new Date(year, month - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** A window of month ids centered on `centerId`, from `back` months before to `fwd` after. */
export function monthWindow(centerId: string, back = 3, fwd = 3): string[] {
  const ids: string[] = []
  for (let i = -back; i <= fwd; i++) ids.push(shiftMonth(centerId, i))
  return ids
}

/** `count` consecutive month ids starting at `startId` (inclusive). */
export function monthRange(startId: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(startId, i))
}
