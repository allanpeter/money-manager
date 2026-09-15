import { and, eq } from "drizzle-orm"
import { withWorkspace } from "@/lib/db"
import { financialStores, importBatches } from "@/lib/db/schema"
import type { C6InvoiceEntry } from "@/lib/accounts/import-c6-invoice"
import type { MultiWalletStore } from "@/lib/types"
import { applyInvoiceToStore, type InvoiceImportResult } from "./apply-to-store"

export interface InvoiceStoreImportInput {
  workspaceId: string
  filename: string
  checksum: string
  referenceMonth: string
  entries: C6InvoiceEntry[]
  mappings: Record<string, string>
}

function isStore(value: unknown): value is MultiWalletStore {
  if (!value || typeof value !== "object") return false
  const store = value as Partial<MultiWalletStore>
  return Array.isArray(store.wallets) && typeof store.activeMonthId === "string" && typeof store.activeWalletId === "string"
}

/** Persists an invoice preview into the wallet store. The batch checksum and the
 * store update share one transaction, so a replayed file can never import twice. */
export async function importInvoiceIntoStore(input: InvoiceStoreImportInput): Promise<InvoiceImportResult> {
  return withWorkspace(input.workspaceId, async transaction => {
    const [duplicate] = await transaction.select({ id: importBatches.id }).from(importBatches)
      .where(and(eq(importBatches.workspaceId, input.workspaceId), eq(importBatches.checksum, input.checksum))).limit(1)
    if (duplicate) throw new Error("Este arquivo já foi importado antes.")

    const [row] = await transaction.select({ data: financialStores.data, revision: financialStores.revision }).from(financialStores)
      .where(eq(financialStores.workspaceId, input.workspaceId)).limit(1)
    if (!row || !isStore(row.data)) throw new Error("Não encontrei seus dados financeiros para gravar a fatura.")

    const result = applyInvoiceToStore(row.data, { entries: input.entries, mappings: input.mappings })
    if (!result.imported) throw new Error("Nenhuma compra nova para importar: tudo já estava registrado.")

    const [saved] = await transaction.update(financialStores).set({ data: result.store, revision: row.revision + 1, updatedAt: new Date() })
      .where(and(eq(financialStores.workspaceId, input.workspaceId), eq(financialStores.revision, row.revision)))
      .returning({ revision: financialStores.revision })
    if (!saved) throw new Error("Seus dados financeiros foram alterados em outra sessão. Reenvie a fatura para evitar perda de dados.")
    await transaction.insert(importBatches).values({
      workspaceId: input.workspaceId,
      filename: input.filename,
      checksum: input.checksum,
      summary: {
        source: "c6_invoice_csv",
        referenceMonth: input.referenceMonth,
        cards: result.perCard.length,
        items: result.imported,
        duplicates: result.duplicates,
        skipped: result.skipped,
      },
    })
    return result
  })
}
