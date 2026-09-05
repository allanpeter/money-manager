export function AuthPage({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-white"><section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl"><h1 className="text-2xl font-bold">{title}</h1><p className="mb-6 mt-1 text-sm text-zinc-500">{description}</p>{children}</section></main>
}
