import { and, desc, eq } from "drizzle-orm"
import { withWorkspace } from "@/lib/db"
import { assistantCommands } from "@/lib/db/schema"
import { getAuthContext } from "@/lib/auth/session"
import { WebAssistantChat } from "@/components/app/WebAssistantChat"

export const dynamic = "force-dynamic"

const statusLabel = {
  received: "Recebido",
  pending: "Aguardando",
  confirmed: "Confirmado",
  executed: "Executado",
  rejected: "Cancelado",
  failed: "Falhou",
}

export default async function AssistantPage() {
  const auth = await getAuthContext()
  if (!auth) return null
  const commands = await withWorkspace(auth.workspaceId, database => database.select().from(assistantCommands)
    .where(and(
      eq(assistantCommands.workspaceId, auth.workspaceId),
      eq(assistantCommands.userId, auth.userId),
    )).orderBy(desc(assistantCommands.createdAt)).limit(50))

  return (
    <section className="space-y-4">
      <WebAssistantChat initialMessages={[]} />
      <details className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-zinc-300 marker:text-zinc-600">Histórico e auditoria</summary>
        <div className="border-t border-zinc-800">
          <p className="px-5 pt-4 text-xs text-zinc-600">Últimos comandos deste usuário no Web, Discord e Telegram.</p>
          {commands.length ? commands.map(command => {
            const result = command.result as { message?: string } | null
            return (
              <article key={command.id} className="border-b border-zinc-800 p-4 last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-cyan-300">{statusLabel[command.status]}</span>
                  <time className="text-xs text-zinc-600">{command.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time>
                </div>
                <p className="mt-2 text-sm text-zinc-200">{command.rawText}</p>
                {result?.message && <p className="mt-1 whitespace-pre-line text-xs text-zinc-500">{result.message}</p>}
              </article>
            )
          }) : <p className="p-8 text-center text-sm text-zinc-500">Nenhum comando recebido ainda.</p>}
        </div>
      </details>
    </section>
  )
}
