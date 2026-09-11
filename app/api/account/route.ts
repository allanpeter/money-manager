import { eq } from "drizzle-orm"
import { getAuthContext } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"

export const runtime = "nodejs"

function normalizePhone(value: string): string | null {
  let digits = value.replace(/\D/g, "")
  if (!digits) return null
  if (digits.length <= 11 && !digits.startsWith("55")) digits = `55${digits}`
  if (digits.length < 10 || digits.length > 15) throw new Error("Informe um telefone com DDD válido.")
  return `+${digits}`
}

const tones = ["warm", "balanced", "direct"] as const
const verbosityOptions = ["brief", "balanced", "detailed"] as const

function validOption<T extends readonly string[]>(value: unknown, options: T): value is T[number] {
  return typeof value === "string" && (options as readonly string[]).includes(value)
}

export async function PATCH(request: Request) {
  const auth = await getAuthContext()
  if (!auth) return Response.json({ error: "Não autenticado." }, { status: 401 })

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : null
    const preferredName = typeof body.assistantPreferredName === "string" ? body.assistantPreferredName.trim() : ""
    const assistantTone = body.assistantTone
    const assistantVerbosity = body.assistantVerbosity
    const assistantGreetings = body.assistantGreetings
    if (name.length < 2 || name.length > 120) {
      return Response.json({ error: "Informe seu nome completo." }, { status: 400 })
    }
    if (preferredName.length > 60) return Response.json({ error: "O nome preferido deve ter no máximo 60 caracteres." }, { status: 400 })
    if (!validOption(assistantTone, tones) || !validOption(assistantVerbosity, verbosityOptions) || typeof assistantGreetings !== "boolean") {
      return Response.json({ error: "Preferências do assistente inválidas." }, { status: 400 })
    }
    const [user] = await db().update(users).set({
      name, phone, assistantPreferredName: preferredName || null,
      assistantTone, assistantVerbosity, assistantGreetings, updatedAt: new Date(),
    }).where(eq(users.id, auth.userId)).returning({ name: users.name, phone: users.phone })
    return Response.json(user)
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível salvar os dados." }, { status: 400 })
  }
}
