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
