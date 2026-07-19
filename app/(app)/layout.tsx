import { AppShell } from "@/components/app/AppShell"

export default function AppGroupLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>
}
