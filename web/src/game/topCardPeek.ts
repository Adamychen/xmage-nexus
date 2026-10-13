import { useSyncExternalStore } from 'react'
import { getState, listeners } from '../state/state'
import { awaitCardMeta, peekCardMeta } from '../cards/cardImages'
import type { CardView, GameView, PlayerView } from '../net/types'

export const TOP_CARD_PEEK_NAME = 'Top card of your library'

export interface TopCardPeek {
  gameId: string | null
  playerId: string
  card: CardView
  /**
   * What the slot may print as the card's name, or null when nothing resolved yet.
   * Never read straight off `card`: the server sends this channel as a
   * `LookedAtView`, whose cards are `SimpleCardView` entries (id + expansionSetCode +
   * cardNumber), so a real frame has no name and no rules text. `card` keeps the
   * pointer untouched when the name is unknown — a made-up name would reach the alt
   * text and the rendered-card layout.
   */
  name: string | null
  libraryCount: number
}

function viewerOf(game: GameView): PlayerView | undefined {
  const players = game.players ?? []
  return game.myPlayerId ? players.find((p) => p.playerId === game.myPlayerId) : players.find((p) => p.controlled)
}

function displayNameOf(card: CardView): string | null {
  const raw = (card.displayName || card.name || '').trim()
  if (raw && raw !== '?') return raw
  return peekCardMeta(card.expansionSetCode, card.cardNumber)?.name ?? null
}

export function foldTopCardPeek(
  prev: TopCardPeek | null,
  game: GameView | null | undefined,
  gameId: string | null | undefined,
): TopCardPeek | null {
  if (!game) return null
  const id = gameId ?? null
  const kept = prev && prev.gameId === id ? prev : null
  const group = (game.lookedAt ?? []).find((g) => g.name === TOP_CARD_PEEK_NAME)
  const card = Object.values(group?.cards ?? {})[0] as CardView | undefined
  const me = viewerOf(game)
  if (!card || !me) return kept
  const libraryCount = me.libraryCount ?? 0
  if (kept && kept.card.id === card.id && kept.libraryCount === libraryCount) return kept
  const name = displayNameOf(card)
  return {
    gameId: id,
    playerId: me.playerId,
    card: name && name !== card.name ? { ...card, name } : card,
    name,
    libraryCount,
  }
}

export function visibleTopCardPeek(peek: TopCardPeek | null, player: PlayerView | null | undefined): CardView | null {
  if (!peek || !player || peek.playerId !== player.playerId) return null
  if ((player.libraryCount ?? 0) !== peek.libraryCount) return null
  return peek.card
}

let snapshot: TopCardPeek | null = null
let lastGame: unknown
let lastGameId: string | null | undefined
const subscribers = new Set<() => void>()
/** Keys (`gameId|set/number`) whose metadata was already asked for. Without this the
 *  client re-fires a Scryfall request on every view while the peek stays open, and an
 *  unreachable CDN means it never resolves — the offline case this must stay quiet about. */
const askedNames = new Set<string>()

function notify() {
  subscribers.forEach((fn) => fn())
}

function requestMissingName(peek: TopCardPeek | null): void {
  if (!peek || peek.name) return
  const set = peek.card.expansionSetCode ?? ''
  const number = peek.card.cardNumber ?? ''
  if (!set || !number || number === '0') return
  const key = `${peek.gameId ?? ''}|${set}/${number}`
  if (askedNames.has(key)) return
  if (askedNames.size > 64) askedNames.clear()
  askedNames.add(key)
  void awaitCardMeta(set, number).then((meta) => {
    const name = meta?.name
    if (!name) return
    const current = snapshot
    if (!current || current.name) return
    if (current.gameId !== peek.gameId || current.card.id !== peek.card.id) return
    snapshot = { ...current, name, card: { ...current.card, name } }
    notify()
  })
}

function sync() {
  const { game, gameId } = getState()
  if (game === lastGame && gameId === lastGameId) return
  lastGame = game
  lastGameId = gameId
  const next = foldTopCardPeek(snapshot, game, gameId)
  if (next !== snapshot) {
    snapshot = next
    notify()
  }
  requestMissingName(snapshot)
}

listeners.add(sync)

function subscribe(fn: () => void) {
  sync()
  subscribers.add(fn)
  return () => {
    subscribers.delete(fn)
  }
}

export function useTopCardPeek(): TopCardPeek | null {
  return useSyncExternalStore(subscribe, () => snapshot)
}
