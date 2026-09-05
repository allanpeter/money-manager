import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm"
import { materializeYear } from "@/lib/accounts/service"
import { dateId, dueDate } from "@/lib/accounts/domain"
import { withWorkspace } from "@/lib/db"
import { accountOccurrences, accounts, appSettings, financialProfiles, notificationDeliveries, wallets } from "@/lib/db/schema"

export interface UpcomingOccurrence {
  occurrenceId: string
  profileName: string
  accountName: string
  walletName: string
  amountCents: number
  dueDate: string
  daysUntilDue: number
}

const DAY_MS = 86_400_000

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
}

export async function getUpcomingOccurrences(workspaceId: string, today = dateId(new Date()), horizonDays = 31): Promise<UpcomingOccurrence[]> {
  const year = Number(today.slice(0, 4))
  await materializeYear(workspaceId, year)
  if (today.slice(5, 7) === "12" || horizonDays > 31) await materializeYear(workspaceId, year + 1)

  const rows = await withWorkspace(workspaceId, database => database.select({
    occurrenceId: accountOccurrences.id,
    referenceMonth: accountOccurrences.referenceMonth,
    amountCents: accountOccurrences.expectedAmountCents,
    accountName: accounts.name,
    profileName: financialProfiles.name,
    walletName: wallets.name,
    dueDay: accounts.dueDay,
  }).from(accountOccurrences)
    .innerJoin(accounts, eq(accountOccurrences.accountId, accounts.id))
    .innerJoin(wallets, eq(accounts.walletId, wallets.id))
    .innerJoin(financialProfiles, eq(accounts.profileId, financialProfiles.id))
    .where(and(
      eq(accountOccurrences.workspaceId, workspaceId),
      isNull(accountOccurrences.declaration),
      isNull(accounts.archivedAt),
      gte(accountOccurrences.referenceMonth, `${today.slice(0, 7)}-01`),
      lte(accountOccurrences.referenceMonth, `${year + 1}-12-01`),
    ))
    .orderBy(asc(accountOccurrences.referenceMonth), asc(accounts.name)))

  return rows.flatMap(row => {
    const deadline = dueDate(String(row.referenceMonth).slice(0, 7), row.dueDay)
    if (!deadline) return []
    const daysUntilDue = daysBetween(today, deadline)
    if (daysUntilDue < 0 || daysUntilDue > horizonDays) return []
    return [{
      occurrenceId: row.occurrenceId,
      profileName: row.profileName,
      accountName: row.accountName,
      walletName: row.walletName,
      amountCents: row.amountCents,
      dueDate: deadline,
      daysUntilDue,
    }]
  })
}

export async function getReminderCandidates(workspaceId: string, today = dateId(new Date())) {
  const [settings] = await withWorkspace(workspaceId, database => database.select().from(appSettings).where(eq(appSettings.workspaceId, workspaceId)).limit(1))
  const reminderDays = settings?.reminderDaysBefore ?? [7, 1, 0]
  const horizon = Math.max(...reminderDays, 0)
  const upcoming = await getUpcomingOccurrences(workspaceId, today, horizon)
  return upcoming.filter(item => reminderDays.includes(item.daysUntilDue))
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`))
}

export function formatUpcoming(items: UpcomingOccurrence[]) {
  if (!items.length) return "Não há contas vencendo nos próximos 31 dias."
  const lines = items.map(item => `• ${item.accountName} (${item.profileName} · ${item.walletName}) — ${formatCurrency(item.amountCents)} em ${formatDate(item.dueDate)}`)
  return [`Contas a vencer:`, ...lines].join("\n")
}

export async function dispatchDueReminders(input: {
  workspaceId: string
  channel: string
  send: (message: string) => Promise<void>
  today?: string
}) {
  const today = input.today ?? dateId(new Date())
  const candidates = await getReminderCandidates(input.workspaceId, today)
  if (!candidates.length) return 0

  const reservations: Array<{ reservation: typeof notificationDeliveries.$inferSelect; candidate: UpcomingOccurrence }> = []
  for (const candidate of candidates) {
    const rule = candidate.daysUntilDue === 0 ? "due_today" : `due_in_${candidate.daysUntilDue}`
    const [reservation] = await withWorkspace(input.workspaceId, database => database.insert(notificationDeliveries).values({
      workspaceId: input.workspaceId,
      occurrenceId: candidate.occurrenceId,
      channel: input.channel,
      rule,
      sentForDate: today,
      result: "pending",
    }).onConflictDoNothing().returning())
    if (reservation) reservations.push({ reservation, candidate })
  }

  if (!reservations.length) return 0

  try {
    await input.send(formatUpcoming(reservations.map(item => item.candidate)))
    await withWorkspace(input.workspaceId, database => database.update(notificationDeliveries)
      .set({ result: "sent", sentAt: new Date() })
      .where(inArray(notificationDeliveries.id, reservations.map(item => item.reservation.id))))
    return reservations.length
  } catch (error) {
    await withWorkspace(input.workspaceId, database => database.delete(notificationDeliveries)
      .where(inArray(notificationDeliveries.id, reservations.map(item => item.reservation.id))))
    throw error
  }
}
