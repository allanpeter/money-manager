import OpenAI from "openai"
import { EMPTY_DASHBOARD_ACTION, type DashboardAction, type DashboardAssistantContext, type DashboardInterpretation, type PendingDashboardAction } from "./types"
import type { DashboardAssistantPersona } from "./persona"

const actionProperties = {
  kind: { type: "string", enum: ["chat", "create_wallet", "add_income", "add_expense", "add_recurring_income", "add_recurring_expense", "add_card_purchase", "pay_bill", "query_summary", "query_cards", "list_wallets", "unknown"] },
  walletName: { type: ["string", "null"] },
  walletId: { type: ["string", "null"] },
  itemName: { type: ["string", "null"] },
  amountCents: { type: ["integer", "null"], minimum: 0 },
  monthId: { type: ["string", "null"], description: "Mês AAAA-MM" },
  endMonthId: { type: ["string", "null"], description: "Último mês da recorrência, AAAA-MM" },
  expenseType: { type: ["string", "null"], enum: ["fixed", "variable", null] },
  paymentMethod: { type: ["string", "null"], enum: ["pix", "credit", "debit", "cash", null] },
  installments: { type: ["integer", "null"], minimum: 1 },
  cardName: { type: ["string", "null"], description: "Cartão citado pelo usuário" },
  cardId: { type: ["string", "null"], description: "Reservado ao sistema, sempre null" },
  billId: { type: ["string", "null"], description: "Reservado ao sistema, sempre null" },
  purchasedOn: { type: ["string", "null"], description: "Data da compra, AAAA-MM-DD" },
  recurring: { type: ["boolean", "null"], description: "Compra de cartão cobrada todo mês" },
  amountMode: { type: ["string", "null"], enum: ["total", "installment", null], description: "amountCents é o total da compra ou o valor de cada parcela" },
} as const

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    actions: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: { type: "object", additionalProperties: false, properties: actionProperties, required: Object.keys(actionProperties) },
    },
    reply: { type: "string" },
  },
  required: ["actions", "reply"],
} as const

function instructions(today: string, persona: DashboardAssistantPersona) {
  const tone = { warm: "acolhedor, próximo e respeitoso", balanced: "natural, claro e equilibrado", direct: "direto, objetivo e educado" }[persona.tone]
  const detail = { brief: "respostas curtas, de uma ou duas frases", balanced: "respostas com o contexto necessário, sem excesso", detailed: "respostas explicativas quando isso ajudar a pessoa a decidir" }[persona.verbosity]
  return `Você interpreta mensagens em português para um dashboard financeiro pessoal.
Retorne apenas o JSON estruturado. A data atual é ${today}.
Na conversa, fale com ${persona.preferredName || "a pessoa"}. Seu tom deve ser ${tone}; prefira ${detail}. Você é um assistente de IA, não uma pessoa, e não deve alegar emoções, memória ou ações que não possui.
Cada conversa está vinculada a um único usuário e workspace; use exclusivamente as carteiras fornecidas no contexto e nunca exponha IDs internos.
Nunca invente carteira, valor, descrição ou mês. Valores monetários devem ser convertidos para centavos inteiros: R$ 12,34 = 1234.
Retorne uma ação por lançamento independente. Se o usuário pedir aluguel e condomínio, retorne duas ações; nunca some valores, nunca junte descrições e nunca descarte um lançamento.
Para conversas, saudações ou perguntas sem operação, use chat e responda de forma curta em reply.
Use create_wallet para criar uma carteira como PF, PJ, esposa ou filhos.
Use add_income e add_expense para lançamentos apenas do mês escolhido. Use add_recurring_income e add_recurring_expense quando o usuário disser mensal, recorrente, todo mês ou informar parcelas.
Quando o usuário disser “até julho de 2028”, preencha endMonthId como “2028-07” e deixe monthId null, exceto se ele também informar explicitamente o mês de início. Para “no mesmo prazo”, copie o mesmo endMonthId para cada operação recorrente. Nunca calcule nem invente installments quando houver endMonthId: o backend calcula o período.
Use add_card_purchase para compras no cartão de crédito, informando cardName com o cartão citado. O sistema monta a fatura sozinho: cada compra entra na fatura do cartão conforme o dia de fechamento, e parcelas futuras caem nas faturas seguintes.
Em add_card_purchase, installments é o número de parcelas e amountMode diz o que é amountCents: “total” quando o usuário der o valor cheio (“R$ 300 em 3x”) e “installment” quando ele der o valor de cada parcela (“3x de R$ 100”). Na dúvida use total. Preencha recurring true quando a compra for assinatura ou cobrança mensal no cartão (“todo mês”, “assinatura”, “mensalidade”), e nesse caso deixe installments null. Preencha purchasedOn com a data da compra em AAAA-MM-DD quando o usuário informar; caso contrário deixe null e o sistema usa hoje.
Use pay_bill para quitar uma conta ou fatura do mês (“paguei o aluguel”, “marcar a fatura do Nubank como paga”), com itemName igual ao nome da conta ou do cartão. A fatura é paga inteira; nunca marque compras individuais como pagas.
Use query_cards para perguntas sobre cartões e faturas (“quanto está a fatura?”, “quais cartões tenho?”, “o que tem na fatura do Nubank?”).
Use add_expense com paymentMethod credit apenas para uma despesa avulsa sem cartão cadastrado.
Use query_summary para saldo, receitas ou despesas; se o usuário não citar carteira, a consulta é consolidada. Use list_wallets para listar as carteiras.
Perguntas como “como estão minhas contas?”, “como está minha vida financeira?”, “me dê um resumo” ou “qual é minha situação financeira?” são consultas reais: use query_summary mesmo quando vierem acompanhadas de “oi”, “bom dia” ou outra saudação. Nunca responda apenas que pode consultar esses dados.
Para lançamentos e criação, deixe reply vazio: o sistema fará perguntas e pedirá confirmação. Para consultas, deixe os campos não necessários nulos.
walletId, cardId e billId são reservados ao sistema e devem sempre ser null. Não preencha walletName se o usuário não citou explicitamente uma carteira, mesmo se existir apenas uma disponível. Se o usuário responder uma carteira para um lote pendente, repita essa carteira em cada ação do lote.
Se o usuário não informar mês, deixe monthId null; o sistema aplicará o mês atual.
Use unknown apenas para pedido financeiro não suportado, explicando brevemente em reply que você pode registrar receitas, despesas, recorrências, compras no cartão, quitar contas e faturas, criar carteiras e mostrar resumos.`
}

