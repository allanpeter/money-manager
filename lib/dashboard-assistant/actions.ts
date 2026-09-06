import { currentDateId, currentMonthId, isDateId, isMonthId, monthLabel, shiftMonth } from "@/lib/months"
import type { MultiWalletStore, Wallet } from "@/lib/types"
import { COLORS, formatCurrency } from "@/lib/utils"
import { newId, nextWalletColor, withMonthData } from "@/lib/financial-api/store"
import { creditCardInvoicesForMonth, firstInvoiceMonth, splitPurchase } from "@/lib/credit-cards"
import { billPayment, billsForMonth, findBills, isRecurringActive } from "@/lib/bills"
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

/** Cards are addressed by name or by the last four digits, scoped to the wallet when the user named one. */
function resolveCard(context: DashboardAssistantContext, action: DashboardAction) {
  const wallet = resolveWallet(context, action)
  const available = wallet ? context.cards.filter(card => card.walletId === wallet.id) : context.cards
  if (!action.cardName?.trim()) return available.length === 1 ? available[0] : null
  const requested = normalize(action.cardName)
  const exact = available.filter(card => normalize(card.name) === requested || normalize(card.label) === requested)
  if (exact.length === 1) return exact[0]
  const matches = available.filter(card => normalize(card.label).includes(requested) || requested.includes(normalize(card.name)))
  return matches.length === 1 ? matches[0] : null
}

