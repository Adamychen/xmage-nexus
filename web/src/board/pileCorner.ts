export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

/** How far the pile corner must be lifted off the zone's bottom edge so that its
 *  resting box clears every hand card it would overlap (BRD-12). Zero when none. */
export function pileCornerLift(zoneBottom: number, corner: Box, hand: readonly Box[]): number {
  const restTop = zoneBottom - (corner.bottom - corner.top)
  let lift = 0
  for (const card of hand) {
    const overlapsX = card.left < corner.right && corner.left < card.right
    const overlapsY = card.top < zoneBottom && card.bottom > restTop
    if (overlapsX && overlapsY) lift = Math.max(lift, zoneBottom - card.top)
  }
  return lift
}

/** The corner reaches into a row when its top edge sits above the row's bottom edge (BRD-12). */
export function pileCornerReaches(corner: Box, row: Box): boolean {
  return corner.top < row.bottom - 0.5
}
