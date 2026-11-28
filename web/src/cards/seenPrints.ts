import type { CardView, GameView, PlayerView } from '../net/types'

/**
 * CRD-10: the printing each card on the table was seen with, so a view that arrives without one
 * can still be drawn as the card the players are looking at.
 *
 * The engine does not always carry the printing into every view of the same card: a triggered
 * ability on the stack reaches the client with its source's set and number empty, and drawing it
 * by name alone gets whatever printing Scryfall answers with, which is how a Secret Lair on the
 * battlefield became an old frame on the stack. The table itself is the authority: the card is on
 * the battlefield, in a graveyard, in a hand, and there it comes with its printing.
 */
const byId = new Map<string, string>()
const byName = new Map<string, string>()

/** `SET/number` when the view carries a usable one. */
function printOf(card: CardView | null | undefined): string | null {
  if (!card) return null
  const set = (card.expansionSetCode ?? '').trim()
  const num = (card.cardNumber ?? '').trim()
  if (!set || !num || num === '0') return null
  if (set.toUpperCase() === 'XMAGE') return null
  return `${set}/${num}`
}

const nameKey = (card: CardView): string => String(card.name ?? '').trim().toLowerCase()

function note(card: CardView | null | undefined): void {
  if (!card || card.faceDown === true || card.isToken === true) return
  const print = printOf(card)
  if (!print) return
  if (card.id) byId.set(String(card.id), print)
  const key = nameKey(card)
  if (key) byName.set(key, print)
}

function noteZone(zone: Record<string, CardView> | undefined | null): void {
  if (!zone) return
  for (const card of Object.values(zone)) {
    note(card)
    note(card.sourceCard as CardView | undefined)
  }
}

/** Reads every card of a view and remembers the printing it came with. */
export function rememberPrints(game: GameView | null | undefined): void {
  if (!game) return
  for (const player of (game.players ?? []) as PlayerView[]) {
    noteZone(player.battlefield as Record<string, CardView> | undefined)
    noteZone(player.graveyard as Record<string, CardView> | undefined)
    noteZone(player.exile as Record<string, CardView> | undefined)
  }
  noteZone(game.myHand as Record<string, CardView> | undefined)
  noteZone(game.stack as Record<string, CardView> | undefined)
  for (const hand of Object.values(game.opponentHands ?? {})) noteZone(hand as Record<string, CardView>)
}

/** The printing this card was seen with: by its own id first, then by its name. */
export function seenPrintOf(card: CardView | null | undefined): string | null {
  if (!card) return null
  const id = card.id ? byId.get(String(card.id)) : undefined
  if (id) return id
  const key = nameKey(card)
  return (key && byName.get(key)) || null
}

/** Tests only: forget every printing seen so far. */
export function resetSeenPrints(): void {
  byId.clear()
  byName.clear()
}
