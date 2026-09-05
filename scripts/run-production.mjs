import { spawn } from "node:child_process"

const children = []
let stopping = false
let exitCode = 0

function start(command, args) {
  const child = spawn(command, args, { stdio: "inherit" })
  children.push(child)
  child.once("error", error => {
    console.error(`failed to start ${command}`, error)
    stop(1)
  })
  child.once("exit", (code, signal) => {
    if (stopping) return
    console.error(`${command} exited${signal ? ` from ${signal}` : ` with code ${code ?? 1}`}`)
    stop(code ?? 1)
  })
  return child
}

function stop(code = 0) {
  if (stopping) return
  stopping = true
  exitCode = code
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill("SIGTERM")
  }
  const forceTimer = setTimeout(() => {
    for (const child of children) {
      if (child.exitCode === null && !child.killed) child.kill("SIGKILL")
    }
  }, 10_000)
  forceTimer.unref()
  Promise.all(children.map(child => (
    child.exitCode !== null || child.signalCode !== null
      ? Promise.resolve()
      : new Promise(resolve => child.once("close", resolve))
  )))
    .finally(() => process.exit(exitCode))
}

process.once("SIGINT", () => stop(0))
process.once("SIGTERM", () => stop(0))

start(process.execPath, ["server.js"])

if (process.env.DISCORD_BOT_TOKEN?.trim() || process.env.TELEGRAM_BOT_TOKEN?.trim()) {
  start(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/assistant.ts"])
} else {
  console.info("assistant disabled: configure DISCORD_BOT_TOKEN or TELEGRAM_BOT_TOKEN to enable it")
}
