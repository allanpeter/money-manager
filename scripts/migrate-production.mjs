import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada")

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
})

try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" })
  console.info("database migrations applied")
} finally {
  await pool.end()
}
