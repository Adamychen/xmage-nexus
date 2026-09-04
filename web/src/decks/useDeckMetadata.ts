import { useMemo, useState } from 'react'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'
import { getEffectiveCardLang, setCachedCardName } from '../cards/cardLocalization'
import { stripMetaFromJson, type ScryfallJson } from './deckCardOps'

/** Metadatos Scryfall de las cartas del mazo + mapa de CMCs para la curva. */
export function useDeckMetadata() {
  const [metaMap, setMetaMap] = useState<Map<string, CardStripMeta>>(new Map())

  const updateMetaForDeck = (cards: DeckCard[]) => {
    const m = new Map(metaMap)
    const toFetch: DeckCard[] = []
    for (const c of cards) {
      const k = `${c.setCode}/${c.cardNumber}`
      if (!m.has(k) && !m.has(c.cardName.toLowerCase())) {
        toFetch.push(c)
      }
    }
    if (toFetch.length === 0) return

    const cardLang = getEffectiveCardLang()
    for (const c of toFetch) {
      const hasSetAndNum = c.setCode && c.cardNumber && c.cardNumber !== '0'
      const localizedUrl = hasSetAndNum && cardLang && cardLang !== 'en'
        ? `https://api.scryfall.com/cards/${c.setCode.toLowerCase()}/${c.cardNumber}/${cardLang}?format=json`
        : null
      const defaultUrl = hasSetAndNum
        ? `https://api.scryfall.com/cards/${c.setCode.toLowerCase()}/${c.cardNumber}?format=json`
        : `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(c.cardName)}`

      const fetchMetadata = async () => {
        try {
          if (localizedUrl) {
            const locRes = await fetch(localizedUrl, { headers: { Accept: 'application/json' } })
            if (locRes.ok) return (await locRes.json()) as ScryfallJson
          }
          const defRes = await fetch(defaultUrl, { headers: { Accept: 'application/json' } })
          if (defRes.ok) return (await defRes.json()) as ScryfallJson
          return null
        } catch {
          return null
        }
      }

      fetchMetadata()
        .then((data) => {
          if (!data) return
          const printedName = data.printed_name || data.card_faces?.[0]?.printed_name
          if (printedName && cardLang && cardLang !== 'en') {
            setCachedCardName(c.cardName, printedName, cardLang)
          }
          const meta = stripMetaFromJson(data)
          setMetaMap((prev) => {
            const nxt = new Map(prev)
            nxt.set(`${c.setCode}/${c.cardNumber}`, meta)
            nxt.set(c.cardName.toLowerCase(), meta)
            return nxt
          })
        })
        .catch(() => {})
    }
  }

  const cmcNumberMap = useMemo(() => {
    const m = new Map<string, number>()
    metaMap.forEach((meta, k) => {
      if (meta.cmc !== undefined) m.set(k, meta.cmc)
    })
    return m
  }, [metaMap])

  return { metaMap, setMetaMap, updateMetaForDeck, cmcNumberMap }
}
