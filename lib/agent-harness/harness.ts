import type {
  Agent,
  AgentBudget,
  ContextBuilder,
  ModelClient,
  ModelResponse,
  SessionMessage,
  SessionState,
  SessionStore,
  ToolCall,
  ToolExecution,
  ToolRegistry,
} from "./contracts"

export interface AgentHarnessOptions {
  sessionStore: SessionStore
  toolRegistry: ToolRegistry
  contextBuilder: ContextBuilder
  modelClient: ModelClient
  /** Supplies the volatile suffix after the stable system-prompt prefix. */
  resolveSystemVolatile: (input: { sessionKey: string; session: SessionState }) => Promise<string> | string
  budget: AgentBudget
}

type BudgetDimension = "número máximo de voltas" | "orçamento de tokens" | "tempo máximo de execução"

interface BudgetState {
  turns: number
  tokens: number
  startedAt: number
}

function admittedFailure(dimension: BudgetDimension | "resposta do modelo") {
  return `Não consegui concluir a solicitação porque ${dimension === "resposta do modelo" ? "a resposta do modelo foi inválida" : `o limite de ${dimension} foi atingido`}.`
}

function validateBudget(budget: AgentBudget) {
  for (const [name, value] of Object.entries(budget)) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} deve ser um inteiro não negativo.`)
  }
}

function exceededBudget(budget: AgentBudget, state: BudgetState): BudgetDimension | undefined {
  if (state.turns >= budget.maxTurns) return "número máximo de voltas"
  if (state.tokens >= budget.maxTotalTokens) return "orçamento de tokens"
  if (Date.now() - state.startedAt >= budget.maxWallTimeMs) return "tempo máximo de execução"
  return undefined
}

function validateUsage(response: ModelResponse): boolean {
  return [response.usage.inputTokens, response.usage.outputTokens].every(value => Number.isSafeInteger(value) && value >= 0)
}

function sameIds(actual: readonly string[] | undefined, expected: readonly string[]): boolean {
  if (!actual) return false
  return actual.length === expected.length && actual.every((id, index) => id === expected[index])
}

function validToolCalls(response: ModelResponse): boolean {
  if (response.assistantMessage.kind !== "assistant") return false
  const ids = response.toolCalls.map(call => call.id)
  return ids.length > 0 && ids.every(id => id.length > 0) && new Set(ids).size === ids.length && sameIds(response.assistantMessage.toolCallIds, ids)
}

function errorResult(code: string, message: string): ToolExecution {
  return { ok: false, error: { code, message } }
}

async function executeTool(registry: ToolRegistry, call: ToolCall): Promise<ToolExecution> {
  try {
    return await registry.execute(call.name, call.input)
  } catch {
    return errorResult("TOOL_EXECUTION_FAILED", "A execução da ferramenta falhou.")
  }
}

/**
 * Creates a stateless-model harness. It owns only context assembly and the
 * tool-use loop; all prompt content, tools and model-provider details remain
 * at its boundaries.
 */
export function createAgentHarness(options: AgentHarnessOptions): Agent {
  validateBudget(options.budget)

  return async (sessionKey, userText) => {
    const state: BudgetState = { turns: 0, tokens: 0, startedAt: Date.now() }
    await options.sessionStore.append(sessionKey, [options.modelClient.createUserMessage(userText)])

    while (true) {
      const beforeModel = exceededBudget(options.budget, state)
      if (beforeModel) return admittedFailure(beforeModel)

      const session = await options.sessionStore.load(sessionKey)
      let volatile: string
      try {
        volatile = await options.resolveSystemVolatile({ sessionKey, session })
      } catch {
        return "Não consegui montar o contexto desta solicitação."
      }

      const afterVolatile = exceededBudget(options.budget, state)
      if (afterVolatile) return admittedFailure(afterVolatile)

      let response: ModelResponse
      try {
        response = await options.modelClient.complete(await options.contextBuilder.build({
          session,
          systemVolatile: volatile,
          toolDefinitions: options.toolRegistry.definitions(),
        }))
      } catch {
        return "Não consegui obter uma resposta do modelo."
      }

      state.turns += 1
      if (!validateUsage(response)) return admittedFailure("resposta do modelo")
      state.tokens += response.usage.inputTokens + response.usage.outputTokens

      if (response.stopReason !== "tool_use") {
        await options.sessionStore.append(sessionKey, [response.assistantMessage])
        return response.text || "Não consegui concluir a solicitação."
      }

      if (!validToolCalls(response)) return admittedFailure("resposta do modelo")
      // Persist before executing tools, including the calls-only assistant turn.
      await options.sessionStore.append(sessionKey, [response.assistantMessage])

      const exhaustedAfterResponse = exceededBudget(options.budget, state)
      const executions: Array<{ toolCallId: string; toolName: string; result: ToolExecution }> = []
      for (const call of response.toolCalls) {
        const exhaustedBeforeTool = exhaustedAfterResponse ?? exceededBudget(options.budget, state)
        const result = exhaustedBeforeTool
          ? errorResult("BUDGET_EXCEEDED", `A ferramenta não foi executada: ${exhaustedBeforeTool}.`)
          : await executeTool(options.toolRegistry, call)
        executions.push({ toolCallId: call.id, toolName: call.name, result })
      }

      let toolResultMessage: SessionMessage
      try {
        toolResultMessage = options.modelClient.createToolResultMessage(executions)
      } catch {
        return "Não consegui registrar o resultado das ferramentas."
      }
      if (toolResultMessage.kind !== "tool_result" || !sameIds(toolResultMessage.toolResultIds, response.toolCalls.map(call => call.id))) {
        return admittedFailure("resposta do modelo")
      }
      await options.sessionStore.append(sessionKey, [toolResultMessage])

      const afterTools = exceededBudget(options.budget, state)
      if (afterTools) return admittedFailure(afterTools)
    }
  }
}
