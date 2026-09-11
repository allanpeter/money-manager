import { access, chmod, writeFile } from "node:fs/promises"
import { constants } from "node:fs"

const output = ".env.local"
const password = process.env.PG_MONEY_MANAGER_DEV_PASSWORD

if (!password) throw new Error("PG_MONEY_MANAGER_DEV_PASSWORD não configurada")

try {
  await access(output, constants.F_OK)
  throw new Error(`${output} já existe. Remova-o ou atualize-o manualmente.`)
} catch (error) {
  if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error
}

const url = new URL("postgres://money_manager_dev@192.168.0.41:5432/money_manager_dev")
url.password = password
await writeFile(output, [
  "# Gerado por npm run env:dev. Nunca versione este arquivo.",
  `DATABASE_URL=${url.toString()}`,
  "DATABASE_SSL=false",
  "",
  "# Evita que uma execução local replique o bot ou os lembretes de produção.",
  "DISCORD_BOT_TOKEN=",
  "TELEGRAM_BOT_TOKEN=",
  "ASSISTANT_DISABLE_REMINDERS=true",
  "",
].join("\n"), { mode: 0o600 })
await chmod(output, 0o600)
console.info(`${output} criado para money_manager_dev.`)
