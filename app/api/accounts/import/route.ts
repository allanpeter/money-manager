import { and, eq } from "drizzle-orm"
import { withWorkspace } from "@/lib/db"
import { getAuthContext } from "@/lib/auth/session"
import { accountCategories, accountOccurrences, accounts, importBatches, importIssues, wallets } from "@/lib/db/schema"
import { parseOfficialWorkbook } from "@/lib/accounts/import-xlsx"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const auth = await getAuthContext()
  if (!auth) return Response.json({ error: "Não autenticado." }, { status: 401 })
  if (auth.role === "viewer") return Response.json({ error: "Acesso somente leitura." }, { status: 403 })
  try {
    const form = await request.formData()
    const file = form.get("file")
    const walletId = String(form.get("walletId") ?? "")
    const categoryId = String(form.get("categoryId") ?? "")
    const profileId = String(form.get("profileId") ?? "")
    const year = Number(form.get("year"))
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) return Response.json({ error: "Selecione um arquivo XLSX." }, { status: 400 })
    if (!profileId || !walletId || !categoryId || !Number.isInteger(year)) return Response.json({ error: "Informe perfil, carteira, categoria e ano." }, { status: 400 })
    const parsed = await parseOfficialWorkbook(Buffer.from(await file.arrayBuffer()), year)
    const result = await withWorkspace(auth.workspaceId, async transaction => {
      const [wallet, category, duplicate] = await Promise.all([
        transaction.select({ id: wallets.id }).from(wallets).where(and(eq(wallets.id, walletId), eq(wallets.profileId, profileId))).limit(1),
        transaction.select({ id: accountCategories.id }).from(accountCategories).where(and(eq(accountCategories.id, categoryId), eq(accountCategories.profileId, profileId))).limit(1),
        transaction.select({ id: importBatches.id }).from(importBatches).where(eq(importBatches.checksum, parsed.checksum)).limit(1),
      ])
      if (!wallet.length || !category.length) throw new Error("Carteira ou categoria não encontrada.")
      if (duplicate.length) throw new Error(`Este arquivo já foi importado. Lote ${duplicate[0].id}`)
      const [batch] = await transaction.insert(importBatches).values({
        workspaceId: auth.workspaceId,
        filename: file.name, checksum: parsed.checksum,
        summary: { accounts: parsed.accounts.length, issues: parsed.issues.length },
      }).returning()
      let occurrenceCount = 0
      for (const draft of parsed.accounts) {
        const [account] = await transaction.insert(accounts).values({
          workspaceId: auth.workspaceId, profileId, createdByUserId: auth.userId,
          name: draft.name, walletId, categoryId, dueDay: null,
          plannedAmountCents: draft.plannedAmountCents, nature: draft.nature,
          accountType: draft.accountType, startMonth: `${year}-01-01`, installments: null,
        }).returning()
        for (const occurrence of draft.occurrences) {
          await transaction.insert(accountOccurrences).values({
            workspaceId: auth.workspaceId,
            accountId: account.id, referenceMonth: `${occurrence.referenceMonth}-01`,
            expectedAmountCents: occurrence.expectedAmountCents, expectedSource: "import",
            declaration: occurrence.declaration,
            paidAmountCents: occurrence.declaration === "paid" ? occurrence.expectedAmountCents : null,
            paidOn: null, legacyPaymentDateMissing: occurrence.legacyPaymentDateMissing,
            resolvedAt: occurrence.declaration ? new Date() : null, importBatchId: batch.id,
          })
          occurrenceCount++
        }
      }
      if (parsed.issues.length) await transaction.insert(importIssues).values(parsed.issues.map(issue => ({ ...issue, workspaceId: auth.workspaceId, batchId: batch.id })))
      return { batchId: batch.id, accounts: parsed.accounts.length, occurrences: occurrenceCount, issues: parsed.issues }
    })
    return Response.json(result, { status: 201 })
  } catch (error) {
    console.error("POST /api/accounts/import", error)
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível importar o arquivo." }, { status: 500 })
  }
}
