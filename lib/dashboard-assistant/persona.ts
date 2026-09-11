import { and, eq } from "drizzle-orm"
import { withWorkspace } from "@/lib/db"
import { appSettings, users, workspaceMemberships } from "@/lib/db/schema"

export interface DashboardAssistantPersona {
  preferredName: string
  tone: "warm" | "balanced" | "direct"
  verbosity: "brief" | "balanced" | "detailed"
  greetings: boolean
  timezone: string
}

export async function getDashboardAssistantPersona(workspaceId: string, userId: string): Promise<DashboardAssistantPersona> {
  return withWorkspace(workspaceId, async database => {
    const [[user], [settings]] = await Promise.all([
      database.select({
        name: users.name,
        preferredName: users.assistantPreferredName,
        tone: users.assistantTone,
        verbosity: users.assistantVerbosity,
        greetings: users.assistantGreetings,
      }).from(users).innerJoin(workspaceMemberships, and(
        eq(workspaceMemberships.userId, users.id),
        eq(workspaceMemberships.workspaceId, workspaceId),
      )).where(eq(users.id, userId)).limit(1),
      database.select({ timezone: appSettings.timezone }).from(appSettings).where(eq(appSettings.workspaceId, workspaceId)).limit(1),
    ])
    if (!user) throw new Error("Preferências do assistente não encontradas.")
    return {
      preferredName: user.preferredName?.trim() || user.name.trim().split(/\s+/)[0] || "",
      tone: user.tone,
      verbosity: user.verbosity,
      greetings: user.greetings,
      timezone: settings?.timezone ?? "America/Sao_Paulo",
    }
  })
}

function formatter(timezone: string, option: Intl.DateTimeFormatOptions) {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, ...option }) }
  catch { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", ...option }) }
}

function localPart(timezone: string, option: Intl.DateTimeFormatOptions) {
  return formatter(timezone, option).format(new Date())
}

export function localDateId(timezone: string) {
  const parts = formatter(timezone, { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value
  return `${value("year")}-${value("month")}-${value("day")}`
}

export function greetingForPersona(persona: DashboardAssistantPersona) {
  const hour = Number(localPart(persona.timezone, { hour: "2-digit", hourCycle: "h23" }))
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"
  return persona.preferredName ? `${greeting}, ${persona.preferredName}.` : `${greeting}.`
}
