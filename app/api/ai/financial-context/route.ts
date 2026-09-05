import { getAuthContext } from "@/lib/auth/session"
import { getFinancialAssistantContext } from "@/lib/financial-api/assistant-gateway"
import { currentMonthId } from "@/lib/months"

export const runtime = "nodejs"

/**
 * Read-only contract for AI consumers. This is deliberately limited to the
 * authenticated workspace's financial scope; it never returns users, sessions,
 * integrations, configuration or internal identifiers.
 */
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return Response.json({ error: "Não autenticado." }, { status: 401 })
  const context = await getFinancialAssistantContext(auth.workspaceId)
  return Response.json({
    monthId: currentMonthId(),
    wallets: context.wallets.map(wallet => ({ name: wallet.name })),
  })
}
