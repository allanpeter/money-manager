import { and, eq, inArray, sql } from "drizzle-orm"
import { withWorkspace } from "@/lib/db"
import { accountOccurrences, accounts, importBatches, invoiceItems } from "@/lib/db/schema"
import type { C6InvoiceParseResult } from "./import-c6-invoice"

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

export interface C6InvoiceImportInput {
  workspaceId: string
  userId: string
  filename: string
  profileId: string
  referenceMonth: string
  mappings: Record<string, string>
  parsed: C6InvoiceParseResult
}

/** Persists a previously validated C6 CSV preview in one database transaction. */
export async function importC6Invoice(input: C6InvoiceImportInput) {
  if (!MONTH_PATTERN.test(input.referenceMonth)) throw new Error("Informe o mês da fatura.")
  if (input.parsed.issues.length) throw new Error("O CSV possui linhas inválidas. Corrija o arquivo antes de importar.")
  if (input.parsed.cards.some(card => !input.mappings[card.lastFour])) throw new Error("Mapeie todos os cartões encontrados no CSV.")

  return withWorkspace(input.workspaceId, async transaction => {
    const [duplicate] = await transaction.select({ id: importBatches.id }).from(importBatches)
      .where(and(eq(importBatches.workspaceId, input.workspaceId), eq(importBatches.checksum, input.parsed.checksum))).limit(1)
    if (duplicate) throw new Error(`Este arquivo já foi importado. Lote ${duplicate.id}`)

    const accountIds = [...new Set(Object.values(input.mappings))]
    const targetAccounts = await transaction.select({ id: accounts.id }).from(accounts).where(and(
      eq(accounts.workspaceId, input.workspaceId),
      eq(accounts.profileId, input.profileId),
      eq(accounts.accountType, "credit_card"),
      inArray(accounts.id, accountIds),
    ))
    if (targetAccounts.length !== accountIds.length) throw new Error("Uma das contas selecionadas não é um cartão desse perfil.")

    const [batch] = await transaction.insert(importBatches).values({
      workspaceId: input.workspaceId,
      filename: input.filename,
      checksum: input.parsed.checksum,
      summary: { source: "c6_invoice_csv", cards: input.parsed.cards.length, items: input.parsed.entries.length, paymentRowsSkipped: input.parsed.paymentCount },
    }).returning()

    let importedItems = 0
    const importedCards: { lastFour: string; totalCents: number; itemCount: number }[] = []
    const entriesByAccount = new Map<string, typeof input.parsed.entries>()
    for (const entry of input.parsed.entries) {
      const accountId = input.mappings[entry.cardLastFour]
      entriesByAccount.set(accountId, [...(entriesByAccount.get(accountId) ?? []), entry])
    }

    for (const [accountId, entries] of entriesByAccount) {
      const totalCents = entries.reduce((total, entry) => total + entry.amountCents, 0)
      if (totalCents < 0) throw new Error("A fatura de um cartão ficou negativa após os estornos; revise o CSV.")
      const occurrenceMonth = `${input.referenceMonth}-01`
      await transaction.insert(accountOccurrences).values({
        workspaceId: input.workspaceId,
        accountId,
        referenceMonth: occurrenceMonth,
        expectedAmountCents: 0,
        expectedSource: "import",
        importBatchId: batch.id,
      }).onConflictDoNothing()
      const [occurrence] = await transaction.select().from(accountOccurrences).where(and(
        eq(accountOccurrences.workspaceId, input.workspaceId),
        eq(accountOccurrences.accountId, accountId),
        eq(accountOccurrences.referenceMonth, occurrenceMonth),
      )).limit(1)
      if (!occurrence) throw new Error("Não foi possível localizar a fatura do cartão.")
      if (occurrence.declaration) throw new Error("Não é possível importar em uma fatura já resolvida.")
      const [existing] = await transaction.select({ count: sql<number>`count(*)` }).from(invoiceItems)
        .where(eq(invoiceItems.occurrenceId, occurrence.id))
      if (Number(existing.count) > 0) throw new Error("A fatura selecionada já possui compras. Revise-a antes de importar o CSV.")

      await transaction.insert(invoiceItems).values(entries.map(entry => ({
        workspaceId: input.workspaceId,
        occurrenceId: occurrence.id,
        description: entry.installmentNumber ? `${entry.description} · ${entry.installmentNumber}/${entry.installmentCount}` : entry.description,
        amountCents: entry.amountCents,
        purchasedOn: entry.purchasedOn,
        source: "c6_csv",
        externalId: `c6:${input.parsed.checksum}:${entry.lineNumber}`,
        sortOrder: entry.lineNumber,
        createdByUserId: input.userId,
      })))
      await transaction.update(accountOccurrences).set({
        expectedAmountCents: totalCents,
        expectedSource: "import",
        importBatchId: batch.id,
        updatedByUserId: input.userId,
        updatedAt: new Date(),
      }).where(eq(accountOccurrences.id, occurrence.id))
      importedItems += entries.length
      importedCards.push({ lastFour: entries[0].cardLastFour, totalCents, itemCount: entries.length })
    }

    return { batchId: batch.id, cards: importedCards, items: importedItems, paymentRowsSkipped: input.parsed.paymentCount }
  })
}
