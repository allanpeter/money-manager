import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm"
import { withWorkspace, type Database } from "@/lib/db"
import { accountCategories, accountOccurrences, accounts, financialProfiles, invoiceItems, wallets } from "@/lib/db/schema"
import { ensureFinancialProfileDefaults } from "@/lib/financial-profiles/service"
import { averageLastThree, dateId, occurrenceApplies } from "./domain"
import type { AccountNature, AccountType, AccountsGrid, OccurrenceDeclaration } from "./types"

const monthStart = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}-01`
const toMonthId = (value: string | Date) => String(value).slice(0, 7)

export interface CreateAccountInput {
  profileId: string
  name: string
  walletId: string
  categoryId: string
  dueDay: number | null
  closingDay: number | null
  plannedAmountCents: number
  nature: AccountNature
  accountType: AccountType
  startMonth: string
  installments: number | null
}

export async function createAccount(workspaceId: string, actorUserId: string, input: CreateAccountInput) {
  return withWorkspace(workspaceId, async database => {
    const [profile, wallet, category] = await Promise.all([
      database.select({ id: financialProfiles.id }).from(financialProfiles).where(and(eq(financialProfiles.id, input.profileId), eq(financialProfiles.workspaceId, workspaceId), isNull(financialProfiles.archivedAt))).limit(1),
      database.select({ id: wallets.id }).from(wallets).where(and(eq(wallets.id, input.walletId), eq(wallets.workspaceId, workspaceId), eq(wallets.profileId, input.profileId))).limit(1),
      database.select({ id: accountCategories.id }).from(accountCategories).where(and(eq(accountCategories.id, input.categoryId), eq(accountCategories.workspaceId, workspaceId), eq(accountCategories.profileId, input.profileId))).limit(1),
    ])
    if (!profile.length || !wallet.length || !category.length) throw new Error("Perfil, carteira ou categoria não pertence ao usuário.")
    const [account] = await database.insert(accounts).values({
    workspaceId, profileId: input.profileId, createdByUserId: actorUserId,
    name: input.name.trim(), walletId: input.walletId, categoryId: input.categoryId,
    dueDay: input.dueDay, plannedAmountCents: input.plannedAmountCents,
    closingDay: input.closingDay,
    nature: input.nature, accountType: input.accountType,
    startMonth: `${input.startMonth}-01`, installments: input.nature === "installment" ? input.installments : null,
    }).returning()
    return account
  })
}

async function materializeYearIn(database: Database, workspaceId: string, year: number) {
  const accountRows = await database.select().from(accounts).where(and(eq(accounts.workspaceId, workspaceId), isNull(accounts.archivedAt))).orderBy(asc(accounts.sortOrder), asc(accounts.name))
  if (!accountRows.length) return
  const ids = accountRows.map(account => account.id)
  const allOccurrences = await database.select().from(accountOccurrences)
    .where(inArray(accountOccurrences.accountId, ids)).orderBy(asc(accountOccurrences.referenceMonth))
  const known = new Set(allOccurrences.map(row => `${row.accountId}:${String(row.referenceMonth)}`))

  for (const account of accountRows) {
    for (let month = 1; month <= 12; month++) {
      const referenceMonth = monthStart(year, month)
      const id = toMonthId(referenceMonth)
      if (!occurrenceApplies(account.nature, toMonthId(account.startMonth), account.installments, id)) continue
      if (known.has(`${account.id}:${referenceMonth}`)) continue
      const history = allOccurrences
        .filter(row => row.accountId === account.id && String(row.referenceMonth) < referenceMonth)
        .map(row => row.paidAmountCents)
      const forecast = account.nature === "variable" ? averageLastThree(history) : null
      await database.insert(accountOccurrences).values({
        workspaceId,
        accountId: account.id,
        referenceMonth,
        expectedAmountCents: forecast ?? account.plannedAmountCents,
        expectedSource: forecast == null ? "manual" : "auto",
      }).onConflictDoNothing()
    }
  }
}

export async function materializeYear(workspaceId: string, year: number) {
  return withWorkspace(workspaceId, database => materializeYearIn(database, workspaceId, year))
}

export async function loadAccountsGrid(workspaceId: string, year: number, selectedProfileId: string | null = null): Promise<AccountsGrid> {
  return withWorkspace(workspaceId, async database => {
  const profileRows = await database.select({ id: financialProfiles.id, name: financialProfiles.name, type: financialProfiles.type, color: financialProfiles.color })
    .from(financialProfiles).where(and(eq(financialProfiles.workspaceId, workspaceId), isNull(financialProfiles.archivedAt))).orderBy(asc(financialProfiles.createdAt))
  if (selectedProfileId && !profileRows.some(profile => profile.id === selectedProfileId)) throw new Error("Perfil financeiro não encontrado.")
  for (const profile of profileRows) await ensureFinancialProfileDefaults(database, workspaceId, profile.id)
  await materializeYearIn(database, workspaceId, year)
  const rows = await database.select({
    account: accounts, walletName: wallets.name, categoryName: accountCategories.name, profileName: financialProfiles.name,
  }).from(accounts)
    .innerJoin(wallets, eq(accounts.walletId, wallets.id))
    .innerJoin(accountCategories, eq(accounts.categoryId, accountCategories.id))
    .innerJoin(financialProfiles, eq(accounts.profileId, financialProfiles.id))
    .where(and(eq(accounts.workspaceId, workspaceId), isNull(accounts.archivedAt), ...(selectedProfileId ? [eq(accounts.profileId, selectedProfileId)] : [])))
    .orderBy(asc(accountCategories.sortOrder), asc(accounts.sortOrder), asc(accounts.name))
  const ids = rows.map(row => row.account.id)
  const occurrences = ids.length
    ? await database.select().from(accountOccurrences).where(and(
      inArray(accountOccurrences.accountId, ids),
      gte(accountOccurrences.referenceMonth, `${year}-01-01`),
      lte(accountOccurrences.referenceMonth, `${year}-12-01`),
    ))
    : []
  const occurrenceIds = occurrences.map(item => item.id)
  const itemRows = occurrenceIds.length
    ? await database.select().from(invoiceItems).where(inArray(invoiceItems.occurrenceId, occurrenceIds)).orderBy(asc(invoiceItems.sortOrder), asc(invoiceItems.createdAt))
    : []
  const walletRows = await database.select({ id: wallets.id, profileId: wallets.profileId, name: wallets.name }).from(wallets)
    .where(and(eq(wallets.workspaceId, workspaceId), ...(selectedProfileId ? [eq(wallets.profileId, selectedProfileId)] : []))).orderBy(asc(wallets.name))
  const categoryRows = await database.select({ id: accountCategories.id, profileId: accountCategories.profileId, name: accountCategories.name }).from(accountCategories)
    .where(and(eq(accountCategories.workspaceId, workspaceId), isNull(accountCategories.archivedAt), ...(selectedProfileId ? [eq(accountCategories.profileId, selectedProfileId)] : []))).orderBy(asc(accountCategories.sortOrder), asc(accountCategories.name))

  return {
    year, today: dateId(new Date()), selectedProfileId, profiles: profileRows, wallets: walletRows, categories: categoryRows,
    accounts: rows.map(({ account, walletName, categoryName, profileName }) => ({
      id: account.id, profileId: account.profileId, profileName, name: account.name, walletId: account.walletId, walletName,
      categoryId: account.categoryId, categoryName, dueDay: account.dueDay,
      closingDay: account.closingDay,
      plannedAmountCents: account.plannedAmountCents, nature: account.nature,
      accountType: account.accountType, startMonth: toMonthId(account.startMonth), installments: account.installments,
      archivedAt: account.archivedAt?.toISOString() ?? null,
      occurrences: occurrences.filter(item => item.accountId === account.id).map(item => ({
        id: item.id, referenceMonth: toMonthId(item.referenceMonth), expectedAmountCents: item.expectedAmountCents,
        expectedSource: item.expectedSource, declaration: item.declaration,
        paidAmountCents: item.paidAmountCents, paidOn: item.paidOn ? String(item.paidOn) : null,
        legacyPaymentDateMissing: item.legacyPaymentDateMissing,
        invoiceItems: itemRows.filter(invoiceItem => invoiceItem.occurrenceId === item.id).map(invoiceItem => ({
          id: invoiceItem.id,
          description: invoiceItem.description,
          amountCents: invoiceItem.amountCents,
          purchasedOn: String(invoiceItem.purchasedOn),
          source: invoiceItem.source,
        })),
      })),
    })),
  }
  })
}

export async function updateOccurrence(workspaceId: string, actorUserId: string, id: string, input: {
  declaration: OccurrenceDeclaration
  paidAmountCents?: number
  paidOn?: string
  expectedAmountCents?: number
}) {
  return withWorkspace(workspaceId, async database => {
  const values = input.declaration === "paid"
    ? { declaration: "paid" as const, paidAmountCents: input.paidAmountCents!, paidOn: input.paidOn!, legacyPaymentDateMissing: false, resolvedAt: new Date(), expectedAmountCents: input.expectedAmountCents, expectedSource: input.expectedAmountCents == null ? undefined : "manual" as const, updatedByUserId: actorUserId, updatedAt: new Date() }
    : input.declaration === "no_charge"
      ? { declaration: "no_charge" as const, paidAmountCents: null, paidOn: null, legacyPaymentDateMissing: false, resolvedAt: new Date(), expectedAmountCents: input.expectedAmountCents, expectedSource: input.expectedAmountCents == null ? undefined : "manual" as const, updatedByUserId: actorUserId, updatedAt: new Date() }
      : { declaration: null, paidAmountCents: null, paidOn: null, legacyPaymentDateMissing: false, resolvedAt: null, expectedAmountCents: input.expectedAmountCents, expectedSource: input.expectedAmountCents == null ? undefined : "manual" as const, updatedByUserId: actorUserId, updatedAt: new Date() }
  const [updated] = await database.update(accountOccurrences).set(values).where(and(eq(accountOccurrences.id, id), eq(accountOccurrences.workspaceId, workspaceId))).returning()
  return updated
  })
}

export async function updateAccountDueDay(workspaceId: string, id: string, dueDay: number | null) {
  return withWorkspace(workspaceId, async database => {
    const [updated] = await database.update(accounts).set({ dueDay, updatedAt: new Date() }).where(and(eq(accounts.id, id), eq(accounts.workspaceId, workspaceId))).returning()
    return updated
  })
}

export async function updateAccountClosingDay(workspaceId: string, id: string, closingDay: number | null) {
  return withWorkspace(workspaceId, async database => {
    const [updated] = await database.update(accounts).set({ closingDay, updatedAt: new Date() }).where(and(eq(accounts.id, id), eq(accounts.workspaceId, workspaceId))).returning()
    return updated
  })
}
