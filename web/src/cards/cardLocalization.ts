import type { CardView } from '../net/types'
import { getLanguage, getCardLanguage } from '../i18n'
import { isAbilityCard, getSourceCardName } from './cardImages'
import { scryfallFetch, scryfallJson } from './scryfallClient'
import { localizedPrintingJsonUrl, type ScryfallCardFaceJson, type ScryfallCardJson } from './scryfallCards'
import { useState, useEffect } from 'react'

const memoryCache = new Map<string, string>()
const inflight = new Map<string, Promise<string | null>>()
const textMemoryCache = new Map<string, LocalizedCardText>()
const textInflight = new Map<string, Promise<LocalizedCardText | null>>()

/** The part of a Scryfall `/cards/search` answer this module reads. */
interface ScryfallSearchJson {
  data?: ScryfallCardJson[]
}

const STORAGE_PREFIX = 'nexus_loc_card_'
const TEXT_STORAGE_PREFIX = 'nexus_loc_text_'

/** Texto impreso localizado de una carta (nombre, tipo y reglas) para la inspección. */
export interface LocalizedCardText {
  name?: string
  typeLine?: string
  rules?: string[]
}

export function getEffectiveCardLang(): string {
  const cardLang = getCardLanguage()
  if (cardLang && cardLang !== 'en') return cardLang
  const uiLang = getLanguage()
  return uiLang || 'en'
}

export function getCachedCardName(englishName: string, lang: string = getEffectiveCardLang()): string | null {
  if (!englishName || lang === 'en') return englishName || null
  const cacheKey = `${lang}:${englishName.trim().toLowerCase()}`
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey) ?? null
  }
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${cacheKey}`)
    if (stored) {
      memoryCache.set(cacheKey, stored)
      return stored
    }
  } catch {}
  return null
}

export function setCachedCardName(englishName: string, translatedName: string, lang: string = getEffectiveCardLang()): void {
  if (!englishName || !translatedName || lang === 'en') return
  const cacheKey = `${lang}:${englishName.trim().toLowerCase()}`
  memoryCache.set(cacheKey, translatedName)
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${cacheKey}`, translatedName)
  } catch {}
}

export type LocalizableCard =
  | CardView
  | {
      name?: string
      cardName?: string
      displayName?: string
      expansionSetCode?: string
      setCode?: string
      cardNumber?: string
      sourceCard?: CardView
      ability?: CardView
      mageObjectType?: string
      isSecondCardFace?: boolean
      isBackFace?: boolean
      transformed?: boolean
      isFrontFace?: boolean
      faceDown?: boolean
    }

function isAbility(card: LocalizableCard): boolean {
  return typeof card.mageObjectType === 'string' && isAbilityCard(card)
}

/** Set and collector number of the printing to localize; an ability takes its source card's. */
function printingOf(card: LocalizableCard): { set?: string; num?: string } {
  const src = isAbility(card) ? (card.sourceCard || card.ability) : card
  if (!src) return {}
  return { set: ('setCode' in src && src.setCode) || src.expansionSetCode, num: src.cardNumber }
}

function sameName(face: ScryfallCardFaceJson | undefined, name: string): boolean {
  return (face?.name ?? '').toLowerCase() === name.toLowerCase()
}

export function extractCardName(card: LocalizableCard): string {
  if (!card) return ''
  if (isAbility(card)) {
    return getSourceCardName(card as CardView)
  }
  if ('cardName' in card && card.cardName) return card.cardName
  if ('displayName' in card && card.displayName) return card.displayName
  if ('name' in card && card.name) return card.name
  return ''
}

/** El pool CONSTRUCT del engine no trae `name` (SimpleCardsView solo lleva
 *  id/set/número): la web usaba el UUID como nombre y disparaba búsquedas
 *  Scryfall condenadas al 404. Estos no-nombres no deben pedir red. */
export function isUuidLikeCardName(name: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name.trim())
}

