import { useEffect, useState, useRef } from 'react'
import { scryfallFetch, scryfallThrottleMs } from '../cards/scryfallClient'

/** Scryfall limita por IP: no es un fallo de la búsqueda, es esperar y repetir. */
export class ScryfallRateLimitError extends Error {
  constructor() {
    super('Scryfall 429')
    this.name = 'ScryfallRateLimitError'
  }
}

const THROTTLE_RETRY_GRACE_MS = 500
const MAX_THROTTLE_RETRIES = 3

export interface ScryfallSearchCard {
  id: string
  name: string
  printed_name?: string
  lang?: string
  set: string
  collector_number: string
  mana_cost?: string
  cmc: number
  type_line: string
  printed_type_line?: string
  colors: string[]
  color_identity: string[]
  oracle_text?: string
  keywords?: string[]
  legalities?: Record<string, 'legal' | 'not_legal' | 'banned' | 'restricted'>
  image_uris?: { small: string; normal: string; art_crop: string }
  card_faces?: {
    name?: string
    printed_name?: string
    image_uris?: { small: string; normal: string; art_crop: string }
    mana_cost?: string
    type_line?: string
    printed_type_line?: string
  }[]
}

export interface ScryfallSearchResult {
  data: ScryfallSearchCard[]
  has_more: boolean
  next_page?: string
  total_cards?: number
}

export type ScryfallSortOrder = 'cmc' | 'name' | 'rarity' | 'color' | 'edhrec' | 'released'
export type ScryfallSortDir = 'asc' | 'desc'
export const DEFAULT_SORT_ORDER: ScryfallSortOrder = 'cmc'

export async function searchScryfall(query: string, page = 1, lang?: string, order: ScryfallSortOrder = DEFAULT_SORT_ORDER, dir: ScryfallSortDir = 'asc'): Promise<ScryfallSearchResult> {
  const q = query.trim()
  if (!q) return { data: [], has_more: false }

  const execute = async (searchQuery: string): Promise<ScryfallSearchResult> => {
    const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(searchQuery)}&unique=cards&order=${order}&dir=${dir}&page=${page}`
    const res = await scryfallFetch(url, { urgent: true, timeoutMs: 10000 })
    if (res.status === 404) return { data: [], has_more: false }
    if (res.status === 429) throw new ScryfallRateLimitError()
    if (!res.ok) throw new Error(`Scryfall ${res.status}`)
    return (await res.json()) as ScryfallSearchResult
  }

  if (lang && !q.includes('lang:')) {
    if (lang === 'any' || lang === 'all') {
      return execute(`lang:any ${q}`)
    }
    const primary = await execute(`lang:${lang} ${q}`)
    if (primary.data && primary.data.length > 0) return primary
    if (page === 1) {
      return execute(`lang:any ${q}`)
    }
    return primary
  }

  return execute(q)
}

export function useScryfallSearch(query: string, lang?: string, debounceMs = 350, order: ScryfallSortOrder = DEFAULT_SORT_ORDER, dir: ScryfallSortDir = 'asc') {
  const [cards, setCards] = useState<ScryfallSearchCard[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [totalCards, setTotalCards] = useState<number | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [throttled, setThrottled] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)
  const queryRef = useRef(query)
  const langRef = useRef(lang)
  const orderRef = useRef(order)
  const dirRef = useRef(dir)
  const pageRef = useRef(1)
  const throttleRetriesRef = useRef(0)

  useEffect(() => {
    queryRef.current = query
    langRef.current = lang
    orderRef.current = order
    dirRef.current = dir
    pageRef.current = 1
    if (!query.trim()) {
      setCards([])
      setHasMore(false)
      setTotalCards(undefined)
      setError(null)
      setThrottled(false)
      setLoading(false)
      return
    }
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    const t = setTimeout(async () => {
      setLoading(true)
      setError(null)
      const isCurrent = () =>
        queryRef.current === query && langRef.current === lang && orderRef.current === order && dirRef.current === dir
      try {
        const r = await searchScryfall(queryRef.current, 1, langRef.current, orderRef.current, dirRef.current)
        if (isCurrent()) {
          setCards(r.data)
          setHasMore(r.has_more)
          setTotalCards(r.total_cards ?? (r.data.length === 0 ? 0 : undefined))
          setThrottled(false)
          throttleRetriesRef.current = 0
          pageRef.current = 1
        }
      } catch (e) {
        if (!isCurrent()) return
        if (e instanceof ScryfallRateLimitError && throttleRetriesRef.current < MAX_THROTTLE_RETRIES) {
          throttleRetriesRef.current++
          setThrottled(true)
          retryTimer = setTimeout(() => setRetryNonce((n) => n + 1), scryfallThrottleMs() + THROTTLE_RETRY_GRACE_MS)
          return
        }
        setThrottled(false)
        setError((e as Error).message)
      } finally {
        if (isCurrent()) setLoading(false)
      }
    }, debounceMs)
    return () => {
      clearTimeout(t)
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [query, lang, debounceMs, order, dir, retryNonce])

  const loadMore = async () => {
    if (loading || loadingMore || !hasMore) return
    const nextPage = pageRef.current + 1
    setLoadingMore(true)
    try {
      const r = await searchScryfall(queryRef.current, nextPage, langRef.current, orderRef.current, dirRef.current)
      if (queryRef.current === query && langRef.current === lang && orderRef.current === order && dirRef.current === dir) {
        setCards((prev) => [...prev, ...r.data])
        setHasMore(r.has_more)
        pageRef.current = nextPage
      }
    } catch {
      // ignore
    } finally {
      setLoadingMore(false)
    }
  }

  const retry = () => {
    throttleRetriesRef.current = 0
    setRetryNonce((n) => n + 1)
  }

  return { cards, loading, loadingMore, hasMore, totalCards, error, throttled, loadMore, retry }
}

export function scryfallCardImage(card: ScryfallSearchCard): string | null {
  if (card.image_uris?.normal) return card.image_uris.normal
  if (card.image_uris?.small) return card.image_uris.small
  if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal
  return null
}
export function scryfallCardBackImage(card: ScryfallSearchCard): string | null {
  if (card.card_faces && card.card_faces.length > 1) {
    return card.card_faces[1].image_uris?.normal ?? card.card_faces[1].image_uris?.small ?? null
  }
  return null
}
export function scryfallCardArtCrop(card: ScryfallSearchCard): string | null {
  if (card.image_uris?.art_crop) return card.image_uris.art_crop
  if (card.card_faces?.[0]?.image_uris?.art_crop) return card.card_faces[0].image_uris.art_crop
  return scryfallCardImage(card)
}
