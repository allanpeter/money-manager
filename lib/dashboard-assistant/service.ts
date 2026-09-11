import { and, eq, isNull } from "drizzle-orm"
import { currentMonthId } from "@/lib/months"
import { withWorkspace } from "@/lib/db"
import { accounts, assistantCommands, assistantSessions } from "@/lib/db/schema"
import { importC6Invoice } from "@/lib/accounts/import-c6-invoice-service"
import { parseInvoiceDocument } from "@/lib/invoice-imports/registry"
import { prepareDashboardActions } from "./actions"
import { interpretDashboardMessage, isCancellation, isConfirmation, mergeDashboardActions } from "./interpreter"
import { executeFinancialAssistantActions, getFinancialAssistantContext } from "@/lib/financial-api/assistant-gateway"
import { getDashboardAssistantPersona, greetingForPersona, localDateId } from "./persona"
import { composeDashboardAssistantMessage } from "./response-composer"
import { quickDashboardIntent } from "./quick-intents"
import { dashboardConversationSessionKey, replyWithDashboardHarness } from "./harness-agent"
import type { DashboardAction, DashboardAssistantInput, DashboardAssistantResult, PendingC6InvoiceImport, PendingDashboardAction } from "./types"

const dashboardKinds = new Set(["chat", "create_wallet", "add_income", "add_expense", "add_recurring_income", "add_recurring_expense", "add_card_purchase", "pay_bill", "query_summary", "query_cards", "list_wallets", "unknown"])

function asDashboardPending(value: unknown): PendingDashboardAction | null {
  if (!value || typeof value !== "object") return null
  const pending = value as Partial<PendingDashboardAction>
  if ((pending.stage !== "collecting" && pending.stage !== "ready") || typeof pending.operationId !== "string") return null
  const legacyAction = (pending as { action?: { kind?: unknown } }).action
  const actions = Array.isArray(pending.actions) ? pending.actions : legacyAction ? [legacyAction] : []
  if (!actions.length || !actions.every(action => action && typeof action === "object" && typeof action.kind === "string" && dashboardKinds.has(action.kind))) return null
  return { stage: pending.stage, actions: actions as DashboardAction[], operationId: pending.operationId }
}

function asC6ImportPending(value: unknown): PendingC6InvoiceImport | null {
  if (!value || typeof value !== "object") return null
  const pending = value as Partial<PendingC6InvoiceImport>
  if (pending.type !== "c6_invoice_import" || (pending.stage !== "mapping" && pending.stage !== "ready")) return null
  if (typeof pending.operationId !== "string" || typeof pending.filename !== "string" || typeof pending.checksum !== "string") return null
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(pending.referenceMonth))) return null
  if (!Array.isArray(pending.entries) || !Array.isArray(pending.cards) || !pending.mappings || typeof pending.mappings !== "object") return null
  return pending as PendingC6InvoiceImport
}

function normalize(value: string) {
  return value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim()
}

function formatCents(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100)
}

function referenceMonthFromFilename(filename: string) {
  const match = /(?:fatura|invoice)[_-]?(\d{4})-(\d{2})/i.exec(filename)
  return match && Number(match[2]) >= 1 && Number(match[2]) <= 12 ? `${match[1]}-${match[2]}` : currentMonthId()
}

function completedMessage(actions: DashboardAction[], fallback: string) {
  if (actions.length === 1) return fallback
  return `Pronto: ${actions.map(action => action.itemName).filter(Boolean).join(", ")} foram registrados na carteira ${actions[0].walletName}.`
}

