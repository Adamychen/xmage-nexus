/** Keeps the player's own arrangement of the hand across updates: cards still
 *  in hand keep their relative order, cards that left are dropped and new
 *  cards are appended on the right in the order the server sent them. */
export function reconcileHandOrder(prev: readonly string[], ids: readonly string[]): string[] {
  const present = new Set(ids)
  const kept = prev.filter((id) => present.has(id))
  const known = new Set(kept)
  return [...kept, ...ids.filter((id) => !known.has(id))]
}

/** Moves `id` to `index` (clamped), returning a new array. */
export function moveHandCard(order: readonly string[], id: string, index: number): string[] {
  const from = order.indexOf(id)
  if (from < 0) return [...order]
  const rest = order.filter((x) => x !== id)
  const to = Math.max(0, Math.min(rest.length, index))
  if (to === from) return [...order]
  rest.splice(to, 0, id)
  return rest
}

/** Index the dragged card should take: how many other cards have their
 *  centre to the left of the pointer. */
export function handDropIndex(pointerX: number, otherCenters: readonly number[]): number {
  return otherCenters.filter((cx) => cx < pointerX).length
}
