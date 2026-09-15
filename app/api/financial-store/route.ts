import { and, eq } from "drizzle-orm"
import { getAuthContext } from "@/lib/auth/session"
import { withWorkspace } from "@/lib/db"
import { financialStores } from "@/lib/db/schema"

export const runtime = "nodejs"

export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return Response.json({ error: "Não autenticado." }, { status: 401 })
  const [store] = await withWorkspace(auth.workspaceId, database => database.select({ data: financialStores.data, revision: financialStores.revision })
    .from(financialStores).where(eq(financialStores.workspaceId, auth.workspaceId)).limit(1))
  // O cliente precisa saber de quem são os dados: o mesmo navegador pode ter mais de uma conta.
  return Response.json({ data: store?.data ?? null, revision: store?.revision ?? 0, workspaceId: auth.workspaceId })
}

export async function PUT(request: Request) {
  const auth = await getAuthContext()
  if (!auth) return Response.json({ error: "Não autenticado." }, { status: 401 })
  if (auth.role === "viewer") return Response.json({ error: "Acesso somente leitura." }, { status: 403 })

  const body = await request.json().catch(() => null) as { data?: unknown; revision?: unknown } | null
  if (!body?.data || typeof body.data !== "object") return Response.json({ error: "Dados financeiros inválidos." }, { status: 400 })
  const revision = body.revision
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0) return Response.json({ error: "Sua versão do aplicativo está desatualizada. Recarregue a página antes de salvar." }, { status: 409 })
  const serialized = JSON.stringify(body.data)
  if (serialized.length > 1_500_000) return Response.json({ error: "Os dados financeiros excedem o limite de 1,5 MB." }, { status: 413 })

  const result = await withWorkspace(auth.workspaceId, async database => {
    const nextRevision = revision + 1
    if (revision === 0) {
      const [created] = await database.insert(financialStores).values({
        workspaceId: auth.workspaceId,
        data: body.data,
        revision: nextRevision,
        updatedAt: new Date(),
      }).onConflictDoNothing().returning({ revision: financialStores.revision })
      return created ? { revision: created.revision } : null
    }
    const [updated] = await database.update(financialStores).set({ data: body.data, revision: nextRevision, updatedAt: new Date() })
      .where(and(eq(financialStores.workspaceId, auth.workspaceId), eq(financialStores.revision, revision)))
      .returning({ revision: financialStores.revision })
    return updated ?? null
  })
  if (!result) return Response.json({ error: "Seus dados foram alterados em outra sessão. Recarregue a página antes de salvar." }, { status: 409 })
  return Response.json({ ok: true, revision: result.revision })
}
