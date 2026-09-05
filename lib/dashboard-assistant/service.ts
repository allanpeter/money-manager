import { and, eq } from "drizzle-orm"
import { currentMonthId } from "@/lib/months"
import { withWorkspace } from "@/lib/db"
import { assistantCommands, assistantSessions } from "@/lib/db/schema"
import { prepareDashboardAction } from "./actions"
import { interpretDashboardMessage, isCancellation, isConfirmation, mergeDashboardAction } from "./interpreter"
import { executeFinancialAssistantAction, getFinancialAssistantContext } from "@/lib/financial-api/assistant-gateway"
import type { DashboardAssistantInput, DashboardAssistantResult, PendingDashboardAction } from "./types"

const dashboardKinds = new Set(["chat", "create_wallet", "add_income", "add_expense", "add_recurring_income", "add_recurring_expense", "query_summary", "list_wallets", "unknown"])

function asDashboardPending(value: unknown): PendingDashboardAction | null {
  if (!value || typeof value !== "object") return null
  const pending = value as Partial<PendingDashboardAction>
  if ((pending.stage !== "collecting" && pending.stage !== "ready") || !pending.action || typeof pending.action !== "object") return null
  const action = pending.action as { kind?: unknown }
  return typeof action.kind === "string" && dashboardKinds.has(action.kind) && typeof pending.operationId === "string"
    ? pending as PendingDashboardAction
    : null
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
      await updateCommand(input.workspaceId, command.id, { status: "rejected", interpretedAction: pending.action, result })
      return { ...result, status: "rejected" }
    }
    if (pending?.stage === "ready" && isConfirmation(text)) {
      if (input.role === "viewer") {
        const result = { message: "Seu acesso é somente leitura; essa operação não foi executada." }
        await savePending(input, null)
        await updateCommand(input.workspaceId, command.id, { status: "rejected", interpretedAction: pending.action, result })
        return { ...result, status: "rejected" }
      }
      const executed = await executeFinancialAssistantAction(input.workspaceId, pending.action)
      const result = { message: executed.message, storeUpdated: executed.changed }
      await savePending(input, null)
      await updateCommand(input.workspaceId, command.id, { status: "executed", interpretedAction: pending.action, result })
      return { ...result, status: "executed" }
    }

    const context = await getFinancialAssistantContext(input.workspaceId)
    const interpreted = await interpretDashboardMessage({ text, today: currentMonthId(), context, pending })
    if (interpreted.action.kind === "chat") {
      const result = { message: interpreted.reply.trim() || "Como posso ajudar com suas finanças?" }
      await updateCommand(input.workspaceId, command.id, { status: "executed", interpretedAction: interpreted.action, result })
      return { ...result, status: "executed" }
    }
    const action = mergeDashboardAction(pending?.action ?? null, interpreted.action)
    if (action.kind === "unknown") {
      const result = { message: interpreted.reply.trim() || "Posso criar uma carteira, registrar receitas ou despesas, criar recorrências e consultar o consolidado." }
      await savePending(input, null)
      await updateCommand(input.workspaceId, command.id, { status: "executed", interpretedAction: action, result })
      return { ...result, status: "executed" }
    }
    const prepared = prepareDashboardAction(context, action)
    await updateCommand(input.workspaceId, command.id, { interpretedAction: prepared.action })
    if (prepared.ready && prepared.readOnly) {
      const executed = await executeFinancialAssistantAction(input.workspaceId, prepared.action)
      const result = { message: executed.message }
      await savePending(input, null)
      await updateCommand(input.workspaceId, command.id, { status: "executed", result })
      return { ...result, status: "executed" }
    }
    if (prepared.ready) {
      if (input.role === "viewer") {
        const result = { message: "Seu acesso é somente leitura; você não pode confirmar alterações financeiras." }
        await savePending(input, null)
        await updateCommand(input.workspaceId, command.id, { status: "rejected", interpretedAction: prepared.action, result })
        return { ...result, status: "rejected" }
      }
      await savePending(input, { stage: "ready", action: prepared.action, operationId: pending?.operationId ?? command.id })
      const result = { message: `Confirma esta operação?\n${prepared.summary}\n\nResponda “sim” para salvar ou “cancelar”.` }
      await updateCommand(input.workspaceId, command.id, { status: "pending", result })
      return { ...result, status: "pending" }
    }
    const nextPending: PendingDashboardAction = { stage: "collecting", action: prepared.action, operationId: pending?.operationId ?? command.id }
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
