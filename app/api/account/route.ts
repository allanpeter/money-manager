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

export async function PATCH(request: Request) {
  const auth = await getAuthContext()
  if (!auth) return Response.json({ error: "Não autenticado." }, { status: 401 })

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : null
    if (name.length < 2 || name.length > 120) {
      return Response.json({ error: "Informe seu nome completo." }, { status: 400 })
    }
    const [user] = await db().update(users).set({ name, phone, updatedAt: new Date() })
      .where(eq(users.id, auth.userId)).returning({ name: users.name, phone: users.phone })
    return Response.json(user)
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível salvar os dados." }, { status: 400 })
  }
}