export async function interpretDashboardMessage(input: {
  text: string
  today: string
  context: DashboardAssistantContext
  pending: PendingDashboardAction | null
  persona: DashboardAssistantPersona
}): Promise<DashboardInterpretation> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada")
  const client = new OpenAI({ apiKey })
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
    store: false,
    instructions: instructions(input.today, input.persona),
    input: JSON.stringify({
      mensagem: input.text,
      acoesPendentes: input.pending?.actions ?? null,
      carteirasDisponiveis: input.context.wallets.map(wallet => wallet.name),
      cartoesDisponiveis: input.context.cards.map(card => card.label),
      contasDoMesAtual: input.context.bills.map(bill => bill.name),
    }),
    text: {
      verbosity: "low",
      format: { type: "json_schema", name: "dashboard_action", strict: true, schema },
    },
  })
  if (!response.output_text) throw new Error("A OpenAI não retornou uma interpretação")
  return JSON.parse(response.output_text) as DashboardInterpretation
}

function mergeAction(previous: DashboardAction, next: DashboardAction): DashboardAction {
  if (previous.kind !== next.kind) return next
  if (next.kind === "unknown") next = { ...next, kind: previous.kind }
  return Object.fromEntries(Object.entries(next).map(([key, value]) => [key, value ?? previous[key as keyof DashboardAction]])) as DashboardAction
}

export function mergeDashboardActions(previous: DashboardAction[] | null, next: DashboardAction[]): DashboardAction[] {
  if (!previous?.length || previous.some(action => action.kind === "unknown")) return next
  if (previous.length !== next.length) return next
  return next.map((action, index) => mergeAction(previous[index], action))
}

const normalize = (value: string) => value.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "")

export function isConfirmation(value: string) {
  return ["sim", "confirmo", "confirmar", "pode", "pode salvar", "salvar", "ok", "isso"].includes(normalize(value))
}

export function isCancellation(value: string) {
  return ["nao", "não", "cancelar", "cancela", "cancelado", "esquece", "parar"].includes(normalize(value))
}

export { EMPTY_DASHBOARD_ACTION }
