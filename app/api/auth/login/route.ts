import { authenticate, createSession } from "@/lib/auth/session"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const email = typeof body.email === "string" ? body.email : ""
  const password = typeof body.password === "string" ? body.password : ""
  const user = await authenticate(email, password)
  if (!user) return Response.json({ error: "E-mail ou senha inválidos." }, { status: 401 })
  await createSession(user.id)
  return Response.json({ ok: true })
}
