import { createDiscordChannel } from "@/lib/channels/discord"
import { createTelegramChannel } from "@/lib/channels/telegram"
import { closeDatabase } from "@/lib/db"

const channels = [
  process.env.DISCORD_BOT_TOKEN?.trim() ? createDiscordChannel() : null,
  process.env.TELEGRAM_BOT_TOKEN?.trim() ? createTelegramChannel() : null,
].filter((channel): channel is NonNullable<typeof channel> => channel != null)

if (!channels.length) throw new Error("Configure DISCORD_BOT_TOKEN ou TELEGRAM_BOT_TOKEN")

async function shutdown(signal: string) {
  console.info(`received ${signal}; shutting down assistant`)
  for (const channel of channels) channel.stop()
  await closeDatabase()
  process.exit(0)
}

process.once("SIGINT", () => void shutdown("SIGINT"))
process.once("SIGTERM", () => void shutdown("SIGTERM"))

Promise.all(channels.map(channel => channel.start())).catch(error => {
  console.error("assistant startup failed", error)
  process.exit(1)
})
