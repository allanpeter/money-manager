import { and, eq } from "drizzle-orm"
import { dateId } from "@/lib/accounts/domain"
import { withWorkspace } from "@/lib/db"
import { assistantCommands, assistantSessions } from "@/lib/db/schema"
import { executeAction, getAssistantContext, prepareAction } from "./actions"
import { interpretMessage, isCancellation, isConfirmation, mergeAction } from "./interpreter"
import type { AssistantMessageInput, AssistantMessageResult, PendingAssistantAction } from "./types"

async function getSession(input: AssistantMessageInput) {
  const [session] = await withWorkspace(input.workspaceId, database => database.select().from(assistantSessions).where(and(
    eq(assistantSessions.workspaceId, input.workspaceId),
    eq(assistantSessions.userId, input.userId),
    eq(assistantSessions.channel, input.channel),
    eq(assistantSessions.conversationKey, input.conversationKey),
    eq(assistantSessions.userKey, input.externalUserId),
  )).limit(1))
  return session ?? null
}

async function savePending(input: AssistantMessageInput, pending: PendingAssistantAction | null) {
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
  await withWorkspace(workspaceId, database => database.update(assistantCommands).set({ ...values, updatedAt: new Date() }).where(and(eq(assistantCommands.id, id), eq(assistantCommands.workspaceId, workspaceId))))
}

function existingMessage(result: Record<string, unknown> | null) {
  return typeof result?.message === "string" ? result.message : "Essa mensagem já foi processada."
}

export async function handleAssistantMessage(input: AssistantMessageInput): Promise<AssistantMessageResult> {
  const text = input.text.trim().slice(0, 4000)
  if (!text) return { message: "Envie uma instrução financeira em texto.", status: "failed" }

  const [command] = await withWorkspace(input.workspaceId, database => database.insert(assistantCommands).values({
    workspaceId: input.workspaceId,
    userId: input.userId,
    channel: input.channel,
    externalMessageId: input.externalMessageId,
    externalUserId: input.externalUserId,
    rawText: text,
  }).onConflictDoNothing().returning())

  if (!command) {
    const [existing] = await withWorkspace(input.workspaceId, database => database.select().from(assistantCommands).where(and(
      eq(assistantCommands.workspaceId, input.workspaceId),
      eq(assistantCommands.channel, input.channel),
      eq(assistantCommands.externalMessageId, input.externalMessageId),
    )).limit(1))
    return { message: existingMessage(existing?.result as Record<string, unknown> | null), status: existing?.status === "executed" ? "executed" : "pending" }
  }

  try {
    const session = await getSession(input)
    const pending = session?.pendingAction as PendingAssistantAction | null

    if (pending && isCancellation(text)) {
      await savePending(input, null)
      const result = { message: "Operação cancelada." }
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
      await updateCommand(input.workspaceId, command.id, { status: "confirmed", interpretedAction: pending.action })
      const executed = await executeAction(input.workspaceId, input.userId, pending.action, pending.operationId)
      await savePending(input, null)
      const result = { message: executed.message, ...executed.data }
      await updateCommand(input.workspaceId, command.id, { status: "executed", result })
      return { message: executed.message, status: "executed" }
    }

    const context = await getAssistantContext(input.workspaceId)
    const interpreted = await interpretMessage({ text, today: dateId(new Date()), context, pending })

    if (interpreted.action.kind === "chat") {
      const message = interpreted.reply.trim() || "Como posso ajudar com suas finanças?"
      await updateCommand(input.workspaceId, command.id, { status: "executed", interpretedAction: interpreted.action, result: { message } })
      return { message, status: "executed" }
    }

    const action = mergeAction(pending?.action ?? null, interpreted.action)

    if (action.kind === "unknown") {
      await savePending(input, null)
      const message = interpreted.reply.trim() || "Não entendi a operação financeira. Posso registrar uma compra, cadastrar uma conta, marcar pagamento ou listar vencimentos."
      await updateCommand(input.workspaceId, command.id, { status: "executed", interpretedAction: action, result: { message } })
      return { message, status: "executed" }
    }

    const prepared = await prepareAction(input.workspaceId, action)
    await updateCommand(input.workspaceId, command.id, { interpretedAction: prepared.action })

    if (prepared.ready && prepared.readOnly) {
      const executed = await executeAction(input.workspaceId, input.userId, prepared.action, `${input.channel}:${input.externalMessageId}`)
      await savePending(input, null)
      const result = { message: executed.message, ...executed.data }
      await updateCommand(input.workspaceId, command.id, { status: "executed", result })
      return { message: executed.message, status: "executed" }
    }

    if (prepared.ready) {
      if (input.role === "viewer") {
        const result = { message: "Seu acesso é somente leitura; você não pode confirmar alterações financeiras." }
        await savePending(input, null)
        await updateCommand(input.workspaceId, command.id, { status: "rejected", interpretedAction: prepared.action, result })
        return { ...result, status: "rejected" }
      }
      await savePending(input, { stage: "ready", action: prepared.action, operationId: pending?.operationId ?? command.id })
      const message = `Confirma esta operação?\n${prepared.summary}\n\nResponda “sim” para salvar ou “cancelar”.`
      await updateCommand(input.workspaceId, command.id, { status: "pending", result: { message } })
      return { message, status: "pending" }
    }

    const nextPending = prepared.action.kind === "unknown" ? null : { stage: "collecting" as const, action: prepared.action, operationId: pending?.operationId ?? command.id }
    await savePending(input, nextPending)
    await updateCommand(input.workspaceId, command.id, { status: "pending", result: { message: prepared.prompt } })
    return { message: prepared.prompt, status: "pending" }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha inesperada"
    console.error("assistant command failed", { commandId: command.id, error })
    await updateCommand(input.workspaceId, command.id, { status: "failed", error: message, result: { message: "Não consegui processar isso agora. Tente novamente." } })
    return { message: "Não consegui processar isso agora. Tente novamente.", status: "failed" }
  }
}
