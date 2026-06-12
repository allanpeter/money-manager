import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-900 bg-zinc-950">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
        <p className="text-zinc-600">
          © {new Date().getFullYear()} Gestor Financeiro
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-zinc-500">
          <Link href="/" className="hover:text-cyan-400 transition-colors">App</Link>
          <Link href="/calculadoras" className="hover:text-cyan-400 transition-colors">Calculadoras</Link>
          <Link href="/guias" className="hover:text-cyan-400 transition-colors">Guias</Link>
          <Link href="/privacidade" className="hover:text-cyan-400 transition-colors">Privacidade</Link>
          <Link href="/termos" className="hover:text-cyan-400 transition-colors">Termos</Link>
        </nav>
      </div>
    </footer>
  )
}
