import type { CardView } from '../net/types'
import { getLanguage, getCardLanguage } from '../i18n'
import { cardName, isAbilityCard } from './cardImages'
import { useState, useEffect } from 'react'

const memoryCache = new Map<string, string>()
const inflight = new Map<string, Promise<string | null>>()

const STORAGE_PREFIX = 'nexus_loc_card_'

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

export async function fetchLocalizedCardName(
  card: CardView,
  lang: string = getEffectiveCardLang(),
): Promise<string | null> {
  const baseName = cardName(card)
  if (!baseName || lang === 'en') return baseName || null
  if (/^(?:ability|habilidad)$/i.test(baseName.trim())) return null

  const cleanName = baseName.trim()
  const cacheKey = `${lang}:${cleanName.toLowerCase()}`

  const cached = getCachedCardName(cleanName, lang)
  if (cached) return cached

  if (inflight.has(cacheKey)) {
    return inflight.get(cacheKey)!
  }

  const promise = (async () => {
    try {
      const src = isAbilityCard(card) ? (card.sourceCard || card.ability) : card
      const set = src?.expansionSetCode
      const num = src?.cardNumber

      if (set && num && num !== '0' && set !== 'XMAGE') {
        try {
          const directRes = await fetch(
            `https://api.scryfall.com/cards/${set.toLowerCase()}/${num}/${lang}?format=json`,
            { headers: { 'User-Agent': 'XMageNexus/1.0' } },
          )
          if (directRes.ok) {
            const data = await directRes.json()
            const faceMatch = data.card_faces?.find((f: any) => (f.name ?? '').toLowerCase() === cleanName.toLowerCase())
            const hit = faceMatch?.printed_name || data.printed_name || data.name
            if (hit && typeof hit === 'string') {
              setCachedCardName(cleanName, hit, lang)
              return hit
            }
          }
        } catch {}
      }

      const escaped = cleanName.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')
      const q = encodeURIComponent(`name:/^${escaped}$/ lang:${lang}`)
      const res = await fetch(`https://api.scryfall.com/cards/search?q=${q}`, {
        headers: { 'User-Agent': 'XMageNexus/1.0' },
      })
      if (!res.ok) return null
      const data = await res.json()
      const first = data.data && data.data[0]
      if (!first) return null

      let translated = first.printed_name
      if (!translated && first.card_faces) {
        const match = first.card_faces.find(
          (f: any) => (f.name ?? '').toLowerCase() === cleanName.toLowerCase(),
        )
        if (match && match.printed_name) {
          translated = match.printed_name
        }
      }

      if (translated && typeof translated === 'string') {
        setCachedCardName(cleanName, translated, lang)
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

export function useLocalizedCardName(card: CardView): { displayName: string; originalName: string } {
  const originalName = cardName(card)
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

export function resetCardLocalizationCacheForTest(): void {
  memoryCache.clear()
  inflight.clear()
}
