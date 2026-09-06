/**
 * Whether an unsettled recurring bill is past its due date.
 * The due date is capped to the last day of shorter months (e.g. day 31 in February).
 */
export function isRecurringPaymentOverdue(
  monthId: string,
  dueDay: number | undefined,
  settled: boolean,
  today: Date = new Date(),
): boolean {
  if (settled || !dueDay) return false

  const [year, month] = monthId.split("-").map(Number)
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return false

  const lastDay = new Date(year, month, 0).getDate()
  const dueDate = new Date(year, month - 1, Math.min(Math.max(dueDay, 1), lastDay))
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return dueDate < startOfToday
}
