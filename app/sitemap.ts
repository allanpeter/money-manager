import type { MetadataRoute } from "next"
import { CALCULATORS, GUIDES } from "@/lib/content"

// Override with NEXT_PUBLIC_SITE_URL if the domain changes.
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://financeiro.apps.allanpimentel.com"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const routes = [
    { path: "/", priority: 1 },
    { path: "/calculadoras", priority: 0.7 },
    { path: "/guias", priority: 0.7 },
    ...CALCULATORS.map(c => ({ path: c.path, priority: 0.8 })),
    ...GUIDES.map(g => ({ path: g.path, priority: 0.6 })),
    { path: "/privacidade", priority: 0.3 },
    { path: "/termos", priority: 0.3 },
  ]
  return routes.map(({ path, priority }) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority,
  }))
}
