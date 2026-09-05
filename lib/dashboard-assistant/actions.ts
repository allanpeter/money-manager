import { currentMonthId, isMonthId, monthLabel, shiftMonth } from "@/lib/months"
import type { MultiWalletStore } from "@/lib/types"
import { COLORS, formatCurrency } from "@/lib/utils"
import { newId, nextWalletColor, withMonthData } from "@/lib/financial-api/store"
import type { DashboardAction, DashboardAssistantContext } from "./types"

export interface PreparedDashboardAction {
  action: DashboardAction
  ready: boolean
  readOnly: boolean
  prompt: string
  summary: string | null
}

export interface PreparedDashboardActions {
  actions: DashboardAction[]
  ready: boolean
  readOnly: boolean
  prompt: string
  summary: string | null
}

const normalize = (value: string) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim()

function resolveWallet(context: DashboardAssistantContext, action: DashboardAction) {
  if (action.walletId) {
    const byId = context.wallets.find(wallet => wallet.id === action.walletId)
    if (byId) return byId
  }
  if (!action.walletName) return null
  const requested = normalize(action.walletName)
  const exact = context.wallets.find(wallet => normalize(wallet.name) === requested)
  if (exact) return exact
  const matches = context.wallets.filter(wallet => normalize(wallet.name).includes(requested) || requested.includes(normalize(wallet.name)))
  return matches.length === 1 ? matches[0] : null
}

function walletPrompt(context: DashboardAssistantContext, actions: DashboardAction[] = []) {
  const items = actions.filter(action => action.itemName && validAmount(action.amountCents))
  const details = items.length
    ? `Você pediu:\n${items.map((action, index) => `${index + 1}. ${action.itemName!.trim()} — ${formatCurrency(action.amountCents! / 100)}${action.kind.includes("recurring") ? "/mês" : ""}`).join("\n")}\n\n`
    : ""
  return `${details}Em qual carteira devo registrar? Disponíveis: ${context.wallets.map(wallet => wallet.name).join(", ")}.`
}

function validAmount(value: number | null): value is number {
  return value != null && Number.isSafeInteger(value) && value > 0
}

function validInstallments(value: number | null): value is number {
  return value == null || (value != null && Number.isInteger(value) && value > 0)
}

function monthOrCurrent(value: string | null) {
  return value && isMonthId(value) ? value : currentMonthId()
}

export function prepareDashboardAction(context: DashboardAssistantContext, rawAction: DashboardAction): PreparedDashboardAction {
  const action = { ...rawAction }

  if (action.kind === "list_wallets") {
    return { action, ready: true, readOnly: true, summary: null, prompt: "" }
  }
  if (action.kind === "query_summary") {
    action.monthId = monthOrCurrent(action.monthId)
    const wallet = resolveWallet(context, action)
  if (action.walletName && !wallet) return { action, ready: false, readOnly: true, summary: null, prompt: walletPrompt(context) }
    if (wallet) {
      action.walletId = wallet.id
      action.walletName = wallet.name
    }
    return { action, ready: true, readOnly: true, summary: null, prompt: "" }
  }
  if (action.kind === "create_wallet") {
    if (!action.walletName?.trim()) return { action, ready: false, readOnly: false, summary: null, prompt: "Qual é o nome da nova carteira?" }
    const duplicate = context.wallets.some(wallet => normalize(wallet.name) === normalize(action.walletName!))
    if (duplicate) return { action, ready: false, readOnly: false, summary: null, prompt: `A carteira “${action.walletName.trim()}” já existe.` }
    return { action, ready: true, readOnly: false, summary: `Criar a carteira “${action.walletName.trim()}”`, prompt: "" }
  }

  const isIncome = action.kind === "add_income" || action.kind === "add_recurring_income"
  const isExpense = action.kind === "add_expense" || action.kind === "add_recurring_expense"
  if (!isIncome && !isExpense) {
    return { action, ready: false, readOnly: true, summary: null, prompt: "Posso criar uma carteira, registrar receitas ou despesas, criar recorrências e consultar o consolidado." }
  }
  if (!action.itemName?.trim()) return { action, ready: false, readOnly: false, summary: null, prompt: isIncome ? "Qual é a descrição da receita?" : "Qual é a descrição da despesa?" }
  if (!validAmount(action.amountCents)) return { action, ready: false, readOnly: false, summary: null, prompt: "Qual é o valor?" }
  const wallet = resolveWallet(context, action)
  if (!wallet) return { action, ready: false, readOnly: false, summary: null, prompt: walletPrompt(context, [action]) }
  action.walletId = wallet.id
  action.walletName = wallet.name
  action.monthId = monthOrCurrent(action.monthId)
  if ((action.kind === "add_recurring_income" || action.kind === "add_recurring_expense") && !validInstallments(action.installments)) {
    return { action, ready: false, readOnly: false, summary: null, prompt: "Em quantos meses deve se repetir? Diga um número ou “sem prazo”." }
  }
  if (isExpense && !action.expenseType) action.expenseType = action.kind === "add_recurring_expense" ? "fixed" : "variable"
  const recurring = action.kind === "add_recurring_income" || action.kind === "add_recurring_expense"
  const recurrence = recurring
    ? action.installments ? ` de ${monthLabel(action.monthId)} até ${monthLabel(shiftMonth(action.monthId, action.installments - 1))} (${action.installments} meses)` : " mensal, sem prazo"
    : ` em ${monthLabel(action.monthId)}`
  const kind = isIncome ? "receita" : "despesa"
  return {
    action,
    ready: true,
    readOnly: false,
    summary: `Registrar ${kind} “${action.itemName.trim()}” de ${formatCurrency(action.amountCents / 100)} em ${wallet.name}${recurrence}`,
    prompt: "",
  }
}

