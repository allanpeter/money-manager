import { createHash, randomBytes } from "node:crypto"
import { sql } from "drizzle-orm"
import { and, eq, gt, isNull } from "drizzle-orm"
import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { appSettings, financialProfiles, userSessions, users, workspaceMemberships, workspaces } from "@/lib/db/schema"
import { ensureFinancialProfileDefaults } from "@/lib/financial-profiles/service"
import type { Database } from "@/lib/db"
import { LEGACY_USER_ID, LEGACY_WORKSPACE_ID, SESSION_COOKIE } from "./constants"
import { hashPassword, validPassword, verifyPassword } from "./password"

const SESSION_DAYS = 30

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex")
const normalizeEmail = (email: string) => email.trim().toLocaleLowerCase("en-US")

export interface AuthContext {
  userId: string
  userName: string
  email: string
  workspaceId: string
  workspaceName: string
  role: "owner" | "editor" | "viewer"
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  const [row] = await db().select({
    userId: users.id,
    userName: users.name,
    email: users.email,
    workspaceId: workspaces.id,
    workspaceName: workspaces.name,
    role: workspaceMemberships.role,
  }).from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .innerJoin(workspaceMemberships, and(eq(workspaceMemberships.userId, users.id), eq(workspaceMemberships.isDefault, true)))
    .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
    .where(and(
      eq(userSessions.tokenHash, tokenHash(token)),
      gt(userSessions.expiresAt, new Date()),
      isNull(userSessions.revokedAt),
      isNull(users.disabledAt),
    )).limit(1)
  return row ?? null
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url")
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000)
  await db().insert(userSessions).values({ userId, tokenHash: tokenHash(token), expiresAt })
  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.AUTH_COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  })
}

export async function deleteSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) await db().update(userSessions).set({ revokedAt: new Date() }).where(eq(userSessions.tokenHash, tokenHash(token)))
  cookieStore.delete(SESSION_COOKIE)
}

export async function authenticate(email: string, password: string) {
  const [user] = await db().select().from(users).where(and(eq(users.email, normalizeEmail(email)), isNull(users.disabledAt))).limit(1)
  if (!user?.passwordHash || !await verifyPassword(password, user.passwordHash)) return null
  return user
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505"
}

export async function registerUser(input: { name: string; email: string; password: string }) {
  const name = input.name.trim()
  const email = normalizeEmail(input.email)
  if (name.length < 2) throw new Error("Informe seu nome.")
  if (!/^\S+@\S+\.\S+$/.test(input.email)) throw new Error("E-mail inválido.")
  if (!validPassword(input.password)) throw new Error("A senha deve ter pelo menos 12 caracteres, letra, número e símbolo.")
  const passwordHash = await hashPassword(input.password)

  try {
    return await db().transaction(async transaction => {
      await transaction.execute(sql`select id from users where id = ${LEGACY_USER_ID} for update`)
      const [legacyUser] = await transaction.select().from(users).where(eq(users.id, LEGACY_USER_ID)).limit(1)
      const [existingUser] = await transaction.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)

      let userId: string
      let workspaceId: string

      if (legacyUser && !legacyUser.passwordHash) {
        if (existingUser && existingUser.id !== LEGACY_USER_ID) throw new Error("Este e-mail já está cadastrado.")
        userId = LEGACY_USER_ID
        workspaceId = LEGACY_WORKSPACE_ID
        await transaction.update(users).set({ name, email, passwordHash, updatedAt: new Date() }).where(eq(users.id, userId))
        await transaction.update(workspaces).set({ name: `Pessoal — ${name}`, updatedAt: new Date() }).where(eq(workspaces.id, workspaceId))
      } else {
        if (existingUser) throw new Error("Este e-mail já está cadastrado.")
        const [user] = await transaction.insert(users).values({ name, email, passwordHash }).returning({ id: users.id })
        const [workspace] = await transaction.insert(workspaces).values({ name: `Pessoal — ${name}` }).returning({ id: workspaces.id })
        userId = user.id
        workspaceId = workspace.id
        await transaction.insert(workspaceMemberships).values({ userId, workspaceId, role: "owner", isDefault: true })
      }

      await transaction.execute(sql`select set_config('app.workspace_id', ${workspaceId}, true)`)
      let [profile] = await transaction.select({ id: financialProfiles.id }).from(financialProfiles)
        .where(eq(financialProfiles.workspaceId, workspaceId)).limit(1)
      if (!profile) [profile] = await transaction.insert(financialProfiles).values({ workspaceId, name: "Pessoa Física", type: "person" }).returning({ id: financialProfiles.id })
      await ensureFinancialProfileDefaults(transaction as unknown as Database, workspaceId, profile.id)
      await transaction.insert(appSettings).values({ workspaceId }).onConflictDoNothing()

      return { userId, workspaceId }
    })
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error("Este e-mail já está cadastrado.")
    throw error
  }
}
