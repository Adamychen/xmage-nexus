export type BadgeEdge = 'top' | 'bottom'

export interface BadgeBox {
  id: string
  zone: string
  edge: BadgeEdge
  top: number
  bottom: number
  left: number
  right: number
}

export interface BadgeBounds {
  top: number
  bottom: number
}

export interface BadgeLayout {
  shifts: Map<string, number>
  hidden: Set<string>
}

export const BADGE_ZONE_PRIORITY = [
  'mana',
  'tap',
  'sickness',
  'transform',
  'facedown',
  'designation',
  'keyword',
  'stats',
  'counters',
  'icons',
] as const

const GAP = 2

function overlaps(a: BadgeBox, b: BadgeBox, ay: number, by: number): boolean {
  return a.left < b.right && b.left < a.right && a.top + ay < b.bottom + by && b.top + by < a.bottom + ay
}

function byPriority(a: BadgeBox, b: BadgeBox): number {
  return BADGE_ZONE_PRIORITY.indexOf(a.zone as never) - BADGE_ZONE_PRIORITY.indexOf(b.zone as never)
}

function placeEdge(
  boxes: readonly BadgeBox[],
  edge: BadgeEdge,
  fits: (top: number, bottom: number) => boolean,
  out: BadgeLayout,
): BadgeBox[] {
  const placed: Array<{ box: BadgeBox; dy: number }> = []
  for (const box of boxes.filter((b) => b.edge === edge).sort(byPriority)) {
    let dy = 0
    for (let pass = 0; pass <= placed.length; pass++) {
      const hit = placed.find((p) => overlaps(box, p.box, dy, p.dy))
      if (!hit) break
      dy = edge === 'top' ? hit.box.bottom + hit.dy - box.top + GAP : hit.box.top + hit.dy - box.bottom - GAP
    }
    if (!fits(box.top + dy, box.bottom + dy)) {
      out.hidden.add(box.id)
      out.shifts.set(box.id, 0)
      continue
    }
    out.shifts.set(box.id, dy)
    placed.push({ box, dy })
  }
  return placed.map((p) => ({ ...p.box, top: p.box.top + p.dy, bottom: p.box.bottom + p.dy }))
}

export function resolveBadgeLayout(boxes: readonly BadgeBox[], bounds: BadgeBounds): BadgeLayout {
  const out: BadgeLayout = { shifts: new Map(), hidden: new Set() }
  const bottomPlaced = placeEdge(boxes, 'bottom', (top) => top >= bounds.top, out)
  const ceiling = bottomPlaced.reduce((min, b) => Math.min(min, b.top), bounds.bottom)
  placeEdge(boxes, 'top', (_top, bottom) => bottom <= Math.min(bounds.bottom, ceiling), out)
  return out
}
