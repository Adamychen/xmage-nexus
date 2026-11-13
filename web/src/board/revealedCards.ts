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

type HandMap = Record<string, Record<string, unknown>> | undefined

/** `GameSessionPlayer`/`GameSessionWatcher` key both hand maps by player name; older recordings
 *  and the fixtures key them by id, so try both. */
function handOf(hands: HandMap, player: PlayerView): Record<string, unknown> | undefined {
  return hands?.[player.name] ?? hands?.[player.playerId]
}

/** A revealed hand card as the server sends it (a `SimpleCardView`: a printing, no name), shaped for drawing. */
function revealedCard(id: string, raw: unknown): CardView {
  const c = (raw ?? {}) as Partial<CardView>
  return { ...c, id, parentId: c.parentId ?? id, name: c.name ?? '', manaValue: c.manaValue ?? 0, expansionSetCode: c.expansionSetCode ?? '', cardNumber: c.cardNumber ?? '' } as CardView
}

/**
 * The cards of an opponent's hand this client can see: the hand of a player it controls
 * (`opponentHands`, Mindslaver), one it was allowed to watch (`watchedHands`), and a hand revealed
 * to everyone (Telepathy shows it as a revealed group "Cards in <name>'s hand").
 *
 * <p>A revealed group counts only when it is named for this player's hand. `GameView.revealed` is
 * the whole game's `state.getRevealed()`, the same list for every player, and every other window
 * in it is named after the effect that opened it (`CardUtil.createObjectRelatedWindowTitle`):
 * cards off the top of a library, a hand a Duress read, the piles of a Fact or Fiction. Those
 * cards are not in anyone's hand, and the window carries no owner, so taking them all would paint
 * them face up in the hand of every opponent at once. They show where the desktop client shows
 * them, in the revealed window of their own (`infoWindowState.ts`).
 */
export function knownHandCards(game: GameView | null | undefined, player: PlayerView): Map<string, CardView> {
  const out = new Map<string, CardView>()
  if (!game) return out
  for (const hand of [handOf(game.opponentHands as HandMap, player), handOf(game.watchedHands as HandMap, player)]) {
    for (const [id, raw] of Object.entries(hand ?? {})) if (!out.has(id)) out.set(id, revealedCard(id, raw))
  }
  const handName = `${player.name}'s hand`.toLowerCase()
  for (const group of game.revealed ?? []) {
    if (!String(group?.name ?? '').toLowerCase().includes(handName)) continue
    for (const [id, card] of Object.entries(group.cards ?? {})) if (!out.has(id)) out.set(id, revealedCard(id, card))
  }
  return out
}

/** Cartas visibles para la mini-mano de un oponente, como `Record` para `BoardZone`. */
export function opponentRevealedCards(
  game: GameView | null | undefined,
  player: PlayerView | undefined,
): Record<string, CardView> {
  if (!game || !player) return {}
  return Object.fromEntries(knownHandCards(game, player))
}
