export interface FaqItem {
  q: string
  a: string
}

interface Props {
  items: FaqItem[]
  heading?: string
}

/** Renders an accessible FAQ list plus FAQPage JSON-LD for rich results. */
export function Faq({ items, heading = "Perguntas frequentes" }: Readonly<Props>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  }

  return (
    <section className="mt-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h2 className="text-white font-semibold text-2xl mb-3">{heading}</h2>
      <div className="space-y-3">
        {items.map(({ q, a }) => (
          <details key={q} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 group">
            <summary className="text-white font-medium cursor-pointer list-none flex items-center justify-between gap-3">
              {q}
              <span className="text-zinc-500 group-open:rotate-180 transition-transform flex-shrink-0">⌄</span>
            </summary>
            <p className="text-zinc-400 text-sm mt-3 leading-relaxed">{a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
