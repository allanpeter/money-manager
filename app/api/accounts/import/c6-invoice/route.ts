import { getAuthContext } from "@/lib/auth/session"
import { parseC6InvoiceCsv } from "@/lib/accounts/import-c6-invoice"
import { importC6Invoice } from "@/lib/accounts/import-c6-invoice-service"

export const runtime = "nodejs"

const MAX_FILE_SIZE = 5 * 1024 * 1024
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

function parseMappings(value: FormDataEntryValue | null) {
  if (typeof value !== "string") throw new Error("Mapeie os cartões do arquivo para as contas cadastradas.")
  const parsed = JSON.parse(value) as unknown
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Mapeamento de cartões inválido.")
  const mappings = Object.entries(parsed)
  if (mappings.some(([lastFour, accountId]) => !/^\d{4}$/.test(lastFour) || typeof accountId !== "string" || !/^[0-9a-f-]{36}$/i.test(accountId))) {
    throw new Error("Mapeamento de cartões inválido.")
  }
  return Object.fromEntries(mappings) as Record<string, string>
}

function validateFile(file: FormDataEntryValue | null): File {
  if (!(file instanceof File) || !file.name.toLocaleLowerCase("pt-BR").endsWith(".csv")) throw new Error("Selecione um arquivo CSV do C6.")
  if (!file.size) throw new Error("O arquivo está vazio.")
  if (file.size > MAX_FILE_SIZE) throw new Error("O CSV deve ter no máximo 5 MB.")
  return file
}

export async function POST(request: Request) {
  const auth = await getAuthContext()
  if (!auth) return Response.json({ error: "Não autenticado." }, { status: 401 })
  if (auth.role === "viewer") return Response.json({ error: "Acesso somente leitura." }, { status: 403 })

  try {
    const form = await request.formData()
    const file = validateFile(form.get("file"))
    const profileId = String(form.get("profileId") ?? "")
    const referenceMonth = String(form.get("referenceMonth") ?? "")
    if (!/^[0-9a-f-]{36}$/i.test(profileId) || !MONTH_PATTERN.test(referenceMonth)) return Response.json({ error: "Informe perfil e mês da fatura." }, { status: 400 })
    const mappings = parseMappings(form.get("mappings"))
    const parsed = parseC6InvoiceCsv(Buffer.from(await file.arrayBuffer()))
    if (parsed.issues.length) return Response.json({ error: "O CSV possui linhas inválidas. Corrija o arquivo antes de importar.", issues: parsed.issues }, { status: 400 })
    if (parsed.cards.some(card => !mappings[card.lastFour])) return Response.json({ error: "Mapeie todos os cartões encontrados no CSV." }, { status: 400 })

    const result = await importC6Invoice({
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      filename: file.name,
      profileId,
      referenceMonth,
      mappings,
      parsed,
    })
    return Response.json(result, { status: 201 })
  } catch (error) {
    console.error("POST /api/accounts/import/c6-invoice", error)
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível importar a fatura do C6." }, { status: 500 })
  }
}
