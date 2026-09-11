import { DefaultContextBuilder } from "../lib/agent-harness/context-builder"
import { createAgentHarness } from "../lib/agent-harness/harness"
import { InMemorySessionStore } from "../lib/agent-harness/in-memory-session-store"
import { ScriptedModelClient } from "../lib/agent-harness/scripted-model-client"
import { ExampleToolRegistry } from "../lib/agent-harness/tool-registry"

async function main() {
  const text = process.argv.slice(2).join(" ").trim() || "echo olá"
  const agent = createAgentHarness({
    sessionStore: new InMemorySessionStore(),
    toolRegistry: new ExampleToolRegistry(),
    contextBuilder: new DefaultContextBuilder({
      systemStable: "Você é um modelo de demonstração do harness.",
      maxHistoryUserTurns: 4,
    }),
    modelClient: new ScriptedModelClient(),
    resolveSystemVolatile: () => "Contexto volátil da demonstração.",
    budget: { maxTurns: 4, maxTotalTokens: 1_000, maxWallTimeMs: 10_000 },
  })

  console.log(await agent("cli-demo", text))
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
