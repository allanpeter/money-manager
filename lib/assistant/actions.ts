import { and, asc, eq, isNull, sql } from "drizzle-orm"
import { dateId } from "@/lib/accounts/domain"
import { materializeYear } from "@/lib/accounts/service"
import { withWorkspace } from "@/lib/db"
import { accountCategories, accountOccurrences, accounts, financialProfiles, invoiceItems, wallets } from "@/lib/db/schema"
import { formatUpcoming, getUpcomingOccurrences } from "@/lib/reminders/service"
import type { AssistantAction, AssistantContext } from "./types"

export interface PreparedAction {
  action: AssistantAction
  ready: boolean
  prompt: string
  summary: string | null
  readOnly: boolean
}

const normalize = (value: string) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim()
const validDate = (value: string | null) => value != null && /^\d{4}-\d{2}-\d{2}$/.test(value)
const validMonth = (value: string | null) => value != null && /^\d{4}-\d{2}$/.test(value)

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100)
}

function addMonth(month: string) {
  const [year, number] = month.split("-").map(Number)
  const result = new Date(Date.UTC(year, number, 1))
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, "0")}`
}

export function inferredInvoiceMonth(purchaseDate: string, closingDay: number) {
  const month = purchaseDate.slice(0, 7)
  return Number(purchaseDate.slice(8, 10)) <= closingDay ? month : addMonth(month)
}

export async function getAssistantContext(workspaceId: string): Promise<AssistantContext> {
  return withWorkspace(workspaceId, async database => {
  const [profileRows, walletRows, categoryRows, accountRows] = await Promise.all([
    database.select({ id: financialProfiles.id, name: financialProfiles.name }).from(financialProfiles)
      .where(and(eq(financialProfiles.workspaceId, workspaceId), isNull(financialProfiles.archivedAt))).orderBy(asc(financialProfiles.name)),
    database.select({ id: wallets.id, profileId: wallets.profileId, name: wallets.name }).from(wallets).where(eq(wallets.workspaceId, workspaceId)).orderBy(asc(wallets.name)),
    database.select({ id: accountCategories.id, profileId: accountCategories.profileId, name: accountCategories.name }).from(accountCategories)
      .where(and(eq(accountCategories.workspaceId, workspaceId), isNull(accountCategories.archivedAt))).orderBy(asc(accountCategories.name)),
    database.select({
      id: accounts.id,
      profileId: accounts.profileId,
      profileName: financialProfiles.name,
      name: accounts.name,
      walletName: wallets.name,
      categoryName: accountCategories.name,
      accountType: accounts.accountType,
      nature: accounts.nature,
      dueDay: accounts.dueDay,
      closingDay: accounts.closingDay,
    }).from(accounts)
      .innerJoin(wallets, eq(accounts.walletId, wallets.id))
      .innerJoin(accountCategories, eq(accounts.categoryId, accountCategories.id))
      .innerJoin(financialProfiles, eq(accounts.profileId, financialProfiles.id))
      .where(and(eq(accounts.workspaceId, workspaceId), isNull(accounts.archivedAt)))
      .orderBy(asc(accounts.name)),
  ])
  return { profiles: profileRows, wallets: walletRows, categories: categoryRows, accounts: accountRows }
  })
}

function accountCandidates(context: AssistantContext, action: AssistantAction, onlyCards = false) {
  let candidates = context.accounts.filter(account => !onlyCards || account.accountType === "credit_card")
  if (action.accountId) candidates = candidates.filter(account => account.id === action.accountId)
  if (action.profileId) candidates = candidates.filter(account => account.profileId === action.profileId)
  if (action.profileHint) {
    const profile = resolveNamed(context.profiles, action.profileHint)
    if (profile) candidates = candidates.filter(account => account.profileId === profile.id)
  }

  const rawHint = [action.accountHint, action.walletHint].filter(Boolean).join(" ")
  const tokens = normalize(rawHint).split(" ").filter(token => token.length > 1 && !["cartao", "conta", "da", "do", "de", "no", "na"].includes(token))
  if (tokens.length) {
    candidates = candidates.filter(account => {
      const haystack = normalize(`${account.name} ${account.walletName} ${account.profileName}`)
      return tokens.every(token => haystack.includes(token))
    })
  }
  return candidates
}

function resolveAccount(context: AssistantContext, action: AssistantAction, onlyCards = false) {
  const candidates = accountCandidates(context, action, onlyCards)
  if (candidates.length === 1) return { account: candidates[0], error: null }
  if (!candidates.length) {
    const available = context.accounts.filter(account => !onlyCards || account.accountType === "credit_card").map(account => `${account.name} (${account.walletName} · ${account.profileName})`)
    return { account: null, error: available.length ? `Não encontrei essa conta. Disponíveis: ${available.join(", ")}.` : "Ainda não existe uma conta compatível cadastrada." }
  }
  return { account: null, error: `Qual conta você quer usar? ${candidates.map(account => `${account.name} (${account.walletName} · ${account.profileName})`).join(", ")}.` }
}

function resolveNamed<T extends { id: string; name: string }>(rows: T[], hint: string | null, fallbackName?: string) {
  if (!hint && fallbackName) {
    const fallback = rows.find(row => normalize(row.name) === normalize(fallbackName))
    if (fallback) return fallback
  }
  if (!hint) return rows.length === 1 ? rows[0] : null
  const normalized = normalize(hint)
  const exact = rows.find(row => normalize(row.name) === normalized)
  if (exact) return exact
  const matches = rows.filter(row => normalize(row.name).includes(normalized) || normalized.includes(normalize(row.name)))
  return matches.length === 1 ? matches[0] : null
}

export async function prepareAction(workspaceId: string, rawAction: AssistantAction, today = dateId(new Date())): Promise<PreparedAction> {
  const context = await getAssistantContext(workspaceId)
  const action = { ...rawAction }

  if (action.kind === "unknown") {
    return { action, ready: false, readOnly: true, summary: null, prompt: "Posso registrar uma compra no cartão, cadastrar uma conta, marcar pagamento, configurar vencimento/fechamento ou listar contas a vencer." }
  }

  if (action.kind === "list_upcoming") {
    return { action, ready: true, readOnly: true, summary: "Consultar contas a vencer", prompt: "" }
  }

  if (action.kind === "record_purchase") {
    if (!action.description?.trim()) return { action, ready: false, readOnly: false, summary: null, prompt: "O que foi comprado?" }
    if (!Number.isSafeInteger(action.amountCents) || action.amountCents! <= 0) return { action, ready: false, readOnly: false, summary: null, prompt: "Qual foi o valor da compra?" }
    const resolved = resolveAccount(context, action, true)
    if (!resolved.account) return { action, ready: false, readOnly: false, summary: null, prompt: resolved.error! }
    action.accountId = resolved.account.id
    action.accountHint = resolved.account.name
    action.walletHint = resolved.account.walletName
    action.profileId = resolved.account.profileId
    action.profileHint = resolved.account.profileName
    action.purchaseDate = validDate(action.purchaseDate) ? action.purchaseDate : today
    if (!validMonth(action.referenceMonth)) {
      if (!resolved.account.closingDay) {
        return { action, ready: false, readOnly: false, summary: null, prompt: `O cartão ${resolved.account.name} não tem dia de fechamento. Em qual fatura devo lançar (AAAA-MM)?` }
      }
      action.referenceMonth = inferredInvoiceMonth(action.purchaseDate!, resolved.account.closingDay)
    }
    const summary = `${action.description.trim()} por ${formatCurrency(action.amountCents!)} no cartão ${resolved.account.name} (${resolved.account.walletName}), fatura ${action.referenceMonth}`
    return { action, ready: true, readOnly: false, summary, prompt: "" }
  }

  if (action.kind === "mark_paid") {
    const resolved = resolveAccount(context, action)
    if (!resolved.account) return { action, ready: false, readOnly: false, summary: null, prompt: resolved.error! }
    action.accountId = resolved.account.id
    action.accountHint = resolved.account.name
    action.profileId = resolved.account.profileId
    action.profileHint = resolved.account.profileName
    action.referenceMonth = validMonth(action.referenceMonth) ? action.referenceMonth : today.slice(0, 7)
    action.purchaseDate = validDate(action.purchaseDate) ? action.purchaseDate : today
    const amount = action.amountCents ? ` por ${formatCurrency(action.amountCents)}` : " pelo valor previsto"
    return { action, ready: true, readOnly: false, summary: `Marcar ${resolved.account.name} como paga${amount} em ${action.purchaseDate}`, prompt: "" }
  }

  if (action.kind === "set_due_day" || action.kind === "set_closing_day") {
    const resolved = resolveAccount(context, action, action.kind === "set_closing_day")
    if (!resolved.account) return { action, ready: false, readOnly: false, summary: null, prompt: resolved.error! }
    const field = action.kind === "set_due_day" ? "dueDay" : "closingDay"
    const value = action[field]
    if (!Number.isInteger(value) || value! < 1 || value! > 31) {
      return { action, ready: false, readOnly: false, summary: null, prompt: `Qual é o dia de ${action.kind === "set_due_day" ? "vencimento" : "fechamento"} (1 a 31)?` }
    }
    action.accountId = resolved.account.id
    action.accountHint = resolved.account.name
    action.profileId = resolved.account.profileId
    action.profileHint = resolved.account.profileName
    return { action, ready: true, readOnly: false, summary: `Definir dia ${value} como ${action.kind === "set_due_day" ? "vencimento" : "fechamento"} de ${resolved.account.name}`, prompt: "" }
  }

  if (action.kind === "create_account") {
    if (!action.accountName?.trim()) return { action, ready: false, readOnly: false, summary: null, prompt: "Qual é o nome da conta?" }
    if (!Number.isSafeInteger(action.amountCents) || action.amountCents! < 0) return { action, ready: false, readOnly: false, summary: null, prompt: "Qual é o valor previsto da conta?" }
    if (!action.nature) return { action, ready: false, readOnly: false, summary: null, prompt: "A conta é fixa, variável, parcelada ou avulsa?" }
    if (!action.accountType) action.accountType = "regular"
    if (!Number.isInteger(action.dueDay) || action.dueDay! < 1 || action.dueDay! > 31) return { action, ready: false, readOnly: false, summary: null, prompt: "Qual é o dia de vencimento (1 a 31)?" }
    if (action.nature === "installment" && (!Number.isInteger(action.installments) || action.installments! < 1)) return { action, ready: false, readOnly: false, summary: null, prompt: "Em quantas parcelas?" }
    if (action.accountType === "credit_card" && (!Number.isInteger(action.closingDay) || action.closingDay! < 1 || action.closingDay! > 31)) return { action, ready: false, readOnly: false, summary: null, prompt: "Qual é o dia de fechamento do cartão?" }
    const profile = action.profileId ? context.profiles.find(item => item.id === action.profileId) : resolveNamed(context.profiles, action.profileHint)
    if (!profile) return { action, ready: false, readOnly: false, summary: null, prompt: `Em qual perfil financeiro? ${context.profiles.map(item => item.name).join(", ")}.` }
    action.profileId = profile.id
    action.profileHint = profile.name
    const profileWallets = context.wallets.filter(item => item.profileId === profile.id)
    const profileCategories = context.categories.filter(item => item.profileId === profile.id)
    const wallet = resolveNamed(profileWallets, action.walletHint)
    if (!wallet) return { action, ready: false, readOnly: false, summary: null, prompt: `Em qual carteira de ${profile.name}? ${profileWallets.map(item => item.name).join(", ")}.` }
    const category = resolveNamed(profileCategories, action.categoryHint, action.accountType === "credit_card" ? "Cartões" : "Outros")
    if (!category) return { action, ready: false, readOnly: false, summary: null, prompt: `Em qual categoria de ${profile.name}? ${profileCategories.map(item => item.name).join(", ")}.` }
    action.walletHint = wallet.name
    action.categoryHint = category.name
    action.referenceMonth = validMonth(action.referenceMonth) ? action.referenceMonth : today.slice(0, 7)
    return { action, ready: true, readOnly: false, summary: `Cadastrar ${action.accountName.trim()} em ${profile.name} / ${wallet.name}, ${formatCurrency(action.amountCents!)}, vencimento dia ${action.dueDay}`, prompt: "" }
  }

  return { action, ready: false, readOnly: true, summary: null, prompt: "Não consegui identificar a ação." }
}

export async function executeAction(workspaceId: string, actorUserId: string, action: AssistantAction, externalId: string) {
  if (action.kind === "list_upcoming") {
    const items = await getUpcomingOccurrences(workspaceId, dateId(new Date()), 31)
    return { message: formatUpcoming(items), data: { count: items.length } }
  }

  if (action.kind === "record_purchase") {
    const result = await withWorkspace(workspaceId, async transaction => {
      const [account] = await transaction.select().from(accounts).where(and(eq(accounts.id, action.accountId!), eq(accounts.workspaceId, workspaceId))).limit(1)
      if (!account) throw new Error("Conta não encontrada")
      const referenceMonth = `${action.referenceMonth}-01`
      await transaction.insert(accountOccurrences).values({
        workspaceId,
        accountId: account.id,
        referenceMonth,
        expectedAmountCents: 0,
        expectedSource: "assistant",
      }).onConflictDoNothing()
      const [occurrence] = await transaction.select().from(accountOccurrences).where(and(
        eq(accountOccurrences.accountId, account.id),
        eq(accountOccurrences.referenceMonth, referenceMonth),
      )).limit(1)
      if (!occurrence) throw new Error("Não foi possível criar a fatura")
      const [insertedItem] = await transaction.insert(invoiceItems).values({
        workspaceId,
        occurrenceId: occurrence.id,
        description: action.description!.trim(),
        amountCents: action.amountCents!,
        purchasedOn: action.purchaseDate!,
        source: "assistant",
        externalId,
        createdByUserId: actorUserId,
      }).onConflictDoNothing().returning()
      const [existingItem] = insertedItem ? [insertedItem] : await transaction.select().from(invoiceItems).where(eq(invoiceItems.externalId, externalId)).limit(1)
      if (!existingItem) throw new Error("Não foi possível registrar a compra")
      const [total] = await transaction.select({ value: sql<number>`coalesce(sum(${invoiceItems.amountCents}), 0)` }).from(invoiceItems).where(eq(invoiceItems.occurrenceId, occurrence.id))
      await transaction.update(accountOccurrences).set({ expectedAmountCents: Number(total.value), expectedSource: "assistant", updatedAt: new Date() }).where(eq(accountOccurrences.id, occurrence.id))
      return { itemId: existingItem.id, occurrenceId: occurrence.id, totalCents: Number(total.value) }
    })
    return { message: `Compra registrada. A fatura ${action.referenceMonth} agora está em ${formatCurrency(result.totalCents)}.`, data: result }
  }

  if (action.kind === "mark_paid") {
    const year = Number(action.referenceMonth!.slice(0, 4))
    await materializeYear(workspaceId, year)
    const result = await withWorkspace(workspaceId, async transaction => {
      const [account] = await transaction.select().from(accounts).where(and(eq(accounts.id, action.accountId!), eq(accounts.workspaceId, workspaceId))).limit(1)
      if (!account) throw new Error("Conta não encontrada")
      const [occurrence] = await transaction.select().from(accountOccurrences).where(and(
        eq(accountOccurrences.accountId, account.id),
        eq(accountOccurrences.referenceMonth, `${action.referenceMonth}-01`),
      )).limit(1)
      if (!occurrence) throw new Error("Ocorrência não encontrada para esse mês")
      const paidAmountCents = action.amountCents ?? occurrence.expectedAmountCents
      await transaction.update(accountOccurrences).set({
        declaration: "paid",
        paidAmountCents,
        paidOn: action.purchaseDate!,
        resolvedAt: new Date(),
        updatedByUserId: actorUserId,
        updatedAt: new Date(),
      }).where(eq(accountOccurrences.id, occurrence.id))
      return { occurrenceId: occurrence.id, paidAmountCents }
    })
    return { message: `Pagamento registrado no valor de ${formatCurrency(result.paidAmountCents)}.`, data: result }
  }

  if (action.kind === "create_account") {
    const context = await getAssistantContext(workspaceId)
    const wallet = resolveNamed(context.wallets.filter(item => item.profileId === action.profileId), action.walletHint)
    const category = resolveNamed(context.categories.filter(item => item.profileId === action.profileId), action.categoryHint)
    if (!wallet || !category) throw new Error("Carteira ou categoria não encontrada")
    const [created] = await withWorkspace(workspaceId, database => database.insert(accounts).values({
      workspaceId,
      profileId: action.profileId!,
      createdByUserId: actorUserId,
      name: action.accountName!.trim(),
      walletId: wallet.id,
      categoryId: category.id,
      dueDay: action.dueDay,
      closingDay: action.closingDay,
      plannedAmountCents: action.amountCents!,
      nature: action.nature!,
      accountType: action.accountType!,
      startMonth: `${action.referenceMonth}-01`,
      installments: action.nature === "installment" ? action.installments : null,
    }).returning())
    return { message: `Conta ${created.name} cadastrada.`, data: { accountId: created.id } }
  }

  if (action.kind === "set_due_day" || action.kind === "set_closing_day") {
    const values = action.kind === "set_due_day" ? { dueDay: action.dueDay } : { closingDay: action.closingDay }
    const [updated] = await withWorkspace(workspaceId, database => database.update(accounts).set({ ...values, updatedAt: new Date() }).where(and(eq(accounts.id, action.accountId!), eq(accounts.workspaceId, workspaceId))).returning())
    if (!updated) throw new Error("Conta não encontrada")
    return { message: `${action.kind === "set_due_day" ? "Vencimento" : "Fechamento"} de ${updated.name} atualizado.`, data: { accountId: updated.id } }
  }

  throw new Error("Ação não executável")
}
