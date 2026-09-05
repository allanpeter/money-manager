import { updateOccurrence } from "@/lib/accounts/service"
import { getAuthContext } from "@/lib/auth/session"
import type { OccurrenceDeclaration } from "@/lib/accounts/types"

export const runtime = "nodejs"

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext()
  if (!auth) return Response.json({ error: "Não autenticado." }, { status: 401 })
  if (auth.role === "viewer") return Response.json({ error: "Acesso somente leitura." }, { status: 403 })
  try {
    const { id } = await context.params
    const body = await request.json() as Record<string, unknown>
    const declaration = body.declaration as OccurrenceDeclaration
    const paidAmountCents = body.paidAmountCents == null ? undefined : Number(body.paidAmountCents)
    const paidOn = typeof body.paidOn === "string" ? body.paidOn : undefined
    const expectedAmountCents = body.expectedAmountCents == null ? undefined : Number(body.expectedAmountCents)
    if (declaration !== null && declaration !== "paid" && declaration !== "no_charge") return Response.json({ error: "Declaração inválida." }, { status: 400 })
    if (declaration === "paid" && (!Number.isSafeInteger(paidAmountCents) || paidAmountCents! < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(paidOn ?? ""))) {
      return Response.json({ error: "Pagamento exige valor e data válidos." }, { status: 400 })
    }
    if (expectedAmountCents != null && (!Number.isSafeInteger(expectedAmountCents) || expectedAmountCents < 0)) {
      return Response.json({ error: "Valor previsto inválido." }, { status: 400 })
    }
    const occurrence = await updateOccurrence(auth.workspaceId, auth.userId, id, { declaration, paidAmountCents, paidOn, expectedAmountCents })
    if (!occurrence) return Response.json({ error: "Ocorrência não encontrada." }, { status: 404 })
    return Response.json(occurrence)
  } catch (error) {
    console.error("PATCH /api/accounts/occurrences/[id]", error)
    return Response.json({ error: "Não foi possível atualizar a ocorrência." }, { status: 500 })
  }
}
