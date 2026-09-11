import { loadEnvConfig } from "@next/env"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { closeDatabase, db } from "@/lib/db"

loadEnvConfig(process.cwd())

async function main() {
  try {
    await migrate(db(), { migrationsFolder: "./drizzle" })
    console.info("migrations applied successfully")
  } finally {
    await closeDatabase()
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
