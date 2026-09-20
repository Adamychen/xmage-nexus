import { useEffect, useMemo, useRef, useState } from 'react'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'
import { getEffectiveCardLang, setCachedCardName } from '../cards/cardLocalization'
import { stripMetaFromJson } from './deckCardOps'
import { fetchCardJson } from '../cards/scryfallCards'

/** Metadatos Scryfall de las cartas del mazo + mapa de CMCs para la curva. */
export function useDeckMetadata() {
  const [metaMap, setMetaMap] = useState<Map<string, CardStripMeta>>(new Map())
  // Claves conocidas + en vuelo en refs: updateMetaForDeck se llama en ráfaga
  // (load, imports, drops) y el estado metaMap llega rancio entre llamadas.
  const knownRef = useRef<Set<string>>(new Set())
  const inFlightRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    for (const k of metaMap.keys()) knownRef.current.add(k)
  }, [metaMap])

  const updateMetaForDeck = (cards: DeckCard[]) => {
    const toFetch: Array<{ card: DeckCard; lookup: string }> = []
    const seen = new Set<string>()
    for (const c of cards) {
      const k = `${c.setCode}/${c.cardNumber}`
      const hasSetAndNum = !!c.setCode && !!c.cardNumber && c.cardNumber !== '0'
      const lookup = hasSetAndNum ? k : c.cardName.toLowerCase()
      if (knownRef.current.has(lookup) || inFlightRef.current.has(lookup) || seen.has(lookup)) continue
      seen.add(lookup)
      inFlightRef.current.add(lookup)
      toFetch.push({ card: c, lookup })
    }
    if (toFetch.length === 0) return

    const cardLang = getEffectiveCardLang()
    for (const { card: c, lookup } of toFetch) {
      const hasSetAndNum = c.setCode && c.cardNumber && c.cardNumber !== '0'

      fetchCardJson(c, { lang: cardLang })
        .then((data) => {
          inFlightRef.current.delete(lookup)
          if (!data) return
          knownRef.current.add(lookup)
          const printedName = data.printed_name || data.card_faces?.[0]?.printed_name
          if (printedName && cardLang && cardLang !== 'en') {
            setCachedCardName(data.name ?? c.cardName, printedName, cardLang)
          }
          const meta = stripMetaFromJson(data)
          setMetaMap((prev) => {
            const nxt = new Map(prev)
            if (hasSetAndNum) nxt.set(`${c.setCode}/${c.cardNumber}`, meta)
            nxt.set(c.cardName.toLowerCase(), meta)
            return nxt
          })
        })
        .catch(() => {
          inFlightRef.current.delete(lookup)
        })
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
