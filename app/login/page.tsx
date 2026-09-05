import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth/AuthForm"
import { AuthPage } from "@/components/auth/AuthPage"
import { getAuthContext } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

export default async function LoginPage() {
  if (await getAuthContext()) redirect("/contas")
  return <AuthPage title="Entrar" description="Acesse somente o seu espaço financeiro."><AuthForm mode="login" /></AuthPage>
}
