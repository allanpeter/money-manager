import OpenAI from "openai"
import type { AssistantAction, AssistantContext, AssistantInterpretation, PendingAssistantAction } from "./types"

const actionProperties = {
  kind: { type: "string", enum: ["chat", "record_purchase", "mark_paid", "create_account", "set_due_day", "set_closing_day", "list_upcoming", "unknown"] },
  profileHint: { type: ["string", "null"] },
  profileId: { type: ["string", "null"] },
  accountHint: { type: ["string", "null"] },
  accountId: { type: ["string", "null"] },
  walletHint: { type: ["string", "null"] },
  categoryHint: { type: ["string", "null"] },
  description: { type: ["string", "null"] },
  amountCents: { type: ["integer", "null"], minimum: 0 },
  purchaseDate: { type: ["string", "null"], description: "Data ISO AAAA-MM-DD" },
  referenceMonth: { type: ["string", "null"], description: "Mês ISO AAAA-MM" },
  accountName: { type: ["string", "null"] },
  dueDay: { type: ["integer", "null"], minimum: 1, maximum: 31 },
  closingDay: { type: ["integer", "null"], minimum: 1, maximum: 31 },
  nature: { type: ["string", "null"], enum: ["fixed", "variable", "installment", "one_off", null] },
  accountType: { type: ["string", "null"], enum: ["regular", "credit_card", null] },
  installments: { type: ["integer", "null"], minimum: 1 },
} as const

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: {
      type: "object",
      additionalProperties: false,
      properties: actionProperties,
      required: Object.keys(actionProperties),
    },
    missingFields: { type: "array", items: { type: "string" } },
    explanation: { type: "string" },
    reply: { type: "string", description: "Resposta conversacional ao usuário; vazia quando houver uma ação financeira" },
  },
  required: ["action", "missingFields", "explanation", "reply"],
} as const

function systemInstructions(today: string) {
  return `Você interpreta mensagens em português para um sistema financeiro pessoal interno.
Retorne somente o objeto estruturado solicitado. Nunca invente conta, carteira, categoria, valor ou data.
Valores monetários devem ser convertidos para centavos inteiros: R$ 12,34 = 1234.
Use a data atual ${today}. Quando o usuário disser hoje/agora, use ${today}.
Use chat para saudações, perguntas sobre o sistema, perguntas sobre os dados disponíveis ou conversas que não pedem uma alteração financeira.
Em chat, responda em reply de forma natural, direta e curta, usando apenas dadosDisponiveis e acaoPendente como contexto. Não exponha IDs internos.
Cada mensagem já chega vinculada a um usuário e a um espaço financeiro isolado. dadosDisponiveis contém somente dados desse espaço; nunca sugira acesso a outros usuários.
Espaços compartilhados podem existir quando o usuário for membro autorizado, mas você não altera membros ou permissões.
O sistema conhece somente os dados financeiros fornecidos em dadosDisponiveis, não informações pessoais externas.
Para chat, mantenha todos os demais campos da action como null e missingFields vazio.
Para compras no cartão, use record_purchase. A descrição do que foi comprado e o valor são obrigatórios.
Para marcar uma conta como paga, use mark_paid. Para cadastrar uma obrigação recorrente ou avulsa, use create_account.
Use set_due_day ou set_closing_day para configurações. Use list_upcoming para consultas de vencimentos.
Se uma informação estiver ausente, mantenha o campo como null e liste-o em missingFields.
accountId é reservado ao sistema e deve permanecer null.
profileId é reservado ao sistema e deve permanecer null. Para operações financeiras, preencha profileHint se o usuário mencionar Pessoa Física, empresa, esposa, filhos ou outro perfil. Se faltar um perfil e houver mais de um disponível, mantenha profileHint como null.
Para ações financeiras, deixe reply vazio.
Use unknown somente quando parecer haver uma solicitação financeira ambígua ou não suportada; nesse caso, explique em reply o que falta ou quais operações são suportadas.
Não execute ações e não afirme que algo foi salvo; você apenas interpreta a intenção.`
}

export async function interpretMessage(input: {
  text: string
  today: string
  context: AssistantContext
  pending: PendingAssistantAction | null
}): Promise<AssistantInterpretation> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada")

  const client = new OpenAI({ apiKey })
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
    store: false,
    instructions: systemInstructions(input.today),
    input: JSON.stringify({
      mensagem: input.text,
      acaoPendente: input.pending,
      dadosDisponiveis: input.context,
    }),
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "financial_action",
        description: "Intenção financeira extraída da mensagem do usuário",
        strict: true,
        schema,
      },
    },
  })

  if (!response.output_text) throw new Error("A OpenAI não retornou uma interpretação")
  return JSON.parse(response.output_text) as AssistantInterpretation
}

export function mergeAction(previous: AssistantAction | null, next: AssistantAction): AssistantAction {
  if (!previous || previous.kind === "unknown") return next
  if (next.kind === "unknown") next = { ...next, kind: previous.kind }
  if (previous.kind !== next.kind) return next
  return Object.fromEntries(
    Object.entries(next).map(([key, value]) => [key, value ?? previous[key as keyof AssistantAction]]),
  ) as unknown as AssistantAction
}

const normalize = (value: string) => value.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "")

export function isConfirmation(value: string) {
  return ["sim", "confirmo", "confirmar", "pode", "pode salvar", "salvar", "ok", "isso"].includes(normalize(value))
}

export function isCancellation(value: string) {
  return ["nao", "cancelar", "cancela", "cancelado", "esquece", "parar"].includes(normalize(value))
}
