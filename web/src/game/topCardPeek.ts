import { useSyncExternalStore } from 'react'
import { getState, listeners } from '../state/state'
import type { CardView, GameView, PlayerView } from '../net/types'

export const TOP_CARD_PEEK_NAME = 'Top card of your library'

export interface TopCardPeek {
  gameId: string | null
  playerId: string
  card: CardView
  libraryCount: number
}

function viewerOf(game: GameView): PlayerView | undefined {
  const players = game.players ?? []
  return game.myPlayerId ? players.find((p) => p.playerId === game.myPlayerId) : players.find((p) => p.controlled)
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
  return { gameId: id, playerId: me.playerId, card, libraryCount: me.libraryCount ?? 0 }
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

function sync() {
  const { game, gameId } = getState()
  if (game === lastGame && gameId === lastGameId) return
  lastGame = game
  lastGameId = gameId
  const next = foldTopCardPeek(snapshot, game, gameId)
  if (next === snapshot) return
  snapshot = next
  subscribers.forEach((fn) => fn())
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
