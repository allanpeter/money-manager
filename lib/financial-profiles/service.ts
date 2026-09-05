import { and, asc, eq, isNull } from "drizzle-orm"
import { withWorkspace, type Database } from "@/lib/db"
import { accountCategories, financialProfiles, wallets } from "@/lib/db/schema"

export type FinancialProfileType = "person" | "business" | "dependent" | "other"

const DEFAULT_CATEGORIES = ["Moradia", "Serviços", "Cartões", "Impostos", "Outros", "Importado"]

export async function ensureFinancialProfileDefaults(database: Database, workspaceId: string, profileId: string) {
  const [wallet] = await database.select({ id: wallets.id }).from(wallets).where(and(
    eq(wallets.workspaceId, workspaceId),
    eq(wallets.profileId, profileId),
  )).limit(1)
  if (!wallet) await database.insert(wallets).values({ workspaceId, profileId, name: "Pessoal", color: "#06b6d4" })

  const categories = await database.select({ name: accountCategories.name }).from(accountCategories).where(and(
    eq(accountCategories.workspaceId, workspaceId),
    eq(accountCategories.profileId, profileId),
  ))
  const existing = new Set(categories.map(category => category.name))
  const missing = DEFAULT_CATEGORIES
    .map((name, sortOrder) => ({ workspaceId, profileId, name, sortOrder }))
    .filter(category => !existing.has(category.name))
  if (missing.length) await database.insert(accountCategories).values(missing)
}

export async function listFinancialProfiles(workspaceId: string) {
  return withWorkspace(workspaceId, database => database.select({
    id: financialProfiles.id,
    name: financialProfiles.name,
    type: financialProfiles.type,
    color: financialProfiles.color,
  }).from(financialProfiles).where(and(
    eq(financialProfiles.workspaceId, workspaceId),
    isNull(financialProfiles.archivedAt),
  )).orderBy(asc(financialProfiles.createdAt)))
}

export async function createFinancialProfile(workspaceId: string, input: { name: string; type: FinancialProfileType; color?: string }) {
  const name = input.name.trim()
  if (name.length < 2 || name.length > 80) throw new Error("O nome do perfil deve ter entre 2 e 80 caracteres.")
  if (!(["person", "business", "dependent", "other"] as string[]).includes(input.type)) throw new Error("Tipo de perfil inválido.")
  const color = /^#[0-9a-fA-F]{6}$/.test(input.color ?? "") ? input.color! : "#06b6d4"
  return withWorkspace(workspaceId, async database => {
    const [profile] = await database.insert(financialProfiles).values({ workspaceId, name, type: input.type, color }).returning()
    await ensureFinancialProfileDefaults(database, workspaceId, profile.id)
    return profile
  })
}
