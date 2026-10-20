export function drawnCardIds(prev: readonly string[], next: readonly string[]): string[] {
  if (prev.length === 0) return []
  const before = new Set(prev)
  if (!next.some((id) => before.has(id))) return []
  return next.filter((id) => !before.has(id))
}

export function drawOffset(anchor: DOMRect, slot: DOMRect): { dx: number; dy: number } {
  return {
    dx: anchor.left + anchor.width / 2 - (slot.left + slot.width / 2),
    dy: anchor.top + anchor.height / 2 - (slot.top + slot.height / 2),
  }
}

export type HandReturnPile = 'graveyard' | 'exile'

let handReturns: ReadonlyMap<string, HandReturnPile> = new Map()

/** Records which cards of my hand in the view about to render came back from a pile, before the hand lays out its draw slides. */
export function primeHandReturns(returns: ReadonlyMap<string, HandReturnPile>): void {
  handReturns = returns
}

export function handReturnPile(id: string): HandReturnPile | null {
  return handReturns.get(id) ?? null
}

/** The draw anchor for a card that came back from `pile`: the library piles of `select` swapped for that pile's. */
export function pileAnchor(select: string, pile: HandReturnPile | null): string {
  return pile ? select.replace(/library-/g, `${pile}-`) : select
}
