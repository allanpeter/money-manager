import { createFinancialProfile, listFinancialProfiles, type FinancialProfileType } from "@/lib/financial-profiles/service"
import { getAuthContext } from "@/lib/auth/session"

export const runtime = "nodejs"

export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return Response.json({ error: "Não autenticado." }, { status: 401 })
  return Response.json(await listFinancialProfiles(auth.workspaceId))
}

export async function POST(request: Request) {
  const auth = await getAuthContext()
  if (!auth) return Response.json({ error: "Não autenticado." }, { status: 401 })
  if (auth.role === "viewer") return Response.json({ error: "Acesso somente leitura." }, { status: 403 })
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const profile = await createFinancialProfile(auth.workspaceId, {
      name: typeof body.name === "string" ? body.name : "",
      type: body.type as FinancialProfileType,
      color: typeof body.color === "string" ? body.color : undefined,
    })
    return Response.json(profile, { status: 201 })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível criar o perfil." }, { status: 400 })
  }
}
