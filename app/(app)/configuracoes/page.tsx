import { IntegrationSettings } from "@/components/app/IntegrationSettings"
import { listUserIdentities } from "@/lib/auth/identities"
import { getAuthContext } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const auth = await getAuthContext()
  if (!auth) return null
  const identities = await listUserIdentities(auth.userId)
  const linked = Object.fromEntries(identities.map(identity => [identity.provider, identity.displayName ?? identity.externalUserId]))
  return <section className="space-y-4"><header className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><h2 className="text-lg font-semibold">Canais da IA</h2><p className="mt-1 text-sm text-zinc-500">Vincule cada canal ao usuário autenticado. Códigos expiram em 10 minutos.</p></header><IntegrationSettings linked={linked} /></section>
}
