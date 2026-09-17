import type { CardsView, SimpleCardsView } from '../net/types'

/** Manos ajenas visibles (Mindslaver & cía.: el servidor las envía en `opponentHands`). */
export function switchableHandKeys(opponentHands: unknown): string[] {
  if (!opponentHands || typeof opponentHands !== 'object') return []
  const rec = opponentHands as Record<string, unknown>
  return Object.keys(rec).filter((k) => {
    const v = rec[k]
    return !!v && typeof v === 'object' && Object.keys(v as Record<string, unknown>).length > 0
  })
}

/** Mano controlada lista para pintar (ids como claves y `faceDown:false`), o
 *  null si no hay clave/hand visible: así la mano propia sigue siendo el fallback. */
export function switchedHandCards(opponentHands: unknown, key: string | null): CardsView | null {
  if (!key) return null
  const hand = (opponentHands as Record<string, SimpleCardsView> | undefined)?.[key]
  if (!hand) return null
  const entries = Object.entries(hand)
  if (entries.length === 0) return null
  const out: CardsView = {}
  for (const [id, card] of entries) {
    out[id] = { ...(card as CardsView[string]), id, faceDown: false }
  }
  return out
}
