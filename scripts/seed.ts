import { loadEnvConfig } from "@next/env"
import { eq } from "drizzle-orm"
import { withWorkspace } from "@/lib/db"
import { appSettings, financialProfiles } from "@/lib/db/schema"
import { ensureFinancialProfileDefaults } from "@/lib/financial-profiles/service"
import { LEGACY_WORKSPACE_ID } from "@/lib/auth/constants"

loadEnvConfig(process.cwd())

async function seed() {
  await withWorkspace(LEGACY_WORKSPACE_ID, async database => {
  let [profile] = await database.select({ id: financialProfiles.id }).from(financialProfiles).where(eq(financialProfiles.workspaceId, LEGACY_WORKSPACE_ID)).limit(1)
  if (!profile) [profile] = await database.insert(financialProfiles).values({ workspaceId: LEGACY_WORKSPACE_ID, name: "Pessoa Física", type: "person" }).returning({ id: financialProfiles.id })
  await ensureFinancialProfileDefaults(database, LEGACY_WORKSPACE_ID, profile.id)
  await database.insert(appSettings).values({ workspaceId: LEGACY_WORKSPACE_ID }).onConflictDoNothing()
  })
}

seed().then(() => process.exit(0)).catch(error => {
  console.error(error)
  process.exit(1)
})
