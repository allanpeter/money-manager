import { createSession, registerUser } from "@/lib/auth/session"
import { publicarEventoHub } from "@/lib/product-ops/hub"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const result = await registerUser({
      name: typeof body.name === "string" ? body.name : "",
      email: typeof body.email === "string" ? body.email : "",
      password: typeof body.password === "string" ? body.password : "",
    })
    await publicarEventoHub({
      tipo: "novo_usuario",
      atorEmail: typeof body.email === "string" ? body.email.trim().toLocaleLowerCase("en-US") : undefined,
      payload: { workspaceId: result.workspaceId },
    })
    await createSession(result.userId)
    return Response.json({ ok: true }, { status: 201 })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível criar a conta." }, { status: 400 })
  }
}
