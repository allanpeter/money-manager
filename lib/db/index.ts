import { drizzle } from "drizzle-orm/node-postgres"
import { sql } from "drizzle-orm"
import { Pool } from "pg"
import * as schema from "./schema"

let pool: Pool | undefined

function databaseUrl(): string {
  const value = process.env.DATABASE_URL
  if (!value) throw new Error("DATABASE_URL não configurada")
  const database = new URL(value).pathname.replace(/^\//, "")
  if (process.env.NODE_ENV !== "production" && database === "money_manager" && process.env.ALLOW_PRODUCTION_DATABASE !== "true") {
    throw new Error("O ambiente local não pode usar o banco de produção. Configure .env.local para money_manager_dev.")
  }
  return value
}

export function db() {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl(),
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
    })
  }
  return drizzle(pool, { schema })
}

export type Database = ReturnType<typeof db>

export async function withWorkspace<T>(workspaceId: string, callback: (database: Database) => Promise<T>): Promise<T> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId)) {
    throw new Error("Workspace inválido")
  }
  return db().transaction(async transaction => {
    await transaction.execute(sql`select set_config('app.workspace_id', ${workspaceId}, true)`)
    return callback(transaction as unknown as Database)
  })
}

export async function closeDatabase() {
  if (!pool) return
  await pool.end()
  pool = undefined
}
