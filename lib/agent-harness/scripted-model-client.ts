import type { ContextPayload, ModelClient, ModelResponse, SessionMessage, ToolExecution } from "./contracts"

type TextBlock = { type: "text"; text: string }
type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: unknown }
type ToolResultBlock = { type: "tool_result"; tool_use_id: string; is_error: boolean; content: unknown }

function textFrom(message: SessionMessage) {
  const block = message.content.find((item): item is TextBlock => typeof item === "object" && item !== null && "type" in item && (item as { type?: unknown }).type === "text")
  return block?.text ?? ""
}

function toolResultsFrom(message: SessionMessage) {
  return message.content.filter((item): item is ToolResultBlock => typeof item === "object" && item !== null && "type" in item && (item as { type?: unknown }).type === "tool_result")
}

/** Deterministic fake adapter for CLI and harness tests; it makes no network calls. */
export class ScriptedModelClient implements ModelClient {
  private nextCall = 1

  createUserMessage(text: string): SessionMessage {
    return { role: "user", kind: "user_input", content: [{ type: "text", text } satisfies TextBlock] }
  }

  createToolResultMessage(results: ReadonlyArray<{ toolCallId: string; toolName: string; result: ToolExecution }>): SessionMessage {
    const content: ToolResultBlock[] = results.map(item => ({
      type: "tool_result",
      tool_use_id: item.toolCallId,
      is_error: !item.result.ok,
      content: item.result.ok ? item.result.output : item.result.error,
    }))
    return { role: "user", kind: "tool_result", content, toolResultIds: results.map(item => item.toolCallId) }
  }

  async complete(context: ContextPayload): Promise<ModelResponse> {
    const callId = `tool-${this.nextCall++}`
    if (context.currentUserMessage.kind === "user_input") {
      const text = textFrom(context.currentUserMessage)
      if (text.startsWith("echo ")) {
        const input = { value: text.slice(5) }
        const rawBlock: ToolUseBlock = { type: "tool_use", id: callId, name: "echo", input }
        return {
          stopReason: "tool_use",
          assistantMessage: { role: "assistant", kind: "assistant", content: [rawBlock], toolCallIds: [callId] },
          toolCalls: [{ id: callId, name: "echo", input, rawBlock }],
          usage: { inputTokens: 4, outputTokens: 2 },
          text: "",
        }
      }
    }

    if (context.currentUserMessage.kind === "tool_result") {
      const [result] = toolResultsFrom(context.currentUserMessage)
      const text = result?.is_error ? `A ferramenta falhou: ${JSON.stringify(result.content)}` : `Ferramenta concluída: ${JSON.stringify(result?.content)}`
      return {
        stopReason: "end_turn",
        assistantMessage: { role: "assistant", kind: "assistant", content: [{ type: "text", text } satisfies TextBlock] },
        toolCalls: [],
        usage: { inputTokens: 4, outputTokens: 8 },
        text,
      }
    }

    const text = "Demo concluída sem ferramentas. Para exercitar o loop, use: echo alguma coisa"
    return {
      stopReason: "end_turn",
      assistantMessage: { role: "assistant", kind: "assistant", content: [{ type: "text", text } satisfies TextBlock] },
      toolCalls: [],
      usage: { inputTokens: 4, outputTokens: 8 },
      text,
    }
  }
}
