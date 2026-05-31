import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Faq, type FaqItem } from "./Faq"
import { AppCta } from "./AppCta"

interface Props {
  title: string
  lead: string
  children: React.ReactNode
  faq?: FaqItem[]
  cta?: { title?: string; description?: string; href?: string; label?: string }
}

/** Shared layout for guide/article pages: back link, title, lead, prose body, FAQ and CTA. */
export function ArticleShell({ title, lead, children, faq, cta }: Readonly<Props>) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-cyan-400 text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao app
        </Link>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{title}</h1>
        <p className="text-zinc-400 mt-3 leading-relaxed">{lead}</p>

        <article className="mt-8 space-y-4 text-zinc-300 leading-relaxed [&_h2]:text-white [&_h2]:font-semibold [&_h2]:text-2xl [&_h2]:mt-10 [&_h2]:mb-3 [&_a]:text-cyan-400 hover:[&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_strong]:text-white">
          {children}
        </article>

        {faq && faq.length > 0 && <Faq items={faq} />}
        <AppCta {...cta} />
      </div>
    </div>
  )
}
