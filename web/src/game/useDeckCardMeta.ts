import { useEffect, useMemo, useRef, useState } from 'react'
import type { Deck } from '../lobby/decks'
import type { DeckJson } from '../net/types'
import { fetchCardJson, type ScryfallCardJson } from '../cards/scryfallCards'
import { groupDeckCards, type DeckCardMeta, type DeckCardMetaMap } from './deckTracker'
import { normalizeBasicLandName } from '../decks/deckUtils'

const TYPE_WORDS = ['Creature', 'Instant', 'Sorcery', 'Land', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle']

export function cardTypesFromTypeLine(typeLine: string): string[] {
  const front = typeLine.split(' // ')[0].split('—')[0]
  const found = new Set<string>()
  for (const word of front.split(/\s+/)) {
    const hit = TYPE_WORDS.find((type) => type.toLowerCase() === word.toLowerCase())
    if (hit) found.add(hit.toUpperCase())
  }
  return [...found]
}

export function deckCardMetaFromScryfall(card: ScryfallCardJson): DeckCardMeta | null {
  const face = card.card_faces?.[0]
  const cardTypes = cardTypesFromTypeLine(card.type_line ?? face?.type_line ?? '')
  if (cardTypes.length === 0) return null
  return {
    manaCost: (card.mana_cost ?? face?.mana_cost ?? '').split(' // ')[0],
    manaValue: card.cmc ?? 0,
    cardTypes,
    colors: card.colors ?? face?.colors ?? [],
  }
}

export interface DeckCardMetaState {
  meta: DeckCardMetaMap
  loading: boolean
  missing: number
}

interface SettledMeta {
  key: string
  meta: Map<string, DeckCardMeta>
  missing: number
}

const NO_META: DeckCardMetaMap = new Map()

export function useDeckCardMeta(deck: Deck | DeckJson | null): DeckCardMetaState {
  const groups = useMemo(() => groupDeckCards(deck), [deck])
  const key = useMemo(
    () => groups.map((group) => `${group.key}|${group.setCode}|${group.cardNumber}`).join('\n'),
    [groups],
  )
  const pending = useMemo(
    () => groups.filter((group) => normalizeBasicLandName(group.canonicalName) === null),
    [groups],
  )
  const [settled, setSettled] = useState<SettledMeta | null>(null)
  const settledKey = useRef<string | null>(null)

  useEffect(() => {
    if (pending.length === 0 || settledKey.current === key) return
    let cancelled = false
    void Promise.all(
      pending.map(async (group) => {
        const card = await fetchCardJson(
          { cardName: group.canonicalName, setCode: group.setCode, cardNumber: group.cardNumber },
          { fallbackToName: true },
        ).catch(() => null)
        return { key: group.key, meta: card ? deckCardMetaFromScryfall(card) : null }
      }),
    ).then((rows) => {
      if (cancelled) return
      const meta = new Map<string, DeckCardMeta>()
      let missing = 0
      for (const row of rows) {
        if (row.meta) meta.set(row.key, row.meta)
        else missing++
      }
      settledKey.current = key
      setSettled({ key, meta, missing })
    })
    return () => {
      cancelled = true
    }
  }, [pending, key])

  const current = settled && settled.key === key ? settled : null
  return {
    meta: current?.meta ?? NO_META,
    loading: pending.length > 0 && current === null,
    missing: current?.missing ?? 0,
  }
}
