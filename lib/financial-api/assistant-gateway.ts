import { executeDashboardAction } from "@/lib/dashboard-assistant/actions"
import { billPayment, billsForMonth } from "@/lib/bills"
import { currentMonthId } from "@/lib/months"
import { loadFinancialStore, loadFinancialStoreSnapshot, saveFinancialStore } from "./store"
import type { DashboardAction, DashboardAssistantContext } from "@/lib/dashboard-assistant/types"

const executableKinds = new Set([
  "create_wallet",
  "add_income",
  "add_expense",
  "add_recurring_income",
  "add_recurring_expense",
  "add_card_purchase",
  "pay_bill",
  "query_summary",
  "query_cards",
  "list_wallets",
])
const mutationKinds = new Set([
  "create_wallet",
  "add_income",
  "add_expense",
  "add_recurring_income",
  "add_recurring_expense",
  "add_card_purchase",
  "pay_bill",
])

export function isFinancialAssistantAction(value: unknown): value is DashboardAction {
  if (!value || typeof value !== "object") return false
  const action = value as Partial<DashboardAction>
  return typeof action.kind === "string" && executableKinds.has(action.kind)
}

export function isFinancialAssistantMutation(action: DashboardAction) {
  return mutationKinds.has(action.kind)
}

export function isFinancialAssistantMutationBatch(actions: DashboardAction[]) {
  return actions.some(isFinancialAssistantMutation)
}

/** Context contract exposed to the model. It intentionally contains no users,
 * credentials, configuration, audit data or internal wallet identifiers. */
export async function getFinancialAssistantContext(workspaceId: string): Promise<DashboardAssistantContext> {
  const store = await loadFinancialStore(workspaceId)
  // The assistant defaults every action to the current month, so its bill list must use the same one.
  const monthId = currentMonthId()
  return {
    wallets: store.wallets.map(wallet => ({ id: wallet.id, name: wallet.name })),
    cards: store.wallets.flatMap(wallet => (wallet.creditCards ?? [])
      .filter(card => !card.archived)
      .map(card => ({
        id: card.id,
        name: card.name,
        label: `${card.name}${card.lastFour ? ` •••• ${card.lastFour}` : ""} (${wallet.name})`,
        walletId: wallet.id,
        walletName: wallet.name,
      }))),
    bills: store.wallets.flatMap(wallet => billsForMonth(wallet, monthId).map(bill => ({
      id: bill.id,
      name: bill.name,
      amount: bill.amount,
      walletId: wallet.id,
      walletName: wallet.name,
      monthId,
      settled: Boolean(billPayment(wallet, bill.id, monthId)),
    }))),
  }
}

/** The only financial operation gateway available to the assistant runtime. */
export async function executeFinancialAssistantAction(workspaceId: string, action: DashboardAction) {
  if (!isFinancialAssistantAction(action)) throw new Error("Ação financeira não autorizada.")
  const snapshot = await loadFinancialStoreSnapshot(workspaceId)
  const result = executeDashboardAction(snapshot.store, action)
  if (result.changed) await saveFinancialStore(workspaceId, result.store, snapshot.revision)
  return result
}

/** Executes a validated batch against one in-memory store and persists it once. */
export async function executeFinancialAssistantActions(workspaceId: string, actions: DashboardAction[]) {
  if (!actions.length || !actions.every(isFinancialAssistantAction)) throw new Error("Ação financeira não autorizada.")
  const snapshot = await loadFinancialStoreSnapshot(workspaceId)
  const result = actions.reduce((current, action) => executeDashboardAction(current.store, action), { store: snapshot.store, message: "", changed: false })
  if (result.changed) await saveFinancialStore(workspaceId, result.store, snapshot.revision)
  return result
}
