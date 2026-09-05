import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/auth/session"
import { createAccount, loadAccountsGrid } from "@/lib/accounts/service"
import type { AccountNature, AccountType } from "@/lib/accounts/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function invalid(message: string) { return Response.json({ error: message }, { status: 400 }) }

export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return Response.json({ error: "Não autenticado." }, { status: 401 })
  const year = Number(request.nextUrl.searchParams.get("year") ?? new Date().getFullYear())
  const profile = request.nextUrl.searchParams.get("profile")
  if (!Number.isInteger(year) || year < 2000 || year > 2200) return invalid("Ano inválido.")
  if (profile != null && profile !== "all" && !/^[0-9a-f-]{36}$/i.test(profile)) return invalid("Perfil inválido.")
  try {
    return Response.json(await loadAccountsGrid(auth.workspaceId, year, profile === "all" || profile == null ? null : profile))
  } catch (error) {
    console.error("GET /api/accounts", error)
    return Response.json({ error: "Não foi possível carregar as contas." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await getAuthContext()
  if (!auth) return Response.json({ error: "Não autenticado." }, { status: 401 })
  if (auth.role === "viewer") return Response.json({ error: "Acesso somente leitura." }, { status: 403 })
  try {
    const body = await request.json() as Record<string, unknown>
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const profileId = typeof body.profileId === "string" ? body.profileId : ""
    const walletId = typeof body.walletId === "string" ? body.walletId : ""
    const categoryId = typeof body.categoryId === "string" ? body.categoryId : ""
    const dueDay = body.dueDay == null || body.dueDay === "" ? null : Number(body.dueDay)
    const closingDay = body.closingDay == null || body.closingDay === "" ? null : Number(body.closingDay)
    const plannedAmountCents = Number(body.plannedAmountCents)
    const nature = body.nature as AccountNature
    const accountType = body.accountType as AccountType
    const startMonth = typeof body.startMonth === "string" ? body.startMonth : ""
    const installments = body.installments == null || body.installments === "" ? null : Number(body.installments)
    if (!name || !profileId || !walletId || !categoryId || !/^\d{4}-\d{2}$/.test(startMonth)) return invalid("Preencha perfil, nome, carteira, categoria e mês inicial.")
    if (!Number.isSafeInteger(plannedAmountCents) || plannedAmountCents < 0) return invalid("Valor previsto inválido.")
    if (dueDay != null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) return invalid("Dia de vencimento inválido.")
    if (closingDay != null && (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31)) return invalid("Dia de fechamento inválido.")
    if (!(["fixed", "variable", "installment", "one_off"] as string[]).includes(nature)) return invalid("Natureza inválida.")
    if (!(["regular", "credit_card"] as string[]).includes(accountType)) return invalid("Tipo inválido.")
    if (nature === "installment" && (!Number.isInteger(installments) || !installments || installments < 1)) return invalid("Informe a quantidade de parcelas.")
    const account = await createAccount(auth.workspaceId, auth.userId, { profileId, name, walletId, categoryId, dueDay, closingDay, plannedAmountCents, nature, accountType, startMonth, installments })
    return Response.json(account, { status: 201 })
  } catch (error) {
    console.error("POST /api/accounts", error)
    return Response.json({ error: "Não foi possível criar a conta." }, { status: 500 })
  }
}
