import { useEffect, useState, useRef } from 'react'

export interface ScryfallSearchCard {
  id: string
  name: string
  set: string
  collector_number: string
  mana_cost?: string
  cmc: number
  type_line: string
  colors: string[]
  color_identity: string[]
  image_uris?: { small: string; normal: string; art_crop: string }
  card_faces?: { image_uris?: { small: string; normal: string; art_crop: string }; mana_cost?: string; type_line?: string }[]
}

export interface ScryfallSearchResult {
  data: ScryfallSearchCard[]
  has_more: boolean
  next_page?: string
  total_cards?: number
}

const SCRYFALL_SEARCH_DELAY_MS = 75
let lastSearchAt = 0
async function throttleSearch() {
  const now = Date.now()
  const wait = SCRYFALL_SEARCH_DELAY_MS - (now - lastSearchAt)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastSearchAt = Date.now()
}

export async function searchScryfall(query: string, page = 1): Promise<ScryfallSearchResult> {
  const q = query.trim()
  if (!q) return { data: [], has_more: false }
  await throttleSearch()
  const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&unique=cards&order=cmc&page=${page}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal })
    if (res.status === 404) return { data: [], has_more: false }
    if (!res.ok) throw new Error(`Scryfall ${res.status}`)
    const data = (await res.json()) as ScryfallSearchResult
    return data
  } finally {
    clearTimeout(timer)
  }
}

export function useScryfallSearch(query: string, debounceMs = 350) {
  const [result, setResult] = useState<ScryfallSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryRef = useRef(query)

  useEffect(() => {
    queryRef.current = query
    if (!query.trim()) {
      setResult(null)
      setError(null)
      setLoading(false)
      return
    }
    const t = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const r = await searchScryfall(queryRef.current, 1)
        if (queryRef.current === query) setResult(r)
      } catch (e) {
        if (queryRef.current === query) setError((e as Error).message)
      } finally {
        if (queryRef.current === query) setLoading(false)
      }
    }, debounceMs)
    return () => clearTimeout(t)
  }, [query, debounceMs])

  return { result, loading, error }
}

export function scryfallCardImage(card: ScryfallSearchCard): string | null {
  if (card.image_uris?.normal) return card.image_uris.normal
  if (card.image_uris?.small) return card.image_uris.small
  if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal
  return null
}
export function scryfallCardArtCrop(card: ScryfallSearchCard): string | null {
  if (card.image_uris?.art_crop) return card.image_uris.art_crop
  if (card.card_faces?.[0]?.image_uris?.art_crop) return card.card_faces[0].image_uris.art_crop
  return scryfallCardImage(card)
}
