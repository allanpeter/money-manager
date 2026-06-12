import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { ContentLink } from "@/lib/content"

export function ContentList({ items }: Readonly<{ items: ContentLink[] }>) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {items.map(item => (
        <Link
          key={item.path}
          href={item.path}
          className="group bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-cyan-500/30 transition-colors"
        >
          <h2 className="text-white font-semibold flex items-center justify-between gap-2">
            {item.title}
            <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
          </h2>
          <p className="text-zinc-500 text-sm mt-1.5">{item.description}</p>
        </Link>
      ))}
    </div>
  )
}
