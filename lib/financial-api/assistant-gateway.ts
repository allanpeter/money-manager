import { executeDashboardAction } from "@/lib/dashboard-assistant/actions"
import { loadFinancialStore, saveFinancialStore } from "./store"
import type { DashboardAction, DashboardAssistantContext } from "@/lib/dashboard-assistant/types"

const executableKinds = new Set([
  "create_wallet",
  "add_income",
  "add_expense",
  "add_recurring_income",
  "add_recurring_expense",
  "query_summary",
  "list_wallets",
])
const mutationKinds = new Set([
  "create_wallet",
  "add_income",
  "add_expense",
  "add_recurring_income",
  "add_recurring_expense",
])

export function isFinancialAssistantAction(value: unknown): value is DashboardAction {
  if (!value || typeof value !== "object") return false
  const action = value as Partial<DashboardAction>
  return typeof action.kind === "string" && executableKinds.has(action.kind)
}

export function isFinancialAssistantMutation(action: DashboardAction) {
  return mutationKinds.has(action.kind)
}

/** Context contract exposed to the model. It intentionally contains no users,
 * credentials, configuration, audit data or internal wallet identifiers. */
export async function getFinancialAssistantContext(workspaceId: string): Promise<DashboardAssistantContext> {
  const store = await loadFinancialStore(workspaceId)
  return { wallets: store.wallets.map(wallet => ({ id: wallet.id, name: wallet.name })) }
}

/** The only financial operation gateway available to the assistant runtime. */
export async function executeFinancialAssistantAction(workspaceId: string, action: DashboardAction) {
  if (!isFinancialAssistantAction(action)) throw new Error("Ação financeira não autorizada.")
  const store = await loadFinancialStore(workspaceId)
  const result = executeDashboardAction(store, action)
  if (result.changed) await saveFinancialStore(workspaceId, result.store)
  return result
}