export async function fetchLocalizedCardName(
  card: LocalizableCard,
  lang: string = getEffectiveCardLang(),
): Promise<string | null> {
  const baseName = extractCardName(card)
  if (!baseName || lang === 'en') return baseName || null
  if (/^(?:ability|habilidad)$/i.test(baseName.trim())) return null
  if (isUuidLikeCardName(baseName)) return null

  const cleanName = baseName.trim()
  const cacheKey = `${lang}:${cleanName.toLowerCase()}`

  const cached = getCachedCardName(cleanName, lang)
  if (cached) return cached

  if (inflight.has(cacheKey)) {
    return inflight.get(cacheKey)!
  }

  const promise = (async () => {
    try {
      const { set, num } = printingOf(card)

      // Placeholder "SET número" del pool sin nombres: no es un nombre real.
      if (set && num && cleanName === `${set} ${num}`) return null

      if (set && num && num !== '0' && set !== 'XMAGE') {
        try {
          const data = await scryfallJson<ScryfallCardJson>(localizedPrintingJsonUrl(set, num, lang), { persist: true })
          if (data) {
            const faceMatch = data.card_faces?.find((f) => sameName(f, cleanName))
            const hit = faceMatch?.printed_name || data.printed_name || data.name
            if (hit && typeof hit === 'string') {
              setCachedCardName(faceMatch?.name ?? data.name ?? cleanName, hit, lang)
              return hit
            }
          }
        } catch {}
      }

      const escaped = cleanName.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')
      const q = encodeURIComponent(`name:/^${escaped}$/ lang:${lang}`)
      const res = await scryfallFetch(`https://api.scryfall.com/cards/search?q=${q}`)
      if (!res.ok) return null
      const data = (await res.json()) as ScryfallSearchJson
      const first = data.data && data.data[0]
      if (!first) return null

      let translated = first.printed_name
      if (!translated && first.card_faces) {
        const match = first.card_faces.find((f) => sameName(f, cleanName))
        if (match && match.printed_name) {
          translated = match.printed_name
        }
      }

      if (translated && typeof translated === 'string') {
        setCachedCardName(first.name ?? cleanName, translated, lang)
        return translated
      }
      return null
    } catch {
      return null
    }
  })().finally(() => {
    inflight.delete(cacheKey)
  })

  inflight.set(cacheKey, promise)
  return promise
}

export function useLocalizedCardName(card: LocalizableCard): { displayName: string; originalName: string } {
  const originalName = extractCardName(card)
  const lang = getEffectiveCardLang()
  const [displayName, setDisplayName] = useState<string>(() => {
    if (lang === 'en') return originalName
    return getCachedCardName(originalName, lang) ?? originalName
  })

  useEffect(() => {
    if (lang === 'en') {
      setDisplayName(originalName)
      return
    }
    const cached = getCachedCardName(originalName, lang)
    if (cached) {
      setDisplayName(cached)
      return
    }
    let cancelled = false
    fetchLocalizedCardName(card, lang).then((result) => {
      if (!cancelled && result) {
        setDisplayName(result)
      }
    })
    return () => {
      cancelled = true
    }
  }, [card, originalName, lang])

  return { displayName, originalName }
}

export function getCachedCardText(englishName: string, lang: string = getEffectiveCardLang()): LocalizedCardText | null {
  if (!englishName || lang === 'en') return null
  const cacheKey = `${lang}:${englishName.trim().toLowerCase()}`
  const hit = textMemoryCache.get(cacheKey)
  if (hit) return hit
  try {
    const stored = localStorage.getItem(`${TEXT_STORAGE_PREFIX}${cacheKey}`)
    if (stored) {
      const parsed = JSON.parse(stored) as LocalizedCardText
      textMemoryCache.set(cacheKey, parsed)
      return parsed
    }
  } catch {}
  return null
}

export function setCachedCardText(englishName: string, text: LocalizedCardText, lang: string = getEffectiveCardLang()): void {
  if (!englishName || lang === 'en') return
  if (!text.name && !text.typeLine && !text.rules?.length) return
  const cacheKey = `${lang}:${englishName.trim().toLowerCase()}`
  textMemoryCache.set(cacheKey, text)
  try {
    localStorage.setItem(`${TEXT_STORAGE_PREFIX}${cacheKey}`, JSON.stringify(text))
  } catch {}
}

