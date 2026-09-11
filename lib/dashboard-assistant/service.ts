import { and, eq } from "drizzle-orm"
import { currentMonthId } from "@/lib/months"
import { withWorkspace } from "@/lib/db"
import { assistantCommands, assistantSessions } from "@/lib/db/schema"
import { loadFinancialStore } from "@/lib/financial-api/store"
import { SKIP_CARD, listStoreCards, matchCardByLastFour, type StoreCardTarget } from "@/lib/invoice-imports/apply-to-store"
import { importInvoiceIntoStore } from "@/lib/invoice-imports/import-service"
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

type C6ImportTarget = StoreCardTarget

async function c6ImportTargets(workspaceId: string): Promise<C6ImportTarget[]> {
  return listStoreCards(await loadFinancialStore(workspaceId))
}

function targetLabel(target: C6ImportTarget) {
  return `${target.name}${target.lastFour ? ` •••• ${target.lastFour}` : ""}`
}

function isSkipAnswer(text: string) {
  return ["ignorar", "ignora", "pular", "pula", "nenhum", "nenhuma", "deixa de fora"].includes(normalize(text))
}

function targetFromText(text: string, targets: C6ImportTarget[]) {
  const requested = normalize(text)
  const digits = text.replace(/\D/g, "")
  if (digits.length === 4) {
    const byLastFour = targets.filter(target => target.lastFour === digits)
    if (byLastFour.length === 1) return byLastFour[0]
  }
  const matches = targets.filter(target => {
    const name = normalize(target.name)
    return requested === name || requested.includes(name) || name.includes(requested)
  })
  return matches.length === 1 ? matches[0] : null
}

function cardLine(pending: PendingC6InvoiceImport, card: PendingC6InvoiceImport["cards"][number], targets: C6ImportTarget[]) {
  const mapped = pending.mappings[card.lastFour]
  const target = mapped && mapped !== SKIP_CARD ? targets.find(item => item.id === mapped) : null
  const destination = mapped === SKIP_CARD ? " → ignorado" : target ? ` → ${targetLabel(target)}` : " → sem cartão correspondente"
  return `•••• ${card.lastFour}: ${card.entryCount} compra(s), ${formatCents(card.totalCents)}${destination}`
}

function c6Preview(pending: PendingC6InvoiceImport, targets: C6ImportTarget[]) {
  const cards = pending.cards.map(card => cardLine(pending, card, targets)).join("\n")
  const unmapped = pending.cards.find(card => !pending.mappings[card.lastFour])
  if (unmapped) {
    return `Li “${pending.filename}” para ${pending.referenceMonth}.\n${cards}\n\nNão tenho cartão cadastrado com o final •••• ${unmapped.lastFour}. A qual cartão ele pertence? Responda com um destes nomes — ${targets.map(targetLabel).join(", ")} — ou “ignorar” para deixar esse final de fora.`
  }
  const ignored = pending.cards.filter(card => pending.mappings[card.lastFour] === SKIP_CARD).length
  const ignoredLine = ignored ? ` ${ignored} final(is) ficaram de fora.` : ""
  return `Prévia da fatura de ${pending.referenceMonth}:\n${cards}\n\n${pending.paymentCount} pagamento(s) de fatura foram ignorados.${ignoredLine} Confirma a importação? Responda “sim” ou “cancelar”.`
}

/** Every registered card is eligible: the store has no profile to narrow down. */
function targetsForPending(_pending: PendingC6InvoiceImport, targets: C6ImportTarget[]) {
  return targets
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
    if (!targets.length) throw new Error("Você ainda não tem cartões cadastrados. Abra o Money Manager, cadastre o cartão em Cartões → Novo cartão (informando os quatro últimos dígitos) e reenvie o arquivo.")
    // A fatura do C6 traz um grupo por cartão adicional; o final impresso no CSV
    // casa com os quatro dígitos do cartão cadastrado, então só o que sobra é perguntado.
    const mappings = Object.fromEntries(document.parsed.cards.flatMap(card => {
      // Só um cartão cadastrado e sem os dígitos preenchidos: não há alternativa a oferecer.
      const match = matchCardByLastFour(targets, card.lastFour) ?? (targets.length === 1 && !targets[0].lastFour ? targets[0] : null)
      return match ? [[card.lastFour, match.id] as const] : []
    }))
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
        const chosen = Object.values(documentPending.mappings).filter(id => id !== SKIP_CARD)
        if (chosen.some(id => !targets.some(target => target.id === id))) throw new Error("Um dos cartões escolhidos não existe mais. Reenvie a fatura.")
        if (!chosen.length) throw new Error("Todos os finais da fatura foram ignorados; não há o que importar.")
        const imported = await importInvoiceIntoStore({
          workspaceId: input.workspaceId,
          filename: documentPending.filename,
          checksum: documentPending.checksum,
          referenceMonth: documentPending.referenceMonth,
          entries: documentPending.entries,
          mappings: documentPending.mappings,
        })
        const detail = imported.perCard.filter(card => card.imported).map(card => `${card.cardName} (${card.imported})`).join(", ")
        const duplicates = imported.duplicates ? ` ${imported.duplicates} compra(s) já estavam registradas e foram puladas.` : ""
        const result = { message: `Fatura importada: ${imported.imported} compra(s) em ${detail}.${duplicates} ${documentPending.paymentCount} pagamento(s) de fatura foram ignorados.`, storeUpdated: true }
        await savePending(input, null)
        await updateCommand(input.workspaceId, command.id, { status: "executed", result })
        return { ...result, status: "executed" }
      }
      if (documentPending.stage === "mapping") {
        const eligible = targetsForPending(documentPending, targets)
        const card = documentPending.cards.find(item => !documentPending.mappings[item.lastFour])
        if (card && isSkipAnswer(text)) {
          const next: PendingC6InvoiceImport = {
            ...documentPending,
            mappings: { ...documentPending.mappings, [card.lastFour]: SKIP_CARD },
            stage: documentPending.cards.every(item => item.lastFour === card.lastFour || documentPending.mappings[item.lastFour]) ? "ready" : "mapping",
          }
          const result = { message: c6Preview(next, targetsForPending(next, targets)) }
          await savePending(input, next)
          await updateCommand(input.workspaceId, command.id, { status: "pending", result })
          return { ...result, status: "pending" }
        }
        const target = targetFromText(text, eligible)
        if (!target) {
          const result = { message: c6Preview(documentPending, eligible) }
          await updateCommand(input.workspaceId, command.id, { status: "pending", result })
          return { ...result, status: "pending" }
        }
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
