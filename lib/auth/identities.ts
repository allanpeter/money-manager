import { createHash, randomBytes } from "node:crypto"
import { and, eq, gt, isNotNull, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { externalIdentities, identityLinkCodes, users, workspaceMemberships } from "@/lib/db/schema"
import { LEGACY_USER_ID } from "./constants"

export type ExternalProvider = "discord" | "telegram" | "whatsapp"

export interface ExternalAuthContext {
  identityId: string
  userId: string
  workspaceId: string
  role: "owner" | "editor" | "viewer"
  provider: ExternalProvider
  externalUserId: string
  conversationId: string | null
}

const normalizeCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "")
const codeHash = (provider: ExternalProvider, code: string) => createHash("sha256").update(`${provider}:${normalizeCode(code)}`).digest("hex")

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = randomBytes(8)
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("")
}

export async function createIdentityLinkCode(input: { userId: string; workspaceId: string; provider: ExternalProvider }) {
  const code = randomCode()
  const expiresAt = new Date(Date.now() + 10 * 60_000)
  await db().transaction(async transaction => {
    await transaction.delete(identityLinkCodes).where(and(
      eq(identityLinkCodes.userId, input.userId),
      eq(identityLinkCodes.provider, input.provider),
      isNull(identityLinkCodes.consumedAt),
    ))
    await transaction.insert(identityLinkCodes).values({
      ...input,
      codeHash: codeHash(input.provider, code),
      expiresAt,
    })
  })
  return { code: `${code.slice(0, 4)}-${code.slice(4)}`, expiresAt }
}

export async function claimIdentityLink(input: {
  provider: ExternalProvider
  code: string
  externalUserId: string
  conversationId: string
  displayName?: string | null
}) {
  return db().transaction(async transaction => {
    const [link] = await transaction.select().from(identityLinkCodes).where(and(
      eq(identityLinkCodes.provider, input.provider),
      eq(identityLinkCodes.codeHash, codeHash(input.provider, input.code)),
      gt(identityLinkCodes.expiresAt, new Date()),
      isNull(identityLinkCodes.consumedAt),
    )).limit(1)
    if (!link) throw new Error("Código inválido ou expirado. Gere outro código no painel.")

    const [existingExternal] = await transaction.select().from(externalIdentities).where(and(
      eq(externalIdentities.provider, input.provider),
      eq(externalIdentities.externalUserId, input.externalUserId),
    )).limit(1)
    if (existingExternal && existingExternal.userId !== link.userId) throw new Error("Essa conta já está vinculada a outro usuário.")

    await transaction.delete(externalIdentities).where(and(
      eq(externalIdentities.userId, link.userId),
      eq(externalIdentities.provider, input.provider),
    ))
    const [identity] = await transaction.insert(externalIdentities).values({
      userId: link.userId,
      provider: input.provider,
      externalUserId: input.externalUserId,
      conversationId: input.conversationId,
      displayName: input.displayName ?? null,
    }).returning()
    await transaction.update(identityLinkCodes).set({ consumedAt: new Date() }).where(eq(identityLinkCodes.id, link.id))
    return identity
  })
}

export async function resolveExternalIdentity(input: {
  provider: ExternalProvider
  externalUserId: string
  conversationId?: string
}): Promise<ExternalAuthContext | null> {
  const [row] = await db().select({
    identityId: externalIdentities.id,
    userId: externalIdentities.userId,
    provider: externalIdentities.provider,
    externalUserId: externalIdentities.externalUserId,
    conversationId: externalIdentities.conversationId,
    workspaceId: workspaceMemberships.workspaceId,
    role: workspaceMemberships.role,
  }).from(externalIdentities)
    .innerJoin(workspaceMemberships, and(
      eq(workspaceMemberships.userId, externalIdentities.userId),
      eq(workspaceMemberships.isDefault, true),
    ))
    .where(and(
      eq(externalIdentities.provider, input.provider),
      eq(externalIdentities.externalUserId, input.externalUserId),
    )).limit(1)
  if (!row) return null
  if (input.conversationId && input.conversationId !== row.conversationId) {
    await db().update(externalIdentities).set({ conversationId: input.conversationId, updatedAt: new Date() }).where(eq(externalIdentities.id, row.identityId))
    row.conversationId = input.conversationId
  }
  return row
}

export async function bootstrapExternalIdentity(input: {
  provider: ExternalProvider
  externalUserId: string
  conversationId: string
  allowedIds: Set<string>
  displayName?: string | null
}) {
  if (!input.allowedIds.has(input.externalUserId)) return null
  const [bootstrapUser] = await db().select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, LEGACY_USER_ID)).limit(1)
  if (bootstrapUser?.passwordHash) return null
  await db().insert(externalIdentities).values({
    userId: LEGACY_USER_ID,
    provider: input.provider,
    externalUserId: input.externalUserId,
    conversationId: input.conversationId,
    displayName: input.displayName ?? null,
  }).onConflictDoNothing()
  return resolveExternalIdentity(input)
}

export async function listReminderTargets(provider: ExternalProvider) {
  return db().select({
    identityId: externalIdentities.id,
    userId: externalIdentities.userId,
    workspaceId: workspaceMemberships.workspaceId,
    externalUserId: externalIdentities.externalUserId,
    conversationId: externalIdentities.conversationId,
  }).from(externalIdentities)
    .innerJoin(workspaceMemberships, and(
      eq(workspaceMemberships.userId, externalIdentities.userId),
      eq(workspaceMemberships.isDefault, true),
    ))
    .where(and(eq(externalIdentities.provider, provider), isNotNull(externalIdentities.conversationId)))
}

export async function listUserIdentities(userId: string) {
  return db().select({
    provider: externalIdentities.provider,
    externalUserId: externalIdentities.externalUserId,
    displayName: externalIdentities.displayName,
    conversationId: externalIdentities.conversationId,
    updatedAt: externalIdentities.updatedAt,
  }).from(externalIdentities).where(eq(externalIdentities.userId, userId))
}
