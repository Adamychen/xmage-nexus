import { useMemo, useRef, useState } from 'react'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'
import { getEffectiveCardLang, setCachedCardName } from '../cards/cardLocalization'
import { stripMetaFromJson } from './deckCardOps'
import { fetchCardJson, type CardRef } from '../cards/scryfallCards'
import { cardArtPreference } from '../cards/artPreferences'

/** Metadatos Scryfall de las cartas del mazo + mapa de CMCs para la curva. */
export function useDeckMetadata() {
  const [metaMap, setMetaMap] = useState<Map<string, CardStripMeta>>(new Map())
  // Claves conocidas + en vuelo en refs: updateMetaForDeck se llama en ráfaga
  // (load, imports, drops) y el estado metaMap llega rancio entre llamadas.
  const knownRef = useRef<Set<string>>(new Set())
  const inFlightRef = useRef<Set<string>>(new Set())

  const updateMetaForDeck = (cards: DeckCard[]) => {
    const toFetch: Array<{ ref: CardRef; lookup: string; keys: string[] }> = []
    const seen = new Set<string>()
    for (const c of cards) {
      const pref = cardArtPreference(c.cardName)
      const setCode = pref?.setCode ?? c.setCode
      const cardNumber = pref?.cardNumber ?? c.cardNumber
      const hasSetAndNum = !!setCode && !!cardNumber && cardNumber !== '0'
      const artKey = hasSetAndNum ? `${setCode}/${cardNumber}` : c.cardName.toLowerCase()
      const lookup = `${c.setCode}/${c.cardNumber}|${artKey}`
      if (knownRef.current.has(lookup) || inFlightRef.current.has(lookup) || seen.has(lookup)) continue
      seen.add(lookup)
      inFlightRef.current.add(lookup)
      const keys = new Set<string>([c.cardName.toLowerCase(), artKey])
      if (c.setCode && c.cardNumber && c.cardNumber !== '0') keys.add(`${c.setCode}/${c.cardNumber}`)
      toFetch.push({ ref: { cardName: c.cardName, setCode, cardNumber }, lookup, keys: [...keys] })
    }
    if (toFetch.length === 0) return

    const cardLang = getEffectiveCardLang()
    for (const { ref, lookup, keys } of toFetch) {
      fetchCardJson(ref, { lang: cardLang })
        .then((data) => {
          inFlightRef.current.delete(lookup)
          if (!data) return
          knownRef.current.add(lookup)
          const printedName = data.printed_name || data.card_faces?.[0]?.printed_name
          if (printedName && cardLang && cardLang !== 'en') {
            setCachedCardName(data.name ?? ref.cardName, printedName, cardLang)
          }
          const meta = stripMetaFromJson(data)
          setMetaMap((prev) => {
            const nxt = new Map(prev)
            for (const k of keys) nxt.set(k, meta)
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
