import { getAuthContext } from "@/lib/auth/session"
import { parseC6InvoiceCsv } from "@/lib/accounts/import-c6-invoice"

export const runtime = "nodejs"

const MAX_FILE_SIZE = 5 * 1024 * 1024

function fileError(file: FormDataEntryValue | null) {
  if (!(file instanceof File)) return "Selecione um arquivo CSV."
  if (!file.name.toLocaleLowerCase("pt-BR").endsWith(".csv")) return "Selecione um arquivo CSV do C6."
  if (!file.size) return "O arquivo está vazio."
  if (file.size > MAX_FILE_SIZE) return "O CSV deve ter no máximo 5 MB."
  return null
}

export async function POST(request: Request) {
  const auth = await getAuthContext()
  if (!auth) return Response.json({ error: "Não autenticado." }, { status: 401 })
  try {
    const form = await request.formData()
    const file = form.get("file")
    const error = fileError(file)
    if (error) return Response.json({ error }, { status: 400 })
    const parsed = parseC6InvoiceCsv(Buffer.from(await (file as File).arrayBuffer()))
    return Response.json({
      filename: (file as File).name,
      checksum: parsed.checksum,
      cards: parsed.cards,
      paymentCount: parsed.paymentCount,
      issueCount: parsed.issues.length,
      issues: parsed.issues,
    })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível ler o CSV do C6." }, { status: 400 })
  }
}
