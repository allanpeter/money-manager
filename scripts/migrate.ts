import { migrate } from "drizzle-orm/node-postgres/migrator"
import { closeDatabase, db } from "@/lib/db"

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
