import { ConsolidatedPageClient } from "./ConsolidatedPageClient"

export default function ConsolidatedPage() {
  return <ConsolidatedPageClient referenceDate={new Date().toISOString()} />
}
