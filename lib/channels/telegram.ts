import { handleDashboardAssistantMessage } from "@/lib/dashboard-assistant/service"
import { bootstrapExternalIdentity, claimIdentityLink, listReminderTargets, resolveExternalIdentity } from "@/lib/auth/identities"
import { dispatchDueReminders } from "@/lib/reminders/service"

interface TelegramUser { id: number; first_name: string; username?: string; is_bot: boolean }
interface TelegramChat { id: number; type: "private" | "group" | "supergroup" | "channel" }
interface TelegramMessage { message_id: number; from?: TelegramUser; chat: TelegramChat; text?: string }
interface TelegramUpdate { update_id: number; message?: TelegramMessage }
interface TelegramResponse<T> { ok: boolean; result: T; description?: string }

const MAX_MESSAGE_LENGTH = 4000

function chunks(message: string) {
  const result: string[] = []
  for (let index = 0; index < message.length; index += MAX_MESSAGE_LENGTH) result.push(message.slice(index, index + MAX_MESSAGE_LENGTH))
  return result.length ? result : [""]
}

export function createTelegramChannel() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN não configurada")
  const allowedUsers = new Set((process.env.TELEGRAM_ALLOWED_USER_IDS ?? "").split(",").map(value => value.trim()).filter(Boolean))
  const apiBase = `https://api.telegram.org/bot${token}`
  const controller = new AbortController()
  const queues = new Map<string, Promise<void>>()
  let offset = 0
  let reminderTimer: NodeJS.Timeout | undefined

  async function api<T>(method: string, body?: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${apiBase}/${method}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    const data = await response.json() as TelegramResponse<T>
    if (!response.ok || !data.ok) throw new Error(data.description ?? `Telegram ${method} falhou (${response.status})`)
    return data.result
  }

  async function send(chatId: string | number, message: string, replyTo?: number) {
    for (const chunk of chunks(message)) {
      await api("sendMessage", {
        chat_id: chatId,
        text: chunk,
        ...(replyTo ? { reply_parameters: { message_id: replyTo } } : {}),
      })
    }
  }

  async function processMessage(message: TelegramMessage) {
    if (!message.from || message.from.is_bot || !message.text?.trim()) return
    if (message.chat.type !== "private") {
      await send(message.chat.id, "Por segurança, operações financeiras são aceitas somente na conversa privada com o bot.", message.message_id)
      return
    }
    const text = message.text.trim()
    const externalUserId = String(message.from.id)
    const conversationId = String(message.chat.id)
    const displayName = message.from.username ?? message.from.first_name

    const linkMatch = text.match(/^\/?vincular\s+([a-z0-9-]+)$/i)
    if (linkMatch) {
      try {
        await claimIdentityLink({ provider: "telegram", code: linkMatch[1], externalUserId, conversationId, displayName })
        await send(conversationId, "Telegram vinculado ao seu usuário. A partir de agora só acessarei o seu espaço financeiro.", message.message_id)
      } catch (error) {
        await send(conversationId, error instanceof Error ? error.message : "Não foi possível concluir o vínculo.", message.message_id)
      }
      return
    }

    let identity = await resolveExternalIdentity({ provider: "telegram", externalUserId, conversationId })
    if (!identity) identity = await bootstrapExternalIdentity({ provider: "telegram", externalUserId, conversationId, allowedIds: allowedUsers, displayName })
    if (!identity) {
      await send(conversationId, "Seu Telegram ainda não está vinculado. Entre no Money Manager, abra Configurações e gere um código de vínculo.", message.message_id)
      return
    }

    await api("sendChatAction", { chat_id: conversationId, action: "typing" }).catch(() => undefined)
    const result = await handleDashboardAssistantMessage({
      userId: identity.userId,
      workspaceId: identity.workspaceId,
      role: identity.role,
      channel: "telegram",
      conversationKey: conversationId,
      externalMessageId: String(message.message_id),
      externalUserId,
      text,
    })
    await send(conversationId, result.message, message.message_id)
  }

  async function poll() {
    while (!controller.signal.aborted) {
      try {
        const updates = await api<TelegramUpdate[]>("getUpdates", { offset, timeout: 30, allowed_updates: ["message"] })
        for (const update of updates) {
          offset = Math.max(offset, update.update_id + 1)
          if (!update.message) continue
          const key = `${update.message.chat.id}:${update.message.from?.id ?? "unknown"}`
          const previous = queues.get(key) ?? Promise.resolve()
          const next = previous.then(() => processMessage(update.message!)).catch(error => console.error("telegram message failed", error)).finally(() => {
            if (queues.get(key) === next) queues.delete(key)
          })
          queues.set(key, next)
        }
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("telegram polling failed", error)
        await new Promise(resolve => setTimeout(resolve, 5_000))
      }
    }
  }

  async function checkReminders() {
    const targets = await listReminderTargets("telegram")
    for (const target of targets) {
      if (!target.conversationId) continue
      const sent = await dispatchDueReminders({
        workspaceId: target.workspaceId,
        channel: `telegram:${target.identityId}`,
        send: message => send(target.conversationId!, message),
      })
      if (sent) console.info(`telegram reminders sent: ${sent}`)
    }
  }

  return {
    async start() {
      const bot = await api<TelegramUser>("getMe")
      console.info(`telegram assistant ready as @${bot.username ?? bot.first_name}`)
      void poll()
      void checkReminders().catch(error => console.error("telegram initial reminder check failed", error))
      const interval = Math.max(Number(process.env.REMINDER_POLL_INTERVAL_MS) || 900_000, 60_000)
      reminderTimer = setInterval(() => void checkReminders().catch(error => console.error("telegram reminder check failed", error)), interval)
    },
    stop() {
      if (reminderTimer) clearInterval(reminderTimer)
      controller.abort()
    },
  }
}
