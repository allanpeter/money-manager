import { getAuthContext } from "@/lib/auth/session"
import { executeFinancialAssistantAction, isFinancialAssistantAction, isFinancialAssistantMutation } from "@/lib/financial-api/assistant-gateway"

export const runtime = "nodejs"

/**
 * Write/query contract limited to the explicit assistant financial operations.
 * The workspace comes only from the authenticated session, never from request
 * input, which preserves multi-user isolation.
 */
export async function POST(request: Request) {
  const auth = await getAuthContext()
  if (!auth) return Response.json({ error: "Não autenticado." }, { status: 401 })
  const body = await request.json().catch(() => null) as { action?: unknown } | null
  if (!isFinancialAssistantAction(body?.action)) return Response.json({ error: "Ação financeira não autorizada." }, { status: 400 })
  if (auth.role === "viewer" && isFinancialAssistantMutation(body.action)) return Response.json({ error: "Acesso somente leitura." }, { status: 403 })

  try {
    const result = await executeFinancialAssistantAction(auth.workspaceId, body.action)
    return Response.json({ message: result.message, storeUpdated: result.changed })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível executar a ação." }, { status: 400 })
  }
}
