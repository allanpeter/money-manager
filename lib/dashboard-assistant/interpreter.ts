import OpenAI from "openai"
import { EMPTY_DASHBOARD_ACTION, type DashboardAction, type DashboardAssistantContext, type DashboardInterpretation, type PendingDashboardAction } from "./types"

const actionProperties = {
  kind: { type: "string", enum: ["chat", "create_wallet", "add_income", "add_expense", "add_recurring_income", "add_recurring_expense", "query_summary", "list_wallets", "unknown"] },
  walletName: { type: ["string", "null"] },
  walletId: { type: ["string", "null"] },
  itemName: { type: ["string", "null"] },
  amountCents: { type: ["integer", "null"], minimum: 0 },
  monthId: { type: ["string", "null"], description: "Mês AAAA-MM" },
  expenseType: { type: ["string", "null"], enum: ["fixed", "variable", null] },
  paymentMethod: { type: ["string", "null"], enum: ["pix", "credit", "debit", "cash", null] },
  installments: { type: ["integer", "null"], minimum: 1 },
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

function instructions(today: string) {
  return `Você interpreta mensagens em português para um dashboard financeiro pessoal.
Retorne apenas o JSON estruturado. A data atual é ${today}.
Cada conversa está vinculada a um único usuário e workspace; use exclusivamente as carteiras fornecidas no contexto e nunca exponha IDs internos.
Nunca invente carteira, valor, descrição ou mês. Valores monetários devem ser convertidos para centavos inteiros: R$ 12,34 = 1234.
Retorne uma ação por lançamento independente. Se o usuário pedir aluguel e condomínio, retorne duas ações; nunca some valores, nunca junte descrições e nunca descarte um lançamento.
Para conversas, saudações ou perguntas sem operação, use chat e responda de forma curta em reply.
Use create_wallet para criar uma carteira como PF, PJ, esposa ou filhos.
Use add_income e add_expense para lançamentos apenas do mês escolhido. Use add_recurring_income e add_recurring_expense quando o usuário disser mensal, recorrente, todo mês ou informar parcelas.
Para uma compra no cartão use add_expense e paymentMethod credit. O sistema atual não controla fatura nem quitação de contas: registre a compra como despesa.
Use query_summary para saldo, receitas ou despesas; se o usuário não citar carteira, a consulta é consolidada. Use list_wallets para listar as carteiras.
Para lançamentos e criação, deixe reply vazio: o sistema fará perguntas e pedirá confirmação. Para consultas, deixe os campos não necessários nulos.
walletId é reservado ao sistema e deve sempre ser null. Não preencha walletName se o usuário não citou explicitamente uma carteira, mesmo se existir apenas uma disponível. Se o usuário responder uma carteira para um lote pendente, repita essa carteira em cada ação do lote.
Se o usuário não informar mês, deixe monthId null; o sistema aplicará o mês atual.
Use unknown apenas para pedido financeiro não suportado, explicando brevemente em reply que você pode registrar receitas, despesas, recorrências, criar carteiras e mostrar resumos.`
}

export async function interpretDashboardMessage(input: {
  text: string
  today: string
  context: DashboardAssistantContext
  pending: PendingDashboardAction | null
}): Promise<DashboardInterpretation> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada")
  const client = new OpenAI({ apiKey })
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
    store: false,
    instructions: instructions(input.today),
    input: JSON.stringify({
      mensagem: input.text,
      acoesPendentes: input.pending?.actions ?? null,
      carteirasDisponiveis: input.context.wallets.map(wallet => wallet.name),
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