export function prepareDashboardActions(context: DashboardAssistantContext, rawActions: DashboardAction[]): PreparedDashboardActions {
  if (!rawActions.length) return { actions: [], ready: false, readOnly: true, summary: null, prompt: "Não identifiquei uma operação financeira." }
  const prepared = rawActions.map(action => prepareDashboardAction(context, action))
  const incomplete = prepared.find(item => !item.ready)
  if (incomplete) {
    const allNeedWallet = prepared.every(item => !item.ready && item.prompt.includes("Em qual carteira"))
    return {
      actions: prepared.map(item => item.action),
      ready: false,
      readOnly: prepared.every(item => item.readOnly),
      summary: null,
      prompt: allNeedWallet ? walletPrompt(context, prepared.map(item => item.action)) : incomplete.prompt,
    }
  }
  const readOnly = prepared.every(item => item.readOnly)
  if (prepared.some(item => item.readOnly) && !readOnly) {
    return { actions: prepared.map(item => item.action), ready: false, readOnly: true, summary: null, prompt: "Envie consultas e alterações financeiras em mensagens separadas." }
  }
  if (readOnly && prepared.length > 1) {
    return { actions: prepared.map(item => item.action), ready: false, readOnly: true, summary: null, prompt: "Faça uma consulta por vez." }
  }
  if (readOnly) return { actions: prepared.map(item => item.action), ready: true, readOnly: true, summary: null, prompt: "" }
  const entries = prepared.map((item, index) => `${index + 1}. ${item.summary}`).join("\n")
  const monthly = prepared
    .filter(item => item.action.kind === "add_recurring_expense" || item.action.kind === "add_recurring_income")
    .reduce((sum, item) => sum + (item.action.amountCents ?? 0), 0)
  return {
    actions: prepared.map(item => item.action),
    ready: true,
    readOnly: false,
    prompt: "",
    summary: `${prepared.length === 1 ? entries : `Registrar ${prepared.length} operações:\n${entries}`}${monthly ? `\n\nImpacto mensal: ${formatCurrency(monthly / 100)}` : ""}`,
  }
}

function monthTotals(store: MultiWalletStore, walletId: string | null, monthId: string) {
  const wallets = walletId ? store.wallets.filter(wallet => wallet.id === walletId) : store.wallets
  return wallets.reduce((totals, wallet) => {
    const data = wallet.months.find(month => month.id === monthId)?.data
    const income = (data?.incomeSources ?? []).reduce((sum, item) => sum + item.amount, 0)
      + wallet.recurringIncomes.filter(item => item.startMonth <= monthId && (!item.installments || monthId <= shiftMonth(item.startMonth, item.installments - 1))).reduce((sum, item) => sum + item.amount, 0)
    const expenses = (data?.expenseCategories ?? []).reduce((sum, item) => sum + item.amount, 0)
      + wallet.recurringExpenses.filter(item => item.startMonth <= monthId && (!item.installments || monthId <= shiftMonth(item.startMonth, item.installments - 1))).reduce((sum, item) => sum + item.amount, 0)
    return { income: totals.income + income, expenses: totals.expenses + expenses }
  }, { income: 0, expenses: 0 })
}

