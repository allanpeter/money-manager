import { and, eq } from "drizzle-orm"
import { currentMonthId } from "@/lib/months"
import { withWorkspace } from "@/lib/db"
import { assistantCommands, assistantSessions } from "@/lib/db/schema"
import { prepareDashboardActions } from "./actions"
import { interpretDashboardMessage, isCancellation, isConfirmation, mergeDashboardActions } from "./interpreter"
import { executeFinancialAssistantActions, getFinancialAssistantContext } from "@/lib/financial-api/assistant-gateway"
import type { DashboardAction, DashboardAssistantInput, DashboardAssistantResult, PendingDashboardAction } from "./types"

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

async function savePending(input: DashboardAssistantInput, pending: PendingDashboardAction | null) {
  await withWorkspace(input.workspaceId, database => database.insert(assistantSessions).values({
    workspaceId: input.workspaceId,
    userId: input.userId,
    channel: input.channel,
    conversationKey: input.conversationKey,
    userKey: input.externalUserId,
    pendingAction: pending,
  }).onConflictDoUpdate({
    target: [assistantSessions.workspaceId, assistantSessions.channel, assistantSessions.conversationKey, assistantSessions.userKey],
    set: { pendingAction: pending, updatedAt: new Date() },
  }))
}

async function updateCommand(workspaceId: string, id: string, values: Partial<typeof assistantCommands.$inferInsert>) {
  await withWorkspace(workspaceId, database => database.update(assistantCommands).set({ ...values, updatedAt: new Date() })
    .where(and(eq(assistantCommands.id, id), eq(assistantCommands.workspaceId, workspaceId))))
}

export async function handleDashboardAssistantMessage(input: DashboardAssistantInput): Promise<DashboardAssistantResult> {
  const text = input.text.trim().slice(0, 4000)
  if (!text) return { message: "Envie uma instrução financeira em texto.", status: "failed" }

  const [command] = await withWorkspace(input.workspaceId, database => database.insert(assistantCommands).values({
    workspaceId: input.workspaceId, userId: input.userId, channel: input.channel,
    externalMessageId: input.externalMessageId, externalUserId: input.externalUserId, rawText: text,
  }).onConflictDoNothing().returning())

  if (!command) {
    const [existing] = await withWorkspace(input.workspaceId, database => database.select().from(assistantCommands).where(and(
      eq(assistantCommands.workspaceId, input.workspaceId), eq(assistantCommands.channel, input.channel), eq(assistantCommands.externalMessageId, input.externalMessageId),
    )).limit(1))
    const result = existing?.result as { message?: string; storeUpdated?: boolean } | null
    return { message: result?.message ?? "Essa mensagem já foi processada.", status: existing?.status === "executed" ? "executed" : "pending", storeUpdated: result?.storeUpdated }
  }

  try {
    const session = await getSession(input)
    const pending = asDashboardPending(session?.pendingAction)
    if (pending && isCancellation(text)) {
      const result = { message: "Operação cancelada." }
      await savePending(input, null)
      await updateCommand(input.workspaceId, command.id, { status: "rejected", interpretedAction: pending.actions, result })
      return { ...result, status: "rejected" }
    }
    if (pending?.stage === "ready" && isConfirmation(text)) {
      if (input.role === "viewer") {
        const result = { message: "Seu acesso é somente leitura; essa operação não foi executada." }
        await savePending(input, null)
        await updateCommand(input.workspaceId, command.id, { status: "rejected", interpretedAction: pending.actions, result })
        return { ...result, status: "rejected" }
      }
      const executed = await executeFinancialAssistantActions(input.workspaceId, pending.actions)
      const result = { message: completedMessage(pending.actions, executed.message), storeUpdated: executed.changed }
      await savePending(input, null)
      await updateCommand(input.workspaceId, command.id, { status: "executed", interpretedAction: pending.actions, result })
      return { ...result, status: "executed" }
    }

    const context = await getFinancialAssistantContext(input.workspaceId)
    const selectedWallet = pending ? walletChosenForPending(text, pending.actions, context.wallets) : null
    const interpreted = selectedWallet ? null : await interpretDashboardMessage({ text, today: currentMonthId(), context, pending })
    if (interpreted?.actions.length === 1 && interpreted.actions[0].kind === "chat") {
      const result = { message: interpreted.reply.trim() || "Como posso ajudar com suas finanças?" }
      await updateCommand(input.workspaceId, command.id, { status: "executed", interpretedAction: interpreted.actions, result })
      return { ...result, status: "executed" }
    }
    const actions = selectedWallet
      ? pending!.actions.map(action => ({ ...action, walletName: selectedWallet.name, walletId: selectedWallet.id }))
      : mergeDashboardActions(pending?.actions ?? null, interpreted!.actions)
    if (actions.some(action => action.kind === "unknown")) {
      const result = { message: interpreted?.reply.trim() || "Posso criar carteiras, registrar receitas e despesas, criar recorrências, lançar compras no cartão, quitar contas e faturas e consultar o consolidado." }
      await savePending(input, null)
      await updateCommand(input.workspaceId, command.id, { status: "executed", interpretedAction: actions, result })
      return { ...result, status: "executed" }
    }
    const prepared = prepareDashboardActions(context, actions)
    await updateCommand(input.workspaceId, command.id, { interpretedAction: prepared.actions })
    if (prepared.ready && prepared.readOnly) {
      const executed = await executeFinancialAssistantActions(input.workspaceId, prepared.actions)
      const result = { message: completedMessage(prepared.actions, executed.message) }
      await savePending(input, null)
      await updateCommand(input.workspaceId, command.id, { status: "executed", result })
      return { ...result, status: "executed" }
    }
    if (prepared.ready) {
      if (input.role === "viewer") {
        const result = { message: "Seu acesso é somente leitura; você não pode confirmar alterações financeiras." }
        await savePending(input, null)
        await updateCommand(input.workspaceId, command.id, { status: "rejected", interpretedAction: prepared.actions, result })
        return { ...result, status: "rejected" }
      }
      await savePending(input, { stage: "ready", actions: prepared.actions, operationId: pending?.operationId ?? command.id })
      const result = { message: `Confirma esta operação?\n${prepared.summary}\n\nResponda “sim” para salvar ou “cancelar”.` }
      await updateCommand(input.workspaceId, command.id, { status: "pending", result })
      return { ...result, status: "pending" }
    }
    const nextPending: PendingDashboardAction = { stage: "collecting", actions: prepared.actions, operationId: pending?.operationId ?? command.id }
    await savePending(input, nextPending)
    const result = { message: prepared.prompt }
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
