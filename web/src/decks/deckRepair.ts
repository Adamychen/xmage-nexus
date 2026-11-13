import { applySuggestions, type DeckFix } from './deckIssues'
import { getDeckStorage } from './storage'
import type { DeckV2 } from './types'

/**
 * Persisting a repair made outside the deck editor (DCK-30).
 *
 * The editor already writes its repairs back: the issues banner
 * (`DeckServerIssues`) hands its `DeckFix[]` to `DeckBuilder.handleRepairIssue`,
 * which does `applySuggestions(deck, fixes)` and persists the result. The
 * pre-join dialog applied the very same fixes to the deck it was about to send
 * and dropped them afterwards, so the warning came back on every join. This is
 * that same repair against the stored deck.
 *
 * Only decks in the player's storage are written. A deck that is not there (a
 * bundled precon, a deck without a stable id) keeps today's behaviour: the
 * repair holds for this table, nothing is saved and no copy is created.
 */

/** Every printing a stored deck names, in a stable order, to tell a real repair from a no-op. */
function printingsOf(deck: DeckV2): string {
  const entries = [...deck.cards, ...deck.sideboard, deck.coverCard, deck.commanderCard, deck.partnerCard]
  return entries.map((c) => (c ? `${c.cardName}|${c.setCode}|${c.cardNumber}` : '-')).join(',')
}

/** Writes run one after another: a second repair must read what the first one saved. */
let queue: Promise<unknown> = Promise.resolve()

/** True when a repair of this deck would be written back, i.e. it is in the player's storage. */
export async function isRepairPersistable(deckId: string | undefined): Promise<boolean> {
  if (!deckId) return false
  try {
    return (await getDeckStorage().get(deckId)) !== null
  } catch {
    return false
  }
}

async function writeRepair(deckId: string | undefined, fixes: DeckFix[]): Promise<DeckV2 | null> {
  if (!deckId || fixes.length === 0) return null
  const storage = getDeckStorage()
  const stored = await storage.get(deckId)
  if (!stored) return null
  const next = applySuggestions(stored, fixes)
  if (printingsOf(next) === printingsOf(stored)) return null
  await storage.put(next)
  return next
}

/**
 * Applies `fixes` to the stored deck `deckId` and saves it.
 * Resolves with the deck that was saved, or null when nothing was written.
 */
export function persistDeckRepair(deckId: string | undefined, fixes: DeckFix[]): Promise<DeckV2 | null> {
  const run = queue.then(() => writeRepair(deckId, fixes))
  queue = run.catch(() => null)
  return run
}
