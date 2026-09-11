import { EMPTY_DASHBOARD_ACTION, type DashboardAction } from "./types"

function normalize(value: string) {
  return value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim()
}

/**
 * Resolves frequent, unambiguous read-only questions without relying on a
 * generative classification step. This prevents a greeting from turning a
 * request for the financial summary into generic small talk.
 */
export function quickDashboardIntent(text: string): DashboardAction | null {
  const value = normalize(text)
  const asksForStatus = /\b(como (esta|estao)|resumo|visao geral|balanco|situacao)\b/.test(value)
  const asksAboutFinances = /\b(minhas? contas?|minhas? financas?|vida financeira|meu dinheiro|meu saldo)\b/.test(value)
  if (asksForStatus && asksAboutFinances) return { ...EMPTY_DASHBOARD_ACTION, kind: "query_summary" }
  return null
}
