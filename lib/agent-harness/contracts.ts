/** Provider-native blocks are retained unchanged inside session messages. */
export type RawApiBlock = unknown

export type SessionMessageKind = "user_input" | "assistant" | "tool_result"

export interface SessionMessage {
  /** Role expected by the model adapter. The harness does not interpret it. */
  role: string
  /** Raw, provider-native content blocks. */
  content: readonly RawApiBlock[]
  /** Harness metadata; it never replaces or transforms `content`. */
  kind: SessionMessageKind
  /** Present on assistant messages containing tool calls. */
  toolCallIds?: readonly string[]
  /** Present on the immediately following tool-result message. */
  toolResultIds?: readonly string[]
}

export interface SessionState {
  key: string
  messages: readonly SessionMessage[]
}

export interface SessionStore {
  load(sessionKey: string): Promise<SessionState>
  append(sessionKey: string, messages: readonly SessionMessage[]): Promise<void>
  reset(sessionKey: string): Promise<void>
}

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export type ToolExecution =
  | { ok: true; output: unknown }
  | { ok: false; error: { code: string; message: string } }

export interface ToolRegistry {
  definitions(): readonly ToolDefinition[]
  execute(name: string, input: unknown): Promise<ToolExecution>
}

export interface ToolCall {
  id: string
  name: string
  input: unknown
  rawBlock: RawApiBlock
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

export interface ModelResponse {
  stopReason: string
  /** Raw assistant message, including tool-use blocks when present. */
  assistantMessage: SessionMessage
  toolCalls: readonly ToolCall[]
  usage: TokenUsage
  text: string
}

export interface SystemPrompt {
  /** Stable prefix, intentionally placed first for provider prompt caching. */
  stable: string
  /** Per-call data injected by the harness owner. */
  volatile: string
}

export interface ContextPayload {
  system: SystemPrompt
  tools: readonly ToolDefinition[]
  history: readonly SessionMessage[]
  /** Last user-role message: real input on first call, tool results on follow-ups. */
  currentUserMessage: SessionMessage
}

export interface ContextBuilder {
  build(input: {
    session: SessionState
    systemVolatile: string
    toolDefinitions: readonly ToolDefinition[]
  }): Promise<ContextPayload>
}

/** Adapter boundary for any concrete LLM provider. */
export interface ModelClient {
  createUserMessage(text: string): SessionMessage
  createToolResultMessage(results: ReadonlyArray<{
    toolCallId: string
    toolName: string
    result: ToolExecution
  }>): SessionMessage
  complete(context: ContextPayload): Promise<ModelResponse>
}

export interface AgentBudget {
  /** Maximum number of model calls in one Agent invocation. */
  maxTurns: number
  maxTotalTokens: number
  maxWallTimeMs: number
}

export type Agent = (sessionKey: string, userText: string) => Promise<string>
