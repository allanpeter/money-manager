import { eq } from "drizzle-orm"
import { getAuthContext } from "@/lib/auth/session"
import { withWorkspace } from "@/lib/db"
import { financialStores } from "@/lib/db/schema"

export const runtime = "nodejs"

export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return Response.json({ error: "Não autenticado." }, { status: 401 })
  const [store] = await withWorkspace(auth.workspaceId, database => database.select({ data: financialStores.data })
    .from(financialStores).where(eq(financialStores.workspaceId, auth.workspaceId)).limit(1))
  return Response.json({ data: store?.data ?? null })
}

export async function PUT(request: Request) {
  const auth = await getAuthContext()
  if (!auth) return Response.json({ error: "Não autenticado." }, { status: 401 })
  if (auth.role === "viewer") return Response.json({ error: "Acesso somente leitura." }, { status: 403 })

  const body = await request.json().catch(() => null) as { data?: unknown } | null
  if (!body?.data || typeof body.data !== "object") return Response.json({ error: "Dados financeiros inválidos." }, { status: 400 })
  const serialized = JSON.stringify(body.data)
  if (serialized.length > 1_500_000) return Response.json({ error: "Os dados financeiros excedem o limite de 1,5 MB." }, { status: 413 })

  await withWorkspace(auth.workspaceId, database => database.insert(financialStores).values({
    workspaceId: auth.workspaceId,
    data: body.data,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: financialStores.workspaceId,
    set: { data: body.data, updatedAt: new Date() },
  }))
  return Response.json({ ok: true })
}
