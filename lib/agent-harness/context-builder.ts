import type { ContextBuilder, ContextPayload, SessionState, SystemPrompt, ToolDefinition } from "./contracts"
import { windowHistoryByUserTurns } from "./history-window"

export interface DefaultContextBuilderOptions {
  systemStable: string
  maxHistoryUserTurns: number
}

/** Builds the four context slices without knowing any domain or provider API. */
export class DefaultContextBuilder implements ContextBuilder {
  constructor(private readonly options: DefaultContextBuilderOptions) {}

  async build(input: { session: SessionState; systemVolatile: string; toolDefinitions: readonly ToolDefinition[] }): Promise<ContextPayload> {
    const currentUserMessage = input.session.messages.at(-1)
    if (!currentUserMessage || (currentUserMessage.kind !== "user_input" && currentUserMessage.kind !== "tool_result")) {
      throw new Error("A sessão precisa terminar em uma mensagem do usuário ou em resultados de ferramenta.")
    }
    const prior = input.session.messages.slice(0, -1)
    const system: SystemPrompt = { stable: this.options.systemStable, volatile: input.systemVolatile }
    return {
      system,
      tools: input.toolDefinitions,
      history: windowHistoryByUserTurns(prior, this.options.maxHistoryUserTurns),
      currentUserMessage,
    }
  }
}
