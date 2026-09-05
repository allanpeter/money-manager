import { randomUUID } from "node:crypto"
import { getAuthContext } from "@/lib/auth/session"
import { handleDashboardAssistantMessage } from "@/lib/dashboard-assistant/service"

export const runtime = "nodejs"

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/

export async function POST(request: Request) {
  const auth = await getAuthContext()
  if (!auth) return Response.json({ error: "Não autenticado." }, { status: 401 })

  const body = await request.json().catch(() => null) as { text?: unknown; requestId?: unknown } | null
  const text = typeof body?.text === "string" ? body.text.trim() : ""
  if (!text) return Response.json({ error: "Envie uma mensagem em texto." }, { status: 400 })
  if (text.length > 4000) return Response.json({ error: "A mensagem deve ter no máximo 4.000 caracteres." }, { status: 400 })

  const requestId = typeof body?.requestId === "string" && REQUEST_ID_PATTERN.test(body.requestId)
    ? body.requestId
    : randomUUID()

  const result = await handleDashboardAssistantMessage({
    userId: auth.userId,
    workspaceId: auth.workspaceId,
    role: auth.role,
    channel: "web",
    conversationKey: `${auth.workspaceId}:${auth.userId}`,
    externalMessageId: requestId,
    externalUserId: auth.userId,
    text,
  })

  return Response.json(result)
}
