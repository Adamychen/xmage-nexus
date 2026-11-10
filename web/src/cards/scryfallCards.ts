import { primeScryfallJson, scryfallCachedJson, scryfallFetch, scryfallJson } from './scryfallClient'

export interface ScryfallImageUris {
  small?: string
  normal?: string
  art_crop?: string
}

export interface ScryfallCardFaceJson {
  name?: string
  printed_name?: string
  mana_cost?: string
  type_line?: string
  printed_type_line?: string
  oracle_text?: string
  printed_text?: string
  colors?: string[]
  image_uris?: ScryfallImageUris
}

export interface ScryfallCardJson {
  id?: string
  name?: string
  printed_name?: string
  lang?: string
  set?: string
  collector_number?: string
  layout?: string
  mana_cost?: string
  cmc?: number
  type_line?: string
  printed_type_line?: string
  oracle_text?: string
  printed_text?: string
  keywords?: string[]
  colors?: string[]
  color_identity?: string[]
  rarity?: string
  legalities?: Record<string, 'legal' | 'not_legal' | 'banned' | 'restricted'>
  power?: string
  toughness?: string
  image_uris?: ScryfallImageUris
  card_faces?: ScryfallCardFaceJson[]
}

export interface CardRef {
  cardName: string
  setCode?: string
  cardNumber?: string
}

export function hasPrinting(card: CardRef): boolean {
  return !!card.setCode && !!card.cardNumber && card.cardNumber !== '0'
}

function printingUrl(card: CardRef, lang?: string): string {
  const base = `https://api.scryfall.com/cards/${card.setCode!.toLowerCase()}/${encodeURIComponent(card.cardNumber!)}`
  return lang ? `${base}/${lang}?format=json` : `${base}?format=json`
}

/** URL of an exact-name lookup, optionally restricted to one set (what /cards/named answers). */
export function namedCardUrl(name: string, setCode?: string): string {
  const base = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`
  return setCode ? `${base}&set=${encodeURIComponent(setCode.toLowerCase())}` : base
}

export interface FetchCardJsonOptions {
  lang?: string
  urgent?: boolean
  fallbackToName?: boolean
  rejectOnFailure?: boolean
}

/**
 * JSON de una carta vía la cola global de Scryfall con caché persistente.
 * Por impresión (set/número), con versión localizada primero si `lang` no es
 * inglés; por nombre exacto si la carta no trae impresión (o, con
 * `fallbackToName`, si la impresión no existe).
 */
export async function fetchCardJson(card: CardRef, opts: FetchCardJsonOptions = {}): Promise<ScryfallCardJson | null> {
  const fetchOpts = { persist: true, urgent: opts.urgent, rejectOnFailure: opts.rejectOnFailure }
  if (hasPrinting(card)) {
    if (opts.lang && opts.lang !== 'en') {
      const localized = await scryfallJson<ScryfallCardJson>(printingUrl(card, opts.lang), fetchOpts)
      if (localized) return localized
    }
    const exact = await scryfallJson<ScryfallCardJson>(printingUrl(card), fetchOpts)
    if (exact || !opts.fallbackToName) return exact
  }
  if (!card.cardName) return null
  return scryfallJson<ScryfallCardJson>(namedCardUrl(card.cardName), fetchOpts)
}

export function localizedPrintingJsonUrl(setCode: string, cardNumber: string, lang: string): string {
  return printingUrl({ cardName: '', setCode, cardNumber }, lang)
}

const COLLECTION_URL = 'https://api.scryfall.com/cards/collection'
export const COLLECTION_BATCH_SIZE = 75

export interface NamedCardRequest {
  name: string
  setCode?: string
}

interface CollectionResponse {
  data?: ScryfallCardJson[]
  not_found?: { name?: string; set?: string }[]
}

function foldName(name: string): string {
  return name.replace(/[’']/g, "'").trim().toLowerCase()
}

function namesOf(card: ScryfallCardJson): string[] {
  const names = [card.name ?? '', ...(card.name ?? '').split(' // ')]
  for (const face of card.card_faces ?? []) names.push(face.name ?? '')
  return names.filter(Boolean).map(foldName)
}

/** The collection finds a split or double-faced card by its first face, not by its full "A // B" name. */
function collectionName(name: string): string {
  return name.split(' // ')[0].trim()
}

function requestKey(req: NamedCardRequest): string {
  return `${foldName(req.name)}|${(req.setCode ?? '').toLowerCase()}`
}

/**
 * Asks Scryfall about many cards by name (and set) with /cards/collection, 75
 * per request, and stores each answer under the URL of its single exact-name
 * lookup (and of its printing), so the per-card lookups that follow are served
 * from the cache. Cards already cached are not asked again. A card the
 * collection reports in `not_found` is remembered as a 404; one Scryfall did
 * not answer, or whose answer cannot be matched to it by name, is left
 * uncached for its own lookup. Never throws.
 */
export async function primeCardsByName(requests: NamedCardRequest[], opts: { urgent?: boolean; signal?: AbortSignal } = {}): Promise<void> {
  const pending: NamedCardRequest[] = []
  const seen = new Set<string>()
  for (const req of requests) {
    const key = requestKey(req)
    if (!req.name || seen.has(key)) continue
    seen.add(key)
    if ((await scryfallCachedJson(namedCardUrl(req.name, req.setCode), { persist: true })) === undefined) pending.push(req)
  }
  for (let at = 0; at < pending.length; at += COLLECTION_BATCH_SIZE) {
    if (opts.signal?.aborted) return
    const batch = pending.slice(at, at + COLLECTION_BATCH_SIZE)
    let body: CollectionResponse
    try {
      const res = await scryfallFetch(COLLECTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifiers: batch.map((r) => {
            const name = collectionName(r.name)
            return r.setCode ? { name, set: r.setCode.toLowerCase() } : { name }
          }),
        }),
        urgent: opts.urgent,
        signal: opts.signal,
      })
      if (!res.ok) continue
      body = (await res.json()) as CollectionResponse
    } catch {
      continue
    }
    const notFound = new Set((body.not_found ?? []).map((id) => requestKey({ name: id.name ?? '', setCode: id.set })))
    const cards = body.data ?? []
    for (const req of batch) {
      const url = namedCardUrl(req.name, req.setCode)
      if (notFound.has(requestKey({ name: collectionName(req.name), setCode: req.setCode }))) {
        primeScryfallJson(url, null)
        continue
      }
      const wanted = foldName(req.name)
      const set = req.setCode?.toLowerCase()
      const card = cards.find((c) => namesOf(c).includes(wanted) && (!set || c.set === set))
      if (!card) continue
      primeScryfallJson(url, card, { persist: true })
      if (card.set && card.collector_number) {
        primeScryfallJson(printingUrl({ cardName: card.name ?? req.name, setCode: card.set, cardNumber: card.collector_number }), card, { persist: true })
      }
    }
  }
}
