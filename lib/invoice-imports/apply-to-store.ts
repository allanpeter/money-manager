import { randomUUID } from "node:crypto"
import type { C6InvoiceEntry } from "@/lib/accounts/import-c6-invoice"
import type { CreditCardPurchase, MultiWalletStore } from "@/lib/types"

/** Answer that keeps one CSV card ending out of the import. */
export const SKIP_CARD = "skip"

export interface StoreCardTarget {
  id: string
  name: string
  lastFour?: string
  walletId: string
  walletName: string
}

export interface InvoiceImportResult {
  store: MultiWalletStore
  imported: number
  duplicates: number
  skipped: number
  perCard: { cardId: string; cardName: string; imported: number; duplicates: number; totalCents: number }[]
}

export function listStoreCards(store: MultiWalletStore): StoreCardTarget[] {
  return store.wallets.flatMap(wallet => (wallet.creditCards ?? [])
    .filter(card => !card.archived)
    .map(card => ({ id: card.id, name: card.name, lastFour: card.lastFour, walletId: wallet.id, walletName: wallet.name })))
}

/** Matches a CSV card ending to a registered card. Ambiguity is never resolved here; the caller asks. */
export function matchCardByLastFour(cards: StoreCardTarget[], lastFour: string): StoreCardTarget | null {
  const matches = cards.filter(card => card.lastFour === lastFour)
  return matches.length === 1 ? matches[0] : null
}

/** The CSV keeps the original purchase date on every installment row, so the same
 * purchase reappears on each invoice. This identity lets a later import skip it. */
function installmentKey(purchase: Pick<CreditCardPurchase, "purchasedOn" | "name" | "installments">) {
  return `${purchase.purchasedOn}|${purchase.name.trim().toLocaleLowerCase("pt-BR")}|${purchase.installments ?? 1}`
}

function cashKey(purchasedOn: string, amount: number) {
  return `${purchasedOn}|${Math.round(amount * 100)}`
}

function purchaseFor(entry: C6InvoiceEntry, cardId: string): CreditCardPurchase {
  const count = entry.installmentCount ?? 1
  return {
    id: randomUUID(),
    creditCardId: cardId,
    name: entry.description,
    // The store always holds the full purchase value; the invoice engine splits it again.
    amount: Math.round(entry.amountCents * count) / 100,
    purchasedOn: entry.purchasedOn,
    installments: count > 1 ? count : undefined,
  }
}

/** Writes the parsed invoice into the wallet store, one purchase per CSV row.
 * Installment rows become the whole purchase so the engine fills the coming invoices. */
export function applyInvoiceToStore(store: MultiWalletStore, input: { entries: C6InvoiceEntry[]; mappings: Record<string, string> }): InvoiceImportResult {
  const cards = new Map(listStoreCards(store).map(card => [card.id, card]))
  const additions = new Map<string, CreditCardPurchase[]>()
  const perCard = new Map<string, { cardId: string; cardName: string; imported: number; duplicates: number; totalCents: number }>()
  let skipped = 0
  let duplicates = 0

  // Only what the store already holds counts as a duplicate. Two rows of the same file
  // are always distinct charges — the same store, the same day and the same value happens.
  const existingByCard = new Map<string, { installments: Set<string>; cash: Set<string> }>()
  for (const wallet of store.wallets) {
    for (const purchase of wallet.creditCardPurchases ?? []) {
      const seen = existingByCard.get(purchase.creditCardId) ?? { installments: new Set<string>(), cash: new Set<string>() }
      if ((purchase.installments ?? 1) > 1) seen.installments.add(installmentKey(purchase))
      seen.cash.add(cashKey(purchase.purchasedOn, purchase.amount))
      existingByCard.set(purchase.creditCardId, seen)
    }
  }

  for (const entry of input.entries) {
    const cardId = input.mappings[entry.cardLastFour]
    if (!cardId || cardId === SKIP_CARD) { skipped++; continue }
    const card = cards.get(cardId)
    if (!card) throw new Error(`O cartão vinculado ao final •••• ${entry.cardLastFour} não existe mais.`)
    const purchase = purchaseFor(entry, cardId)
    const seen = existingByCard.get(cardId)
    const stats = perCard.get(cardId) ?? { cardId, cardName: card.name, imported: 0, duplicates: 0, totalCents: 0 }

    // An installment purchase imported from an earlier invoice is already spread over the coming ones.
    // A same-day, same-value purchase was already registered by hand or by a previous import.
    const repeated = seen && ((purchase.installments ?? 1) > 1 && seen.installments.has(installmentKey(purchase)))
    if (repeated || seen?.cash.has(cashKey(purchase.purchasedOn, purchase.amount))) {
      duplicates++
      stats.duplicates++
      perCard.set(cardId, stats)
      continue
    }

    additions.set(cardId, [...(additions.get(cardId) ?? []), purchase])
    stats.imported++
    stats.totalCents += entry.amountCents
    perCard.set(cardId, stats)
  }

  const imported = [...additions.values()].reduce((total, list) => total + list.length, 0)
  if (!imported) return { store, imported: 0, duplicates, skipped, perCard: [...perCard.values()] }

  return {
    store: {
      ...store,
      wallets: store.wallets.map(wallet => {
        const added = (wallet.creditCards ?? []).flatMap(card => additions.get(card.id) ?? [])
        return added.length ? { ...wallet, creditCardPurchases: [...(wallet.creditCardPurchases ?? []), ...added] } : wallet
      }),
    },
    imported,
    duplicates,
    skipped,
    perCard: [...perCard.values()],
  }
}