function localizedTextFromScryfall(data: ScryfallCardJson | null, faceName: string): LocalizedCardText | null {
  if (!data) return null
  const faces = data.card_faces
  const match = faces?.find((f) => sameName(f, faceName))
  const src: ScryfallCardFaceJson | null = match ?? (faces?.length ? null : data)
  if (!src) return null
  const name = typeof src.printed_name === 'string' ? src.printed_name : undefined
  const typeLine = typeof src.printed_type_line === 'string' ? src.printed_type_line : undefined
  const rawText = typeof src.printed_text === 'string' ? src.printed_text : typeof src.oracle_text === 'string' ? src.oracle_text : ''
  const rules = rawText.split('\n').map((line) => line.trim()).filter(Boolean)
  if (!name && !typeLine && rules.length === 0) return null
  return { name, typeLine, rules: rules.length > 0 ? rules : undefined }
}

export async function fetchLocalizedCardText(
  card: LocalizableCard,
  lang: string = getEffectiveCardLang(),
): Promise<LocalizedCardText | null> {
  const baseName = extractCardName(card)
  if (!baseName || lang === 'en') return null
  if (/^(?:ability|habilidad)$/i.test(baseName.trim())) return null
  if (isUuidLikeCardName(baseName)) return null

  const cleanName = baseName.trim()
  const cacheKey = `${lang}:${cleanName.toLowerCase()}`

  const cached = getCachedCardText(cleanName, lang)
  if (cached) return cached
  if (textInflight.has(cacheKey)) {
    return textInflight.get(cacheKey)!
  }

  const promise = (async () => {
    try {
      const { set, num } = printingOf(card)

      if (set && num && cleanName === `${set} ${num}`) return null

      if (set && num && num !== '0' && set !== 'XMAGE') {
        try {
          const data = await scryfallJson<ScryfallCardJson>(localizedPrintingJsonUrl(set, num, lang), { persist: true })
          const picked = localizedTextFromScryfall(data, cleanName)
          if (picked) {
            setCachedCardText(cleanName, picked, lang)
            return picked
          }
        } catch {}
      }

      const escaped = cleanName.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')
      const q = encodeURIComponent(`name:/^${escaped}$/ lang:${lang}`)
      const res = await scryfallFetch(`https://api.scryfall.com/cards/search?q=${q}`)
      if (!res.ok) return null
      const data = (await res.json()) as ScryfallSearchJson
      const first = data.data && data.data[0]
      const picked = first ? localizedTextFromScryfall(first, cleanName) : null
      if (picked) {
        setCachedCardText(cleanName, picked, lang)
        return picked
      }
      return null
    } catch {
      return null
    }
  })().finally(() => {
    textInflight.delete(cacheKey)
  })

  textInflight.set(cacheKey, promise)
  return promise
}

export function useLocalizedCardText(card: LocalizableCard | null | undefined): { text: LocalizedCardText | null; pending: boolean } {
  const originalName = card ? extractCardName(card) : ''
  const lang = getEffectiveCardLang()
  const [state, setState] = useState<{ text: LocalizedCardText | null; pending: boolean }>(() => {
    if (!card || !originalName || lang === 'en') return { text: null, pending: false }
    const cached = getCachedCardText(originalName, lang)
    return { text: cached, pending: !cached }
  })

  useEffect(() => {
    if (!card || !originalName || lang === 'en') {
      setState({ text: null, pending: false })
      return
    }
    const cached = getCachedCardText(originalName, lang)
    if (cached) {
      setState({ text: cached, pending: false })
      return
    }
    let cancelled = false
    setState({ text: null, pending: true })
    fetchLocalizedCardText(card, lang).then((text) => {
      if (!cancelled) setState({ text, pending: false })
    })
    return () => {
      cancelled = true
    }
  }, [card, originalName, lang])

  return state
}

export function resetCardLocalizationCacheForTest(): void {
  memoryCache.clear()
  inflight.clear()
  textMemoryCache.clear()
  textInflight.clear()
}
