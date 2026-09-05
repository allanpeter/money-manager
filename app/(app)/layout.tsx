import { redirect } from "next/navigation"
import { AppShell } from "@/components/app/AppShell"
import { getAuthContext } from "@/lib/auth/session"

export default async function AppGroupLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const auth = await getAuthContext()
  if (!auth) redirect("/login")
  return <AppShell userName={auth.userName} workspaceName={auth.workspaceName}>{children}</AppShell>
}
