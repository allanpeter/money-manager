import { updateAccountClosingDay, updateAccountDueDay } from "@/lib/accounts/service"
import { getAuthContext } from "@/lib/auth/session"

export const runtime = "nodejs"

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext()
  if (!auth) return Response.json({ error: "Não autenticado." }, { status: 401 })
  if (auth.role === "viewer") return Response.json({ error: "Acesso somente leitura." }, { status: 403 })
  try {
    const { id } = await context.params
    const body = await request.json() as { dueDay?: unknown; closingDay?: unknown }
    const hasClosingDay = Object.hasOwn(body, "closingDay")
    const value = hasClosingDay ? body.closingDay : body.dueDay
    const day = value == null ? null : Number(value)
    if (day != null && (!Number.isInteger(day) || day < 1 || day > 31)) return Response.json({ error: `Dia de ${hasClosingDay ? "fechamento" : "vencimento"} inválido.` }, { status: 400 })
    const account = hasClosingDay ? await updateAccountClosingDay(auth.workspaceId, id, day) : await updateAccountDueDay(auth.workspaceId, id, day)
    if (!account) return Response.json({ error: "Conta não encontrada." }, { status: 404 })
    return Response.json(account)
  } catch (error) {
    console.error("PATCH /api/accounts/[id]", error)
    return Response.json({ error: "Não foi possível atualizar a conta." }, { status: 500 })
  }
}
