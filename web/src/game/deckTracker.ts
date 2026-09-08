import type { CardView, GameView } from '../net/types'
import type { Deck } from '../lobby/decks'
import type { DeckJson } from '../net/types'
import { normalizeBasicLandName } from '../decks/deckUtils'

export interface TrackedCard {
  name: string
  cardName: string
  setCode: string
  cardNumber: string
  initialAmount: number
  seenCount: number
  remainingCount: number
  drawProbability: number
  manaCost?: string
  manaValue: number
  cardTypes: string[]
  isLand: boolean
  isCreature: boolean
  isInstantOrSorcery: boolean
  isTopCard: boolean
  sampleCard: CardView
}

export interface DeckTrackerStats {
  initialTotal: number
  visibleTotal: number
  remainingTotal: number
  libraryCountServer: number
  faceDownExileCount: number
  oddsNextDraw: {
    land: number
    creature: number
    instantOrSorcery: number
    other: number
  }
  countsRemaining: {
    land: number
    creature: number
    instantOrSorcery: number
    other: number
  }
  cards: TrackedCard[]
}

export function normalizeCardName(name: string): string {
  if (!name) return ''
  return name.trim().toLowerCase()
}

export function matchCardName(a: string, b: string): boolean {
  if (!a || !b) return false
  const normLandA = normalizeBasicLandName(a)
  const normLandB = normalizeBasicLandName(b)
  if (normLandA && normLandB && normLandA.toLowerCase() === normLandB.toLowerCase()) {
    return true
  }
  const na = normalizeCardName(a)
  const nb = normalizeCardName(b)
  if (na === nb) return true
  const frontA = na.split(' // ')[0].trim()
  const frontB = nb.split(' // ')[0].trim()
  return frontA === frontB
}

export function getVisibleCards(game: GameView | null, myPlayerId?: string | null): CardView[] {
  if (!game) return []
  const players = game.players ?? []
  const me = players.find((p) => p.controlled || (myPlayerId && p.playerId === myPlayerId))
  if (!me) return []

  const list: CardView[] = []

  // 1. Hand
  if (game.myHand) {
    const handCards = Array.isArray(game.myHand) ? game.myHand : Object.values(game.myHand)
    for (const c of handCards) {
      if (c && !c.isToken) list.push(c)
    }
  }

  // 2. Battlefield (controlled permanents, non-token)
  if (me.battlefield) {
    const perms = Array.isArray(me.battlefield) ? me.battlefield : Object.values(me.battlefield)
    for (const p of perms) {
      if (!p || p.isToken) continue
      list.push(p)
      if (p.mutateView) {
        for (const mc of Object.values(p.mutateView) as CardView[]) {
          if (mc && !mc.isToken) list.push(mc)
        }
      }
    }
  }

  // 2b. Battlefield owned by me but controlled by opponent (e.g. stolen)
  for (const opp of players) {
    if (opp.playerId === me.playerId) continue
    if (opp.battlefield) {
      const perms = Array.isArray(opp.battlefield) ? opp.battlefield : Object.values(opp.battlefield)
      for (const p of perms) {
        if (!p || p.isToken) continue
        if (p.nameOwner && p.nameOwner === me.name) {
          list.push(p)
        }
      }
    }
  }

  // 3. Graveyard (cards in own graveyard are owned by player in MTG)
  if (me.graveyard) {
    const grave = Array.isArray(me.graveyard) ? me.graveyard : Object.values(me.graveyard)
    for (const c of grave) {
      if (c && !c.isToken) list.push(c)
    }
  }

  // 4. Exile (non-facedown)
  if (me.exile) {
    const exiles = Array.isArray(me.exile) ? me.exile : Object.values(me.exile)
    for (const c of exiles) {
      if (c && !c.isToken && !c.faceDown) list.push(c)
    }
  }

  // 5. Stack (spells belonging to me)
  if (game.stack) {
    const stack = Array.isArray(game.stack) ? game.stack : Object.values(game.stack)
    for (const c of stack) {
      if (!c || c.isToken || c.isAbility) continue
      if (c.controllerId === me.playerId || c.controllerName === me.name) {
        list.push(c)
      }
    }
  }

  // 6. Command Zone
  if (me.commandList && Array.isArray(me.commandList)) {
    for (const item of me.commandList) {
      if (item && typeof item === 'object' && 'name' in item && typeof (item as { name: unknown }).name === 'string') {
        list.push(item as CardView)
      }
    }
  }

  return list
}

export function getFaceDownExileCount(game: GameView | null, myPlayerId?: string | null): number {
  if (!game) return 0
  const me = game.players?.find((p) => p.controlled || (myPlayerId && p.playerId === myPlayerId))
  if (!me || !me.exile) return 0
  const exiles = Array.isArray(me.exile) ? me.exile : Object.values(me.exile)
  return exiles.filter((c) => c && c.faceDown).length
}

