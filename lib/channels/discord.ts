import { Client, Events, GatewayIntentBits, Partials, type Message, type SendableChannels } from "discord.js"
import { handleDashboardAssistantMessage, handleDashboardInvoiceAttachment } from "@/lib/dashboard-assistant/service"
import { bootstrapExternalIdentity, claimIdentityLink, listReminderTargets, resolveExternalIdentity } from "@/lib/auth/identities"
import { dispatchDueReminders } from "@/lib/reminders/service"

const MAX_MESSAGE_LENGTH = 1900
const MAX_INVOICE_ATTACHMENT_SIZE = 5 * 1024 * 1024

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} não configurada`)
  return value
}

function chunks(message: string) {
  if (message.length <= MAX_MESSAGE_LENGTH) return [message]
  const result: string[] = []
  let current = ""
  for (const line of message.split("\n")) {
    if (current && current.length + line.length + 1 > MAX_MESSAGE_LENGTH) {
      result.push(current)
      current = ""
    }
    if (line.length > MAX_MESSAGE_LENGTH) {
      if (current) result.push(current)
      for (let index = 0; index < line.length; index += MAX_MESSAGE_LENGTH) result.push(line.slice(index, index + MAX_MESSAGE_LENGTH))
    } else {
      current = current ? `${current}\n${line}` : line
    }
  }
  if (current) result.push(current)
  return result
}

async function sendChunks(channel: SendableChannels, message: string) {
  for (const chunk of chunks(message)) await channel.send({ content: chunk, allowedMentions: { parse: [] } })
}

async function downloadInvoiceAttachment(message: Message) {
  if (message.attachments.size !== 1) throw new Error("Envie somente um arquivo por vez.")
  const attachment = message.attachments.first()
  if (!attachment) throw new Error("Não encontrei o arquivo anexado.")
  if (!attachment.name) throw new Error("O anexo precisa ter um nome de arquivo.")
  if (attachment.size > MAX_INVOICE_ATTACHMENT_SIZE) throw new Error("O arquivo deve ter no máximo 5 MB.")
  const response = await fetch(attachment.url, { signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error("Não foi possível baixar o anexo do Discord.")
  const length = Number(response.headers.get("content-length") ?? 0)
  if (length > MAX_INVOICE_ATTACHMENT_SIZE) throw new Error("O arquivo deve ter no máximo 5 MB.")
  const bytes = Buffer.from(await response.arrayBuffer())
  if (!bytes.length) throw new Error("O arquivo está vazio.")
  if (bytes.length > MAX_INVOICE_ATTACHMENT_SIZE) throw new Error("O arquivo deve ter no máximo 5 MB.")
  return { filename: attachment.name, bytes }
}

export function createDiscordChannel() {
  const token = required("DISCORD_BOT_TOKEN")
  const allowedUsers = new Set((process.env.DISCORD_ALLOWED_USER_IDS ?? "").split(",").map(value => value.trim()).filter(Boolean))
  const commandChannelId = process.env.DISCORD_CHANNEL_ID?.trim() || null
  const reminderChannelId = process.env.DISCORD_REMINDER_CHANNEL_ID?.trim() || commandChannelId
  const remindersEnabled = process.env.ASSISTANT_DISABLE_REMINDERS !== "true"

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  })
  const queues = new Map<string, Promise<void>>()
  let reminderTimer: NodeJS.Timeout | undefined

  async function reply(message: Message, content: string) {
    for (const chunk of chunks(content)) {
      await message.reply({ content: chunk, allowedMentions: { repliedUser: false, parse: [] } })
    }
  }

  async function processMessage(message: Message) {
    if (message.author.bot) return
    if (commandChannelId && message.channelId !== commandChannelId && message.guildId) return
    const text = message.content.trim()

    const linkMatch = text.match(/^\/?vincular\s+([a-z0-9-]+)$/i)
    if (linkMatch) {
      try {
        await claimIdentityLink({
          provider: "discord",
          code: linkMatch[1],
          externalUserId: message.author.id,
          conversationId: message.channelId,
          displayName: message.author.username,
        })
        await reply(message, "Discord vinculado ao seu usuário. A partir de agora só acessarei o seu espaço financeiro.")
      } catch (error) {
        await reply(message, error instanceof Error ? error.message : "Não foi possível concluir o vínculo.")
      }
      return
    }

    let identity = await resolveExternalIdentity({ provider: "discord", externalUserId: message.author.id, conversationId: message.channelId })
    if (!identity) identity = await bootstrapExternalIdentity({
      provider: "discord",
      externalUserId: message.author.id,
      conversationId: message.channelId,
      allowedIds: allowedUsers,
      displayName: message.author.username,
    })
    if (!identity) {
      await reply(message, "Seu Discord ainda não está vinculado. Entre no Money Manager, abra Configurações e gere um código de vínculo.")
      return
    }

    if (message.attachments.size) {
      try {
        const attachment = await downloadInvoiceAttachment(message)
        const result = await handleDashboardInvoiceAttachment({
          userId: identity.userId,
          workspaceId: identity.workspaceId,
          role: identity.role,
          channel: "discord",
          conversationKey: message.channelId,
          externalMessageId: message.id,
          externalUserId: message.author.id,
          text,
        }, attachment)
        if (!result.duplicate) await reply(message, result.message)
      } catch (error) {
        await reply(message, error instanceof Error ? error.message : "Não foi possível ler o anexo.")
      }
      return
    }
    if (!text) return

    if ("sendTyping" in message.channel && typeof message.channel.sendTyping === "function") {
      await message.channel.sendTyping().catch(() => undefined)
    }
    const result = await handleDashboardAssistantMessage({
      userId: identity.userId,
      workspaceId: identity.workspaceId,
      role: identity.role,
      channel: "discord",
      conversationKey: message.channelId,
      externalMessageId: message.id,
      externalUserId: message.author.id,
      text,
    })
    // Discord may redeliver an event, or another worker may already own it.
    // The database command key makes this idempotent; the duplicate stays silent.
    if (!result.duplicate) await reply(message, result.message)
  }

  client.on(Events.MessageCreate, message => {
    const key = `${message.channelId}:${message.author.id}`
    const previous = queues.get(key) ?? Promise.resolve()
    const next = previous.then(() => processMessage(message)).catch(error => console.error("discord message failed", error)).finally(() => {
      if (queues.get(key) === next) queues.delete(key)
    })
    queues.set(key, next)
  })

  async function checkReminders() {
    const targets = await listReminderTargets("discord")
    for (const target of targets) {
      if (!target.conversationId) continue
      const channel = await client.channels.fetch(target.conversationId)
      if (!channel?.isSendable()) continue
      const sent = await dispatchDueReminders({
        workspaceId: target.workspaceId,
        channel: `discord:${target.identityId}`,
        send: message => sendChunks(channel, message),
      })
      if (sent) console.info(`discord reminders sent: ${sent}`)
    }
  }

  client.once(Events.ClientReady, readyClient => {
    console.info(`discord assistant ready as ${readyClient.user.tag}`)
    if (reminderChannelId) {
      for (const externalUserId of allowedUsers) {
        void bootstrapExternalIdentity({ provider: "discord", externalUserId, conversationId: reminderChannelId, allowedIds: allowedUsers })
          .catch(error => console.error("discord bootstrap identity failed", error))
      }
    }
    if (!remindersEnabled) {
      console.info("discord reminders disabled")
      return
    }
    void checkReminders().catch(error => console.error("initial reminder check failed", error))
    const interval = Math.max(Number(process.env.REMINDER_POLL_INTERVAL_MS) || 900_000, 60_000)
    reminderTimer = setInterval(() => void checkReminders().catch(error => console.error("reminder check failed", error)), interval)
  })

  return {
    start: () => client.login(token),
    stop: () => {
      if (reminderTimer) clearInterval(reminderTimer)
      client.destroy()
    },
  }
}
