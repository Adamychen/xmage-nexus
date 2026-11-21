import type { CardView, GameView } from '../net/types'

type CardMap = Record<string, { id?: string } | null | undefined> | null | undefined

let seen: GameView | null | undefined
let foreign: Set<string> = new Set()

export function foreignCardIds(game: GameView): Set<string> {
  const me = game.myPlayerId ?? null
  const ids = new Set<string>()
  const add = (cards: CardMap) => {
    if (!cards || typeof cards !== 'object') return
    for (const [id, card] of Object.entries(cards)) {
      ids.add(id)
      if (card?.id) ids.add(card.id)
    }
  }
  for (const player of game.players ?? []) {
    if (me && player.playerId === me) continue
    add(player.battlefield)
    add(player.graveyard)
    add(player.exile)
    add(player.sideboard)
    if (player.topCard?.id) ids.add(player.topCard.id)
    const commandList = player.commandList as unknown
    if (Array.isArray(commandList)) {
      for (const item of commandList) {
        const id = (item as { id?: unknown } | null)?.id
        if (typeof id === 'string') ids.add(id)
      }
    } else {
      add(commandList as CardMap)
    }
  }
  for (const hand of Object.values(game.opponentHands ?? {})) add(hand)
  for (const hand of Object.values(game.watchedHands ?? {})) add(hand)
  for (const [id, card] of Object.entries(game.stack ?? {})) {
    if (card?.controllerId && card.controllerId !== me) {
      ids.add(id)
      if (card.id) ids.add(card.id)
    }
  }
  return ids
}

export function noteGameForArt(game: GameView | null | undefined): void {
  if (game === seen) return
  seen = game
  foreign = game ? foreignCardIds(game) : new Set()
}

export function isForeignCard(card: CardView): boolean {
  return !!card.id && foreign.has(card.id)
}
