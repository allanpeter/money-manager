import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth/AuthForm"
import { AuthPage } from "@/components/auth/AuthPage"
import { getAuthContext } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

export default async function RegisterPage() {
  if (await getAuthContext()) redirect("/contas")
  return <AuthPage title="Criar conta" description="Cadastre-se para criar seu espaço financeiro privado."><AuthForm mode="register" /></AuthPage>
}
