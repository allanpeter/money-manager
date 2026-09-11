import assert from "node:assert/strict"
import test from "node:test"
import type { ContextPayload, ModelResponse, ToolDefinition, ToolExecution, ToolRegistry } from "./contracts"
import { DefaultContextBuilder } from "./context-builder"
import { createAgentHarness } from "./harness"
import { windowHistoryByUserTurns } from "./history-window"
import { InMemorySessionStore } from "./in-memory-session-store"
import { ScriptedModelClient } from "./scripted-model-client"
import { ExampleToolRegistry } from "./tool-registry"

class RecordingModelClient extends ScriptedModelClient {
  readonly contexts: ContextPayload[] = []

  override async complete(context: ContextPayload): Promise<ModelResponse> {
    this.contexts.push(context)
    return super.complete(context)
  }
}

function buildHarness(registry: ToolRegistry = new ExampleToolRegistry(), budget = { maxTurns: 4, maxTotalTokens: 100, maxWallTimeMs: 10_000 }) {
  const store = new InMemorySessionStore()
  const model = new RecordingModelClient()
  const agent = createAgentHarness({
    sessionStore: store,
    toolRegistry: registry,
    modelClient: model,
    contextBuilder: new DefaultContextBuilder({ systemStable: "Stable prefix", maxHistoryUserTurns: 2 }),
    resolveSystemVolatile: () => "volatile suffix",
    budget,
  })
  return { agent, model, store }
}

test("persiste blocos crus e fecha cada tool_use com seu tool_result", async () => {
  const { agent, model, store } = buildHarness()

  assert.equal(await agent("session-a", "echo olá"), "Ferramenta concluída: \"olá\"")
  const session = await store.load("session-a")
  assert.deepEqual(session.messages.map(message => message.kind), ["user_input", "assistant", "tool_result", "assistant"])
  assert.deepEqual(session.messages[1].toolCallIds, ["tool-1"])
  assert.deepEqual(session.messages[2].toolResultIds, ["tool-1"])
  assert.deepEqual(session.messages[1].content, [{ type: "tool_use", id: "tool-1", name: "echo", input: { value: "olá" } }])
  assert.deepEqual(session.messages[2].content, [{ type: "tool_result", tool_use_id: "tool-1", is_error: false, content: "olá" }])
  assert.equal(model.contexts[0].system.stable, "Stable prefix")
  assert.equal(model.contexts[0].system.volatile, "volatile suffix")
  assert.equal(model.contexts[0].tools[0]?.name, "echo")
  assert.equal(model.contexts[1].currentUserMessage.kind, "tool_result")
})

test("falha da ferramenta é devolvida ao modelo como resultado com erro", async () => {
  const definition: ToolDefinition = { name: "echo", description: "test", inputSchema: {} }
  const failingRegistry: ToolRegistry = {
    definitions: () => [definition],
    execute: async (): Promise<ToolExecution> => { throw new Error("boom") },
  }
  const { agent, store } = buildHarness(failingRegistry)

  assert.match(await agent("session-b", "echo teste"), /A ferramenta falhou/)
  const session = await store.load("session-b")
  assert.deepEqual(session.messages[2].toolResultIds, ["tool-1"])
  assert.deepEqual(session.messages[2].content, [{
    type: "tool_result",
    tool_use_id: "tool-1",
    is_error: true,
    content: { code: "TOOL_EXECUTION_FAILED", message: "A execução da ferramenta falhou." },
  }])
})

test("ao estourar voltas, registra os resultados pendentes e admite a falha", async () => {
  const { agent, store } = buildHarness(new ExampleToolRegistry(), { maxTurns: 1, maxTotalTokens: 100, maxWallTimeMs: 10_000 })

  assert.match(await agent("session-c", "echo limite"), /limite de número máximo de voltas/)
  const session = await store.load("session-c")
  assert.deepEqual(session.messages.map(message => message.kind), ["user_input", "assistant", "tool_result"])
  assert.deepEqual(session.messages[1].toolCallIds, session.messages[2].toolResultIds)
})

test("a janela começa apenas em entrada real do usuário", () => {
  const messages = [
    { role: "user", kind: "user_input" as const, content: [{ type: "text", text: "primeira" }] },
    { role: "assistant", kind: "assistant" as const, content: [{ type: "tool_use", id: "one" }], toolCallIds: ["one"] },
    { role: "user", kind: "tool_result" as const, content: [{ type: "tool_result", tool_use_id: "one" }], toolResultIds: ["one"] },
    { role: "assistant", kind: "assistant" as const, content: [{ type: "text", text: "fim" }] },
    { role: "user", kind: "user_input" as const, content: [{ type: "text", text: "segunda" }] },
  ]

  assert.deepEqual(windowHistoryByUserTurns(messages, 1), [messages[4]])
  assert.deepEqual(windowHistoryByUserTurns(messages, 2), messages)
})
