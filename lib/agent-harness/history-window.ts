import type { SessionMessage } from "./contracts"

/**
 * Keeps complete user turns only. A turn begins at a real user input, which
 * means a tool-use assistant message and its following tool results are never
 * split by the history window.
 */
export function windowHistoryByUserTurns(messages: readonly SessionMessage[], maxUserTurns: number): SessionMessage[] {
  if (!Number.isInteger(maxUserTurns) || maxUserTurns < 0) throw new Error("maxUserTurns deve ser um inteiro maior ou igual a zero.")
  if (maxUserTurns === 0) return []
  const starts = messages.flatMap((message, index) => message.kind === "user_input" ? [index] : [])
  if (starts.length <= maxUserTurns) return [...messages]
  return messages.slice(starts[starts.length - maxUserTurns])
}