function summaryLines(store: MultiWalletStore, walletId: string | null, monthId: string) {
  const wallets = walletId ? store.wallets.filter(wallet => wallet.id === walletId) : store.wallets
  const recurring = wallets.flatMap(wallet => wallet.recurringExpenses
    .filter(item => item.startMonth <= monthId && (!item.installments || monthId <= shiftMonth(item.startMonth, item.installments - 1)))
    .map(item => `${item.name}: ${formatCurrency(item.amount)}`))
  const variable = wallets.flatMap(wallet => wallet.months.find(month => month.id === monthId)?.data.expenseCategories ?? [])
    .map(item => `${item.name}: ${formatCurrency(item.amount)}`)
  const lines: string[] = []
  if (recurring.length) lines.push(`Despesas recorrentes: ${recurring.join(", ")}.`)
  if (variable.length) lines.push(`Lançamentos do mês: ${variable.join(", ")}.`)
  return lines
}

export function executeDashboardAction(store: MultiWalletStore, action: DashboardAction) {
  if (action.kind === "list_wallets") {
    return { store, message: store.wallets.length ? `Suas carteiras: ${store.wallets.map(wallet => wallet.name).join(", ")}.` : "Você ainda não possui carteiras.", changed: false }
  }
  if (action.kind === "query_summary") {
    const monthId = action.monthId ?? currentMonthId()
    const totals = monthTotals(store, action.walletId, monthId)
    const wallet = action.walletId ? store.wallets.find(item => item.id === action.walletId) : null
    const scope = wallet ? `da carteira ${wallet.name}` : "consolidado"
    const details = summaryLines(store, action.walletId, monthId)
    return {
      store,
      message: [`Resumo ${scope} em ${monthLabel(monthId)}:`, `Receitas: ${formatCurrency(totals.income)}`, `Despesas: ${formatCurrency(totals.expenses)}`, `Saldo projetado: ${formatCurrency(totals.income - totals.expenses)}`, ...details].join("\n"),
      changed: false,
    }
  }
  if (action.kind === "create_wallet" && action.walletName) {
    const id = newId()
    const next = { ...store, wallets: [...store.wallets, { id, name: action.walletName.trim(), color: nextWalletColor(store), months: [], recurringExpenses: [], recurringIncomes: [] }], activeWalletId: id }
    return { store: next, message: `Carteira “${action.walletName.trim()}” criada.`, changed: true }
  }

  const wallet = store.wallets.find(item => item.id === action.walletId)
  if (!wallet || !action.itemName || !validAmount(action.amountCents)) throw new Error("A ação não está pronta para ser salva.")
  const amount = action.amountCents / 100
  const monthId = action.monthId ?? currentMonthId()
  let nextWallet = wallet
  if (action.kind === "add_income") {
    nextWallet = withMonthData(wallet, monthId, data => ({ ...data, incomeSources: [...data.incomeSources, { id: newId(), name: action.itemName!.trim(), amount }] }))
  } else if (action.kind === "add_expense") {
    const color = COLORS[(wallet.months.find(month => month.id === monthId)?.data.expenseCategories.length ?? 0) % COLORS.length]
    nextWallet = withMonthData(wallet, monthId, data => ({ ...data, expenseCategories: [...data.expenseCategories, { id: newId(), name: action.itemName!.trim(), amount, type: action.expenseType ?? "variable", paymentMethod: action.paymentMethod ?? undefined, color }] }))
  } else if (action.kind === "add_recurring_income") {
    nextWallet = { ...wallet, recurringIncomes: [...wallet.recurringIncomes, { id: newId(), name: action.itemName.trim(), amount, startMonth: monthId, installments: action.installments ?? undefined }] }
  } else if (action.kind === "add_recurring_expense") {
    nextWallet = { ...wallet, recurringExpenses: [...wallet.recurringExpenses, { id: newId(), name: action.itemName.trim(), amount, color: COLORS[wallet.recurringExpenses.length % COLORS.length], paymentMethod: action.paymentMethod ?? undefined, startMonth: monthId, installments: action.installments ?? undefined }] }
  } else {
    throw new Error("Ação financeira inválida.")
  }
  const next = { ...store, wallets: store.wallets.map(item => item.id === wallet.id ? nextWallet : item) }
  return { store: next, message: `Pronto: ${action.itemName.trim()} foi registrado em ${wallet.name}.`, changed: true }
}
