import { useEffect, useState } from 'react'
import { scryfallJson } from '../cards/scryfallClient'

export function useKeywordCatalog(enabled: boolean): string[] {
  const [keywords, setKeywords] = useState<string[]>([])
  useEffect(() => {
    if (!enabled || keywords.length > 0) return
    let alive = true
    void scryfallJson<{ data?: string[] }>('https://api.scryfall.com/catalog/keyword-abilities', { persist: true }).then((res) => {
      if (alive && res?.data) setKeywords(res.data)
    })
    return () => { alive = false }
  }, [enabled, keywords.length])
  return keywords
}

export function matchingKeywords(
  popular: readonly string[],
  catalog: readonly string[],
  query: string,
  labelOf: (keyword: string) => string,
  limit = 60,
): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...popular]
  const seen = new Set<string>()
  const out: string[] = []
  for (const kw of [...popular, ...[...catalog].sort((a, b) => a.localeCompare(b))]) {
    const key = kw.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    if (key.includes(q) || labelOf(kw).toLowerCase().includes(q)) out.push(kw)
    if (out.length >= limit) break
  }
  return out
}
