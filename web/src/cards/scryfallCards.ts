import { scryfallJson } from './scryfallClient'

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

function namedUrl(name: string): string {
  return `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`
}

export interface FetchCardJsonOptions {
  lang?: string
  urgent?: boolean
  fallbackToName?: boolean
}

/**
 * JSON de una carta vía la cola global de Scryfall con caché persistente.
 * Por impresión (set/número), con versión localizada primero si `lang` no es
 * inglés; por nombre exacto si la carta no trae impresión (o, con
 * `fallbackToName`, si la impresión no existe).
 */
export async function fetchCardJson(card: CardRef, opts: FetchCardJsonOptions = {}): Promise<ScryfallCardJson | null> {
  const fetchOpts = { persist: true, urgent: opts.urgent }
  if (hasPrinting(card)) {
    if (opts.lang && opts.lang !== 'en') {
      const localized = await scryfallJson<ScryfallCardJson>(printingUrl(card, opts.lang), fetchOpts)
      if (localized) return localized
    }
    const exact = await scryfallJson<ScryfallCardJson>(printingUrl(card), fetchOpts)
    if (exact || !opts.fallbackToName) return exact
  }
  if (!card.cardName) return null
  return scryfallJson<ScryfallCardJson>(namedUrl(card.cardName), fetchOpts)
}

export function localizedPrintingJsonUrl(setCode: string, cardNumber: string, lang: string): string {
  return printingUrl({ cardName: '', setCode, cardNumber }, lang)
}
