import type { SessionMessage, SessionState, SessionStore } from "./contracts"

function cloneMessage(message: SessionMessage): SessionMessage {
  return {
    ...message,
    content: [...message.content],
    toolCallIds: message.toolCallIds ? [...message.toolCallIds] : undefined,
    toolResultIds: message.toolResultIds ? [...message.toolResultIds] : undefined,
  }
}

/** Minimal store for demos and tests. It deliberately has no persistence. */
export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, SessionMessage[]>()

  async load(sessionKey: string): Promise<SessionState> {
    return { key: sessionKey, messages: (this.sessions.get(sessionKey) ?? []).map(cloneMessage) }
  }

  async append(sessionKey: string, messages: readonly SessionMessage[]): Promise<void> {
    const current = this.sessions.get(sessionKey) ?? []
    this.sessions.set(sessionKey, [...current, ...messages.map(cloneMessage)])
  }

  async reset(sessionKey: string): Promise<void> {
    this.sessions.delete(sessionKey)
  }
}