export function computeDeckTracker(
  deck: Deck | DeckJson | null,
  game: GameView | null,
  myPlayerId?: string | null,
): DeckTrackerStats {
  const me = game?.players?.find((p) => p.controlled || (myPlayerId && p.playerId === myPlayerId))
  const libraryCountServer = me?.libraryCount ?? 0
  const faceDownExileCount = getFaceDownExileCount(game, myPlayerId)

  if (!deck || !deck.cards || deck.cards.length === 0) {
    return {
      initialTotal: 0,
      visibleTotal: 0,
      remainingTotal: libraryCountServer,
      libraryCountServer,
      faceDownExileCount,
      oddsNextDraw: { land: 0, creature: 0, instantOrSorcery: 0, other: 0 },
      countsRemaining: { land: 0, creature: 0, instantOrSorcery: 0, other: 0 },
      cards: [],
    }
  }

  const visibleCards = getVisibleCards(game, myPlayerId)

  // Group deck cards by normalized canonical name
  const grouped = new Map<
    string,
    {
      canonicalName: string
      setCode: string
      cardNumber: string
      initialAmount: number
    }
  >()

  for (const c of deck.cards) {
    const rawName = c.cardName || (c as unknown as { name?: string }).name || ''
    if (!rawName) continue
    const canonicalName = normalizeBasicLandName(rawName) || rawName.trim()
    const key = canonicalName.toLowerCase()
    const amount = Number(c.amount) || 1
    const existing = grouped.get(key)
    if (existing) {
      existing.initialAmount += amount
    } else {
      grouped.set(key, {
        canonicalName,
        setCode: c.setCode || '',
        cardNumber: c.cardNumber || '0',
        initialAmount: amount,
      })
    }
  }

  const cards: TrackedCard[] = []
  let initialTotal = 0
  let visibleTotal = 0

  const topCardName = me?.topCard?.name

  for (const entry of grouped.values()) {
    initialTotal += entry.initialAmount

    const seenMatches = visibleCards.filter((v) =>
      matchCardName(v.name || v.displayName || '', entry.canonicalName),
    )
    const seenCount = seenMatches.length
    visibleTotal += seenCount

    const remainingCount = Math.max(0, entry.initialAmount - seenCount)

    const sample = seenMatches[0]
    const manaValue = sample?.manaValue ?? 0
    const manaCost =
      sample?.manaCostLeftStr?.join('') ?? sample?.manaCostRightStr?.join('') ?? ''
    const cardTypes = sample?.cardTypes ?? []

    const isBasicLand = normalizeBasicLandName(entry.canonicalName) !== null
    const isLand = isBasicLand || cardTypes.some((t) => t.toLowerCase() === 'land')
    const isCreature = cardTypes.some((t) => t.toLowerCase() === 'creature')
    const isInstantOrSorcery = cardTypes.some(
      (t) => t.toLowerCase() === 'instant' || t.toLowerCase() === 'sorcery',
    )

    const isTopCard = !!topCardName && matchCardName(topCardName, entry.canonicalName)

    const sampleCard: CardView = sample ?? {
      name: entry.canonicalName,
      expansionSetCode: entry.setCode,
      cardNumber: entry.cardNumber,
      manaValue,
      cardTypes: isLand ? ['Land'] : isCreature ? ['Creature'] : isInstantOrSorcery ? ['Instant'] : [],
    }

    cards.push({
      name: entry.canonicalName,
      cardName: entry.canonicalName,
      setCode: entry.setCode,
      cardNumber: entry.cardNumber,
      initialAmount: entry.initialAmount,
      seenCount,
      remainingCount,
      drawProbability: 0,
      manaValue,
      manaCost: manaCost || undefined,
      cardTypes,
      isLand,
      isCreature,
      isInstantOrSorcery,
      isTopCard,
      sampleCard,
    })
  }

  const remainingCalculated = cards.reduce((acc, c) => acc + c.remainingCount, 0)
  const effectiveLibraryCount = libraryCountServer > 0 ? libraryCountServer : remainingCalculated

  let remainingLands = 0
  let remainingCreatures = 0
  let remainingInstantOrSorcery = 0
  let remainingOther = 0

  for (const c of cards) {
    if (c.remainingCount > 0) {
      if (c.isLand) remainingLands += c.remainingCount
      else if (c.isCreature) remainingCreatures += c.remainingCount
      else if (c.isInstantOrSorcery) remainingInstantOrSorcery += c.remainingCount
      else remainingOther += c.remainingCount
    }

    if (effectiveLibraryCount > 0) {
      c.drawProbability = Number(((c.remainingCount / effectiveLibraryCount) * 100).toFixed(1))
    } else {
      c.drawProbability = 0
    }
  }

  const oddsNextDraw = {
    land:
      effectiveLibraryCount > 0
        ? Number(((remainingLands / effectiveLibraryCount) * 100).toFixed(1))
        : 0,
    creature:
      effectiveLibraryCount > 0
        ? Number(((remainingCreatures / effectiveLibraryCount) * 100).toFixed(1))
        : 0,
    instantOrSorcery:
      effectiveLibraryCount > 0
        ? Number(((remainingInstantOrSorcery / effectiveLibraryCount) * 100).toFixed(1))
        : 0,
    other:
      effectiveLibraryCount > 0
        ? Number(((remainingOther / effectiveLibraryCount) * 100).toFixed(1))
        : 0,
  }

  const countsRemaining = {
    land: remainingLands,
    creature: remainingCreatures,
    instantOrSorcery: remainingInstantOrSorcery,
    other: remainingOther,
  }

  return {
    initialTotal,
    visibleTotal,
    remainingTotal: remainingCalculated,
    libraryCountServer,
    faceDownExileCount,
    oddsNextDraw,
    countsRemaining,
    cards,
  }
}