function walletChosenForPending(text: string, actions: DashboardAction[], wallets: Array<{ id: string; name: string }>) {
  if (!actions.length || actions.some(action => action.walletName)) return null
  const normalizedText = text.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  return wallets.find(wallet => normalizedText.includes(wallet.name.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) ?? null
}

async function getSession(input: DashboardAssistantInput) {
  const [session] = await withWorkspace(input.workspaceId, database => database.select().from(assistantSessions).where(and(
    eq(assistantSessions.workspaceId, input.workspaceId),
    eq(assistantSessions.userId, input.userId),
    eq(assistantSessions.channel, input.channel),
    eq(assistantSessions.conversationKey, input.conversationKey),
    eq(assistantSessions.userKey, input.externalUserId),
  )).limit(1))
  return session ?? null
}

async function savePending(input: DashboardAssistantInput, pending: PendingDashboardAction | PendingC6InvoiceImport | null, greetedOn?: string) {
  await withWorkspace(input.workspaceId, database => database.insert(assistantSessions).values({
    workspaceId: input.workspaceId,
    userId: input.userId,
    channel: input.channel,
    conversationKey: input.conversationKey,
    userKey: input.externalUserId,
    pendingAction: pending,
    lastGreetedOn: greetedOn ?? null,
  }).onConflictDoUpdate({
    target: [assistantSessions.workspaceId, assistantSessions.channel, assistantSessions.conversationKey, assistantSessions.userKey],
    set: { pendingAction: pending, ...(greetedOn ? { lastGreetedOn: greetedOn } : {}), updatedAt: new Date() },
  }))
}

async function updateCommand(workspaceId: string, id: string, values: Partial<typeof assistantCommands.$inferInsert>) {
  await withWorkspace(workspaceId, database => database.update(assistantCommands).set({ ...values, updatedAt: new Date() })
    .where(and(eq(assistantCommands.id, id), eq(assistantCommands.workspaceId, workspaceId))))
}

async function reserveCommand(input: DashboardAssistantInput, rawText: string): Promise<{ command: typeof assistantCommands.$inferSelect } | { duplicate: DashboardAssistantResult }> {
  const [command] = await withWorkspace(input.workspaceId, database => database.insert(assistantCommands).values({
    workspaceId: input.workspaceId, userId: input.userId, channel: input.channel,
    externalMessageId: input.externalMessageId, externalUserId: input.externalUserId, rawText,
  }).onConflictDoNothing().returning())
  if (command) return { command }

  const [existing] = await withWorkspace(input.workspaceId, database => database.select().from(assistantCommands).where(and(
    eq(assistantCommands.workspaceId, input.workspaceId), eq(assistantCommands.channel, input.channel), eq(assistantCommands.externalMessageId, input.externalMessageId),
  )).limit(1))
  const result = existing?.result as { message?: string; storeUpdated?: boolean } | null
  return {
    duplicate: {
      message: result?.message ?? "Essa mensagem já foi processada.",
      status: existing?.status === "executed" ? "executed" : "pending",
      storeUpdated: result?.storeUpdated,
      duplicate: true,
    },
  }
}

interface C6ImportTarget { id: string; name: string; profileId: string }

async function c6ImportTargets(workspaceId: string): Promise<C6ImportTarget[]> {
  return withWorkspace(workspaceId, database => database.select({ id: accounts.id, name: accounts.name, profileId: accounts.profileId })
    .from(accounts).where(and(eq(accounts.workspaceId, workspaceId), eq(accounts.accountType, "credit_card"), isNull(accounts.archivedAt))))
}

function targetFromText(text: string, targets: C6ImportTarget[]) {
  const requested = normalize(text)
  const matches = targets.filter(target => {
    const name = normalize(target.name)
    return requested === name || requested.includes(name) || name.includes(requested)
  })
  return matches.length === 1 ? matches[0] : null
}

function c6Preview(pending: PendingC6InvoiceImport, targets: C6ImportTarget[]) {
  const cards = pending.cards.map(card => `•••• ${card.lastFour}: ${card.entryCount} compra(s), ${formatCents(card.totalCents)}`).join("\n")
  const unmapped = pending.cards.find(card => !pending.mappings[card.lastFour])
  if (unmapped) {
    return `Li “${pending.filename}” para ${pending.referenceMonth}.\n${cards}\n\nQual cartão cadastrado corresponde ao final •••• ${unmapped.lastFour}? Responda com um destes nomes: ${targets.map(target => target.name).join(", ")}.`
  }
  return `Prévia da fatura de ${pending.referenceMonth}:\n${cards}\n\n${pending.paymentCount} pagamento(s) de fatura foram ignorados. Confirma a importação? Responda “sim” ou “cancelar”.`
}

function targetsForPending(pending: PendingC6InvoiceImport, targets: C6ImportTarget[]) {
  const firstMappedId = Object.values(pending.mappings)[0]
  const profileId = targets.find(target => target.id === firstMappedId)?.profileId
  return profileId ? targets.filter(target => target.profileId === profileId) : targets
}

export async function handleDashboardInvoiceAttachment(input: DashboardAssistantInput, attachment: { filename: string; bytes: Buffer }): Promise<DashboardAssistantResult> {
  if (input.role === "viewer") return { message: "Seu acesso é somente leitura; você não pode importar faturas.", status: "rejected" }
  const reserved = await reserveCommand(input, `[anexo] ${attachment.filename}`)
  if ("duplicate" in reserved) return reserved.duplicate
  const command = reserved.command

  try {
    const session = await getSession(input)
    if (session?.pendingAction) {
      const result = { message: "Há uma operação aguardando resposta. Responda “cancelar” antes de enviar outra fatura." }
      await updateCommand(input.workspaceId, command.id, { status: "rejected", result })
      return { ...result, status: "rejected" }
    }
    const document = parseInvoiceDocument(attachment)
    if (document.source !== "c6") throw new Error("Documento de fatura não reconhecido.")
    if (document.parsed.issues.length) throw new Error(`O CSV possui ${document.parsed.issues.length} linha(s) inválida(s). Corrija o arquivo antes de importar.`)
    const targets = await c6ImportTargets(input.workspaceId)
    if (!targets.length) throw new Error("Cadastre ao menos uma conta do tipo cartão antes de importar a fatura.")
    const mappings = document.parsed.cards.length === 1 && targets.length === 1 ? { [document.parsed.cards[0].lastFour]: targets[0].id } : {}
    const pending: PendingC6InvoiceImport = {
      type: "c6_invoice_import",
      stage: Object.keys(mappings).length === document.parsed.cards.length ? "ready" : "mapping",
      operationId: command.id,
      filename: document.filename,
      checksum: document.parsed.checksum,
      referenceMonth: referenceMonthFromFilename(document.filename),
      entries: document.parsed.entries,
      cards: document.parsed.cards,
      paymentCount: document.parsed.paymentCount,
      mappings,
    }
    const result = { message: c6Preview(pending, targetsForPending(pending, targets)) }
    await savePending(input, pending)
    await updateCommand(input.workspaceId, command.id, { status: "pending", result })
    return { ...result, status: "pending" }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível ler o anexo."
    const result = { message: `Não consegui preparar essa fatura: ${message}` }
    await updateCommand(input.workspaceId, command.id, { status: "failed", error: message, result })
    return { ...result, status: "failed" }
  }
}

export async function handleDashboardAssistantMessage(input: DashboardAssistantInput): Promise<DashboardAssistantResult> {
  const text = input.text.trim().slice(0, 4000)
  if (!text) return { message: "Envie uma instrução financeira em texto.", status: "failed" }

  const reserved = await reserveCommand(input, text)
  if ("duplicate" in reserved) return reserved.duplicate
  const command = reserved.command

  try {
    const session = await getSession(input)
    const documentPending = asC6ImportPending(session?.pendingAction)
    if (documentPending) {
      const targets = await c6ImportTargets(input.workspaceId)
      if (isCancellation(text)) {
        const result = { message: "Importação da fatura cancelada." }
        await savePending(input, null)
        await updateCommand(input.workspaceId, command.id, { status: "rejected", result })
        return { ...result, status: "rejected" }
      }
      if (documentPending.stage === "ready" && isConfirmation(text)) {
        const mappedTargets = Object.values(documentPending.mappings).map(id => targets.find(target => target.id === id)).filter((target): target is C6ImportTarget => Boolean(target))
        const profileIds = new Set(mappedTargets.map(target => target.profileId))
        if (mappedTargets.length !== Object.keys(documentPending.mappings).length || profileIds.size !== 1) throw new Error("Os cartões selecionados não pertencem ao mesmo perfil financeiro.")
        const imported = await importC6Invoice({
          workspaceId: input.workspaceId,
          userId: input.userId,
          filename: documentPending.filename,
          profileId: [...profileIds][0],
          referenceMonth: documentPending.referenceMonth,
          mappings: documentPending.mappings,
          parsed: { checksum: documentPending.checksum, entries: documentPending.entries, cards: documentPending.cards, paymentCount: documentPending.paymentCount, issues: [] },
        })
        const result = { message: `Fatura importada: ${imported.items} compra(s) em ${imported.cards.length} cartão(ões). ${imported.paymentRowsSkipped} pagamento(s) foram ignorados.`, storeUpdated: true }
        await savePending(input, null)
        await updateCommand(input.workspaceId, command.id, { status: "executed", result })
        return { ...result, status: "executed" }
      }
      if (documentPending.stage === "mapping") {
        const eligible = targetsForPending(documentPending, targets)
        const target = targetFromText(text, eligible)
        if (!target) {
          const result = { message: c6Preview(documentPending, eligible) }
          await updateCommand(input.workspaceId, command.id, { status: "pending", result })
          return { ...result, status: "pending" }
        }
        const card = documentPending.cards.find(item => !documentPending.mappings[item.lastFour])
        if (!card) throw new Error("Não encontrei cartão pendente para vincular.")
        const next: PendingC6InvoiceImport = {
          ...documentPending,
          mappings: { ...documentPending.mappings, [card.lastFour]: target.id },
          stage: documentPending.cards.every(item => item.lastFour === card.lastFour || documentPending.mappings[item.lastFour]) ? "ready" : "mapping",
        }
        const result = { message: c6Preview(next, targetsForPending(next, targets)) }
        await savePending(input, next)
        await updateCommand(input.workspaceId, command.id, { status: "pending", result })
        return { ...result, status: "pending" }
      }
      const result = { message: c6Preview(documentPending, targetsForPending(documentPending, targets)) }
      await updateCommand(input.workspaceId, command.id, { status: "pending", result })
      return { ...result, status: "pending" }
    }
    const pending = asDashboardPending(session?.pendingAction)
    const persona = await getDashboardAssistantPersona(input.workspaceId, input.userId)
    const today = localDateId(persona.timezone)
    const shouldGreet = persona.greetings && String(session?.lastGreetedOn ?? "") !== today
    const fallbackMessage = (message: string) => shouldGreet ? `${greetingForPersona(persona)}\n\n${message}` : message
    const messageFor = async (message: string) => composeDashboardAssistantMessage({
      persona,
      greeting: shouldGreet ? greetingForPersona(persona) : null,
      briefing: message,
    }).catch(() => fallbackMessage(message))
    const greetedOn = shouldGreet ? today : undefined
    if (pending && isCancellation(text)) {
      const result = { message: await messageFor("Operação cancelada.") }
      await savePending(input, null, greetedOn)
      await updateCommand(input.workspaceId, command.id, { status: "rejected", interpretedAction: pending.actions, result })
      return { ...result, status: "rejected" }
    }
    if (pending?.stage === "ready" && isConfirmation(text)) {
      if (input.role === "viewer") {
        const result = { message: await messageFor("Seu acesso é somente leitura; essa operação não foi executada.") }
        await savePending(input, null, greetedOn)
        await updateCommand(input.workspaceId, command.id, { status: "rejected", interpretedAction: pending.actions, result })
        return { ...result, status: "rejected" }
      }
      const executed = await executeFinancialAssistantActions(input.workspaceId, pending.actions)
      const result = { message: await messageFor(completedMessage(pending.actions, executed.message)), storeUpdated: executed.changed }
      await savePending(input, null, greetedOn)
      await updateCommand(input.workspaceId, command.id, { status: "executed", interpretedAction: pending.actions, result })
      return { ...result, status: "executed" }
    }

    const context = await getFinancialAssistantContext(input.workspaceId)
    const selectedWallet = pending ? walletChosenForPending(text, pending.actions, context.wallets) : null
    const directIntent = pending ? null : quickDashboardIntent(text)
    const interpreted = selectedWallet || directIntent ? null : await interpretDashboardMessage({ text, today: currentMonthId(), context, pending, persona })
    if (interpreted?.actions.length === 1 && interpreted.actions[0].kind === "chat") {
      const fallback = interpreted.reply.trim() || "Como posso ajudar com suas finanças?"
      const message = await replyWithDashboardHarness({
        sessionKey: dashboardConversationSessionKey(input),
        text,
        persona,
        greeting: shouldGreet ? greetingForPersona(persona) : null,
      }).catch(() => fallbackMessage(fallback))
      const result = { message }
      await savePending(input, null, greetedOn)
      await updateCommand(input.workspaceId, command.id, { status: "executed", interpretedAction: interpreted.actions, result })
      return { ...result, status: "executed" }
    }
    const actions = selectedWallet
      ? pending!.actions.map(action => ({ ...action, walletName: selectedWallet.name, walletId: selectedWallet.id }))
      : directIntent
        ? [directIntent]
      : mergeDashboardActions(pending?.actions ?? null, interpreted!.actions)
    if (actions.some(action => action.kind === "unknown")) {
      const result = { message: await messageFor(interpreted?.reply.trim() || "Posso criar carteiras, registrar receitas e despesas, criar recorrências, lançar compras no cartão, quitar contas e faturas e consultar o consolidado.") }
      await savePending(input, null, greetedOn)
      await updateCommand(input.workspaceId, command.id, { status: "executed", interpretedAction: actions, result })
      return { ...result, status: "executed" }
    }
    const prepared = prepareDashboardActions(context, actions)
    await updateCommand(input.workspaceId, command.id, { interpretedAction: prepared.actions })
    if (prepared.ready && prepared.readOnly) {
      const executed = await executeFinancialAssistantActions(input.workspaceId, prepared.actions)
      const result = { message: await messageFor(completedMessage(prepared.actions, executed.message)) }
      await savePending(input, null, greetedOn)
      await updateCommand(input.workspaceId, command.id, { status: "executed", result })
      return { ...result, status: "executed" }
    }
    if (prepared.ready) {
      if (input.role === "viewer") {
        const result = { message: await messageFor("Seu acesso é somente leitura; você não pode confirmar alterações financeiras.") }
        await savePending(input, null, greetedOn)
        await updateCommand(input.workspaceId, command.id, { status: "rejected", interpretedAction: prepared.actions, result })
        return { ...result, status: "rejected" }
      }
      await savePending(input, { stage: "ready", actions: prepared.actions, operationId: pending?.operationId ?? command.id }, greetedOn)
      const result = { message: await messageFor(`Confirma esta operação?\n${prepared.summary}\n\nResponda “sim” para salvar ou “cancelar”.`) }
      await updateCommand(input.workspaceId, command.id, { status: "pending", result })
      return { ...result, status: "pending" }
    }
    const nextPending: PendingDashboardAction = { stage: "collecting", actions: prepared.actions, operationId: pending?.operationId ?? command.id }
    await savePending(input, nextPending, greetedOn)
    const result = { message: await messageFor(prepared.prompt) }
    await updateCommand(input.workspaceId, command.id, { status: "pending", result })
    return { ...result, status: "pending" }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha inesperada"
    console.error("dashboard assistant command failed", { commandId: command.id, error })
    const result = { message: "Não consegui processar isso agora. Tente novamente." }
    await updateCommand(input.workspaceId, command.id, { status: "failed", error: message, result })
    return { ...result, status: "failed" }
  }
}
