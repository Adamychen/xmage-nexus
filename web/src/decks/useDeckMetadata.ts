import { useEffect, useMemo, useRef, useState } from 'react'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'
import { getEffectiveCardLang, setCachedCardName } from '../cards/cardLocalization'
import { stripMetaFromJson } from './deckCardOps'
import { fetchCardJson, type CardRef, type ScryfallCardJson } from '../cards/scryfallCards'
import { cardArtPreference } from '../cards/artPreferences'

const RETRY_DELAYS_MS = [1000, 10_000, 20_000, 30_000]

interface MetaRequest {
  ref: CardRef
  lang: string
  lookup: string
  keys: string[]
  retries: number
}

/** Metadatos Scryfall de las cartas del mazo + mapa de CMCs para la curva. */
export function useDeckMetadata() {
  const [metaMap, setMetaMap] = useState<Map<string, CardStripMeta>>(new Map())
  const metaRef = useRef(metaMap)
  metaRef.current = metaMap
  const knownRef = useRef<Set<string>>(new Set())
  const inFlightRef = useRef<Set<string>>(new Set())
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    const timers = timersRef.current
    return () => {
      aliveRef.current = false
      timers.forEach(clearTimeout)
      timers.clear()
    }
  }, [])

  const settle = (req: MetaRequest, data: ScryfallCardJson) => {
    inFlightRef.current.delete(req.lookup)
    knownRef.current.add(req.lookup)
    const printedName = data.printed_name || data.card_faces?.[0]?.printed_name
    if (printedName && req.lang && req.lang !== 'en') {
      setCachedCardName(data.name ?? req.ref.cardName, printedName, req.lang)
    }
    const meta = stripMetaFromJson(data)
    setMetaMap((prev) => {
      const nxt = new Map(prev)
      for (const k of req.keys) nxt.set(k, meta)
      return nxt
    })
  }

  const giveUp = (req: MetaRequest) => {
    inFlightRef.current.delete(req.lookup)
    setMetaMap((prev) => {
      if (req.keys.every((k) => prev.has(k))) return prev
      const nxt = new Map(prev)
      for (const k of req.keys) {
        if (!nxt.has(k)) nxt.set(k, { name: req.ref.cardName })
      }
      return nxt
    })
  }

  const retry = (req: MetaRequest) => {
    if (!aliveRef.current) return
    const delay = RETRY_DELAYS_MS[req.retries]
    if (delay === undefined) {
      giveUp(req)
      return
    }
    req.retries++
    const timer = setTimeout(() => {
      timersRef.current.delete(timer)
      load(req)
    }, delay)
    timersRef.current.add(timer)
  }

  const load = (req: MetaRequest) => {
    fetchCardJson(req.ref, { lang: req.lang, urgent: true, fallbackToName: true }).then(
      (data) => (data ? settle(req, data) : retry(req)),
      () => retry(req),
    )
  }

  const updateMetaForDeck = (cards: DeckCard[]) => {
    const lang = getEffectiveCardLang()
    const toFetch: MetaRequest[] = []
    const seen = new Set<string>()
    for (const c of cards) {
      const pref = cardArtPreference(c.cardName)
      const setCode = pref?.setCode ?? c.setCode
      const cardNumber = pref?.cardNumber ?? c.cardNumber
      const hasSetAndNum = !!setCode && !!cardNumber && cardNumber !== '0'
      const artKey = hasSetAndNum ? `${setCode}/${cardNumber}` : c.cardName.toLowerCase()
      const lookup = `${c.setCode}/${c.cardNumber}|${artKey}`
      if (inFlightRef.current.has(lookup) || seen.has(lookup)) continue
      if (knownRef.current.has(lookup) && metaRef.current.has(artKey)) continue
      seen.add(lookup)
      inFlightRef.current.add(lookup)
      const keys = new Set<string>([c.cardName.toLowerCase(), artKey])
      if (c.setCode && c.cardNumber && c.cardNumber !== '0') keys.add(`${c.setCode}/${c.cardNumber}`)
      toFetch.push({ ref: { cardName: c.cardName, setCode, cardNumber }, lang, lookup, keys: [...keys], retries: 0 })
    }
    for (const req of toFetch) load(req)
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
