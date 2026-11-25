export type PickZone = 'deck' | 'side'

export function placeInZone(order: string[], hidden: ReadonlySet<string>, id: string, zone: PickZone, index: number): string[] {
  const rest = order.filter((x) => x !== id)
  const inZone = rest.filter((x) => hidden.has(x) === (zone === 'side'))
  const at = Math.max(0, index)
  let pos = rest.length
  if (at < inZone.length) pos = rest.indexOf(inZone[at])
  else if (inZone.length > 0) pos = rest.indexOf(inZone[inZone.length - 1]) + 1
  return [...rest.slice(0, pos), id, ...rest.slice(pos)]
}

export function orderPicks(order: readonly string[], pickIds: readonly string[]): string[] {
  const known = new Set(pickIds)
  const ordered = order.filter((id) => known.has(id))
  const seen = new Set(ordered)
  for (const id of pickIds) if (!seen.has(id)) ordered.push(id)
  return ordered
}
