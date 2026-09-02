import type { CardView, GameView, PlayerView } from '../net/types'

/** Convierte una SimpleCardsView (mano de espectador/watched) a CardsView. */
export function simpleToCardsView(simple: Record<string, { id: string; name?: string }> | undefined): Record<string, CardView> {
  if (!simple) return {}
  const out: Record<string, CardView> = {}
  for (const [id, c] of Object.entries(simple)) {
    out[id] = { name: c.name ?? '?', manaValue: 0, expansionSetCode: '', cardNumber: '0', parentId: id, id }
  }
  return out
}

/** Cartas visibles para la mini-mano de un oponente: reveladas + opponentHands
 *  + watchedHands. Lookup por id Y nombre (el servidor usa ambos según el caso). */
export function opponentRevealedCards(
  game: GameView | null | undefined,
  player: PlayerView | undefined,
): Record<string, CardView> {
  if (!game || !player) return {}
  const res: Record<string, CardView> = {}

  if (Array.isArray(game.revealed)) {
    game.revealed.forEach((rev) => {
      if (rev.cards && typeof rev.cards === 'object') {
        Object.entries(rev.cards).forEach(([id, c]) => {
          res[id] = c as CardView
        })
      }
    })
  }

  const oppHand = game.opponentHands?.[player.playerId] ?? game.opponentHands?.[player.name]
  if (oppHand) {
    Object.entries(oppHand).forEach(([id, c]) => {
      res[id] = c as CardView
    })
  }

  const watched = game.watchedHands?.[player.name] ?? game.watchedHands?.[player.playerId]
  if (watched) {
    Object.entries(watched).forEach(([id, c]) => {
      res[id] = { name: (c as { name?: string }).name ?? '?', manaValue: 0, expansionSetCode: '', cardNumber: '0', parentId: id, id }
    })
  }

  return res
}
