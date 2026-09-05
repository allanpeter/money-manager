import { createIdentityLinkCode, type ExternalProvider } from "@/lib/auth/identities"
import { getAuthContext } from "@/lib/auth/session"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const auth = await getAuthContext()
  if (!auth) return Response.json({ error: "Não autenticado." }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { provider?: ExternalProvider }
  if (body.provider !== "discord" && body.provider !== "telegram") return Response.json({ error: "Canal inválido." }, { status: 400 })
  return Response.json(await createIdentityLinkCode({ userId: auth.userId, workspaceId: auth.workspaceId, provider: body.provider }))
}