function cardPrompt(context: DashboardAssistantContext) {
  if (!context.cards.length) return "Nenhum cartão disponível para compras. Cadastre (ou desarquive) um cartão na aba Cartões primeiro."
  return `Em qual cartão foi a compra? Disponíveis: ${context.cards.map(card => card.label).join(", ")}.`
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

function monthsInclusive(start: string, end: string) {
  const [startYear, startMonth] = start.split("-").map(Number)
  const [endYear, endMonth] = end.split("-").map(Number)
  return (endYear - startYear) * 12 + endMonth - startMonth + 1
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

  if (action.kind === "query_cards") {
    const wallet = resolveWallet(context, action)
    if (action.walletName && !wallet) return { action, ready: false, readOnly: true, summary: null, prompt: walletPrompt(context) }
    if (wallet) {
      action.walletId = wallet.id
      action.walletName = wallet.name
    }
    action.monthId = monthOrCurrent(action.monthId)
    return { action, ready: true, readOnly: true, summary: null, prompt: "" }
  }
  if (action.kind === "add_card_purchase") {
    if (!context.cards.length) return { action, ready: false, readOnly: false, summary: null, prompt: cardPrompt(context) }
    if (!action.itemName?.trim()) return { action, ready: false, readOnly: false, summary: null, prompt: "Qual é a descrição da compra no cartão?" }
    if (!validAmount(action.amountCents)) return { action, ready: false, readOnly: false, summary: null, prompt: "Qual é o valor da compra?" }
    const card = resolveCard(context, action)
    if (!card) return { action, ready: false, readOnly: false, summary: null, prompt: cardPrompt(context) }
    action.cardId = card.id
    action.cardName = card.name
    action.walletId = card.walletId
    action.walletName = card.walletName
    if (action.recurring) action.installments = null
    if (!validInstallments(action.installments)) return { action, ready: false, readOnly: false, summary: null, prompt: "Em quantas parcelas? Diga um número ou “à vista”." }
    // The store always keeps the full purchase value, so "3x de R$ 100" is multiplied here once.
    const split = splitPurchase(action.amountCents / 100, action.recurring ? 1 : (action.installments ?? 1), action.amountMode ?? "total")
    action.amountCents = Math.round(split.total * 100)
    action.amountMode = "total"
    action.purchasedOn = action.purchasedOn && isDateId(action.purchasedOn) ? action.purchasedOn : currentDateId()
    const parcels = action.recurring
      ? ", cobrada todo mês até ser desativada"
      : split.count > 1
        ? ` em ${split.count}x de ${formatCurrency(split.first)}${split.first === split.rest ? "" : ` (última de ${formatCurrency(split.rest)})`}`
        : ""
    return {
      action,
      ready: true,
      readOnly: false,
      summary: `Registrar compra “${action.itemName.trim()}” de ${formatCurrency(split.total)} no cartão ${card.label}${parcels}`,
      prompt: "",
    }
  }
  if (action.kind === "pay_bill") {
    if (!action.itemName?.trim()) return { action, ready: false, readOnly: false, summary: null, prompt: "Qual conta ou fatura devo marcar como paga?" }
    action.monthId = monthOrCurrent(action.monthId)
    const wallet = resolveWallet(context, action)
    if (action.walletName && !wallet) return { action, ready: false, readOnly: false, summary: null, prompt: walletPrompt(context) }
    // The context only carries the current month; other months are resolved when the action runs.
    const scoped = context.bills.filter(bill => bill.monthId === action.monthId && (!wallet || bill.walletId === wallet.id))
    if (!scoped.length) return { action, ready: true, readOnly: false, summary: `Marcar “${action.itemName.trim()}” como paga em ${monthLabel(action.monthId)}`, prompt: "" }
    const matches = findBills(scoped.map(bill => ({ ...bill, source: "recurring" as const })), action.itemName)
    if (!matches.length) return { action, ready: false, readOnly: false, summary: null, prompt: `Não encontrei “${action.itemName.trim()}” entre as contas de ${monthLabel(action.monthId)}. Contas do mês: ${scoped.map(bill => bill.name).join(", ")}.` }
    if (matches.length > 1) return { action, ready: false, readOnly: false, summary: null, prompt: `Qual delas? ${matches.map(bill => bill.name).join(", ")}.` }
    const bill = scoped.find(item => item.id === matches[0].id)!
    if (bill.settled) return { action, ready: false, readOnly: false, summary: null, prompt: `“${bill.name}” já está quitada em ${monthLabel(action.monthId)}.` }
    action.billId = bill.id
    action.itemName = bill.name
    action.walletId = bill.walletId
    action.walletName = bill.walletName
    action.amountCents = Math.round(bill.amount * 100)
    return { action, ready: true, readOnly: false, summary: `Marcar “${bill.name}” (${formatCurrency(bill.amount)}) como paga em ${monthLabel(action.monthId)} — carteira ${bill.walletName}`, prompt: "" }
  }

  const isIncome = action.kind === "add_income" || action.kind === "add_recurring_income"
  const isExpense = action.kind === "add_expense" || action.kind === "add_recurring_expense"
  if (!isIncome && !isExpense) {
    return { action, ready: false, readOnly: true, summary: null, prompt: "Posso criar carteiras, registrar receitas e despesas, criar recorrências, lançar compras no cartão, quitar contas e faturas e consultar o consolidado." }
  }
  if (!action.itemName?.trim()) return { action, ready: false, readOnly: false, summary: null, prompt: isIncome ? "Qual é a descrição da receita?" : "Qual é a descrição da despesa?" }
  if (!validAmount(action.amountCents)) return { action, ready: false, readOnly: false, summary: null, prompt: "Qual é o valor?" }
  const wallet = resolveWallet(context, action)
  if (!wallet) return { action, ready: false, readOnly: false, summary: null, prompt: walletPrompt(context, [action]) }
  action.walletId = wallet.id
  action.walletName = wallet.name
  const currentMonth = currentMonthId()
  const recurringWithEnd = action.kind === "add_recurring_income" || action.kind === "add_recurring_expense"
  // Models occasionally put the final month in monthId for a phrase such as
  // “até julho de 2028”. Without an explicit start, recurrence starts now.
  action.monthId = recurringWithEnd && action.endMonthId && action.monthId === action.endMonthId && currentMonth < action.endMonthId
    ? currentMonth
    : monthOrCurrent(action.monthId)
  if ((action.kind === "add_recurring_income" || action.kind === "add_recurring_expense") && action.endMonthId) {
    if (!isMonthId(action.endMonthId) || action.endMonthId < action.monthId) {
      return { action, ready: false, readOnly: false, summary: null, prompt: "Informe um mês final válido, posterior ao início da recorrência." }
    }
    action.installments = monthsInclusive(action.monthId, action.endMonthId)
  }
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
  const sharedEndMonthId = rawActions.find(action => action.endMonthId)?.endMonthId ?? null
  const prepared = rawActions.map(action => prepareDashboardAction(context, (
    sharedEndMonthId && (action.kind === "add_recurring_income" || action.kind === "add_recurring_expense") && !action.endMonthId
      ? { ...action, endMonthId: sharedEndMonthId }
      : action
  )))
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

function scopedWallets(store: MultiWalletStore, walletId: string | null) {
  return walletId ? store.wallets.filter(wallet => wallet.id === walletId) : store.wallets
}

function monthTotals(store: MultiWalletStore, walletId: string | null, monthId: string) {
  return scopedWallets(store, walletId).reduce((totals, wallet) => {
    const data = wallet.months.find(month => month.id === monthId)?.data
    const income = (data?.incomeSources ?? []).reduce((sum, item) => sum + item.amount, 0)
      + wallet.recurringIncomes.filter(item => isRecurringActive(item, monthId)).reduce((sum, item) => sum + item.amount, 0)
    // Card invoices count as expenses of the month they are due, exactly as the dashboard does.
    const expenses = (data?.expenseCategories ?? []).reduce((sum, item) => sum + item.amount, 0)
      + wallet.recurringExpenses.filter(item => isRecurringActive(item, monthId)).reduce((sum, item) => sum + item.amount, 0)
      + creditCardInvoicesForMonth(wallet, monthId).reduce((sum, invoice) => sum + invoice.amount, 0)
    return { income: totals.income + income, expenses: totals.expenses + expenses }
  }, { income: 0, expenses: 0 })
}

function invoiceLines(store: MultiWalletStore, walletId: string | null, monthId: string) {
  return scopedWallets(store, walletId).flatMap(wallet => creditCardInvoicesForMonth(wallet, monthId).map(invoice => {
    const settled = billPayment(wallet, `card:${invoice.card.id}`, monthId)
    const status = settled?.status === "paid" ? "paga" : settled?.status === "no_charge" ? "sem cobrança" : "em aberto"
    return `${invoice.card.name}: ${formatCurrency(invoice.amount)} (vence dia ${invoice.card.dueDay}, ${invoice.items.length} ${invoice.items.length === 1 ? "compra" : "compras"}, ${status})`
  }))
}

function summaryLines(store: MultiWalletStore, walletId: string | null, monthId: string) {
  const wallets = scopedWallets(store, walletId)
  const recurring = wallets.flatMap(wallet => wallet.recurringExpenses
    .filter(item => isRecurringActive(item, monthId))
    .map(item => `${item.name}: ${formatCurrency(item.amount)}`))
  const variable = wallets.flatMap(wallet => wallet.months.find(month => month.id === monthId)?.data.expenseCategories ?? [])
    .map(item => `${item.name}: ${formatCurrency(item.amount)}`)
  const invoices = invoiceLines(store, walletId, monthId)
  const open = wallets.flatMap(wallet => billsForMonth(wallet, monthId).filter(bill => !billPayment(wallet, bill.id, monthId)))
  const lines: string[] = []
  if (recurring.length) lines.push(`Despesas recorrentes: ${recurring.join(", ")}.`)
  if (variable.length) lines.push(`Lançamentos do mês: ${variable.join(", ")}.`)
  if (invoices.length) lines.push(`Faturas de cartão: ${invoices.join(", ")}.`)
  if (open.length) lines.push(`Em aberto na revisão de pagamentos: ${formatCurrency(open.reduce((sum, bill) => sum + bill.amount, 0))} em ${open.length} ${open.length === 1 ? "conta" : "contas"}.`)
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
  if (action.kind === "query_cards") {
    const monthId = action.monthId ?? currentMonthId()
    const wallets = scopedWallets(store, action.walletId)
    const cards = wallets.flatMap(wallet => (wallet.creditCards ?? []).map(card => {
      const invoice = creditCardInvoicesForMonth(wallet, monthId).find(item => item.card.id === card.id)
      const settled = billPayment(wallet, `card:${card.id}`, monthId)
      const status = settled?.status === "paid" ? "paga" : settled?.status === "no_charge" ? "sem cobrança" : "em aberto"
      const label = `${card.name}${card.lastFour ? ` •••• ${card.lastFour}` : ""}${card.archived ? " (arquivado)" : ""} — ${wallet.name}`
      if (!invoice) return `${label}: sem fatura em ${monthLabel(monthId)} (fecha dia ${card.closingDay}, vence dia ${card.dueDay}).`
      const items = invoice.items.map(item => {
        const installments = item.purchase.installments ?? 1
        const detail = item.purchase.recurring ? "recorrente" : installments > 1 ? `parcela ${item.installment}/${installments}` : "à vista"
        return `${item.purchase.name} ${formatCurrency(item.amount)} (${detail})`
      })
      return `${label}: ${formatCurrency(invoice.amount)} em ${monthLabel(monthId)}, vence dia ${card.dueDay}, ${status}. Compras: ${items.join(", ")}.`
    }))
    return { store, message: cards.length ? cards.join("\n") : "Nenhum cartão cadastrado.", changed: false }
  }
  if (action.kind === "pay_bill") {
    const monthId = action.monthId ?? currentMonthId()
    const wallets = scopedWallets(store, action.walletId)
    const found = wallets.flatMap(wallet => billsForMonth(wallet, monthId).map(bill => ({ wallet, bill })))
      .filter(entry => (action.billId ? entry.bill.id === action.billId : findBills([entry.bill], action.itemName ?? "").length > 0))
    if (found.length !== 1) {
      const names = wallets.flatMap(wallet => billsForMonth(wallet, monthId).map(bill => bill.name))
      const reason = found.length ? "Mais de uma conta corresponde a" : "Não encontrei"
      return { store, message: `${reason} “${action.itemName ?? ""}” em ${monthLabel(monthId)}. Contas do mês: ${names.join(", ") || "nenhuma"}.`, changed: false }
    }
    const { wallet, bill } = found[0]
    if (billPayment(wallet, bill.id, monthId)) return { store, message: `“${bill.name}” já estava quitada em ${monthLabel(monthId)}.`, changed: false }
    const nextWallet: Wallet = {
      ...wallet,
      recurringExpensePayments: {
        ...(wallet.recurringExpensePayments ?? {}),
        [`${bill.id}:${monthId}`]: { status: "paid", paidAmount: bill.amount, paidAt: new Date().toISOString() },
      },
    }
    return {
      store: { ...store, wallets: store.wallets.map(item => item.id === wallet.id ? nextWallet : item) },
      message: `“${bill.name}” marcada como paga em ${monthLabel(monthId)} (${formatCurrency(bill.amount)}).`,
      changed: true,
    }
  }
  if (action.kind === "create_wallet" && action.walletName) {
    const id = newId()
    const next = { ...store, wallets: [...store.wallets, { id, name: action.walletName.trim(), color: nextWalletColor(store), months: [], recurringExpenses: [], recurringIncomes: [], creditCards: [], creditCardPurchases: [], recurringExpensePayments: {} }], activeWalletId: id }
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
  } else if (action.kind === "add_card_purchase") {
    const card = (wallet.creditCards ?? []).find(item => item.id === action.cardId)
    if (!card) throw new Error("Cartão não encontrado para a compra.")
    const purchase = {
      id: newId(),
      creditCardId: card.id,
      name: action.itemName.trim(),
      amount,
      purchasedOn: action.purchasedOn && isDateId(action.purchasedOn) ? action.purchasedOn : currentDateId(),
      installments: action.recurring || (action.installments ?? 1) <= 1 ? undefined : action.installments!,
      recurring: action.recurring ? true : undefined,
      active: action.recurring ? true : undefined,
    }
    nextWallet = { ...wallet, creditCardPurchases: [...(wallet.creditCardPurchases ?? []), purchase] }
    const invoiceMonth = firstInvoiceMonth(purchase, card)
    return {
      store: { ...store, wallets: store.wallets.map(item => item.id === wallet.id ? nextWallet : item) },
      message: `Compra “${purchase.name}” de ${formatCurrency(amount)} registrada no cartão ${card.name}${invoiceMonth ? `, ${purchase.recurring ? "a partir da fatura de" : "na fatura de"} ${monthLabel(invoiceMonth)}` : ""}.`,
      changed: true,
    }
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
