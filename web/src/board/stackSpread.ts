export interface SpreadItem {
  /** Left edge of the item in its collapsed (overlapped) position. */
  left: number
  width: number
}

export interface SpreadLayout {
  /** Horizontal offset to add to each item's collapsed position. */
  dx: number[]
  stripLeft: number
  stripWidth: number
}

/**
 * Fans a collapsed pile out side by side without touching the layout: the
 * items keep their in-flow footprint and are only offset visually. The strip
 * starts at the first item; when `maxX` leaves too little room it may start
 * further left, but never left of `minX` (the free row space before the pile),
 * so a fanned pile never covers the permanents before it, and compresses when
 * even that is not enough.
 */
export function spreadLayout(items: SpreadItem[], gap: number, maxX: number, minX?: number): SpreadLayout {
  if (items.length === 0) return { dx: [], stripLeft: 0, stripWidth: 0 }
  const last = items[items.length - 1]
  const offsets: number[] = [0]
  for (let i = 1; i < items.length; i++) offsets.push(offsets[i - 1] + items[i - 1].width + gap)
  const span = offsets[offsets.length - 1]
  let width = span + last.width
  const first = items[0].left
  const floor = Math.min(first, minX ?? first)
  const start = width > maxX - first ? Math.max(floor, maxX - width) : first
  const avail = maxX - start
  if (width > avail && span > 0) {
    const f = Math.max(0, avail - last.width) / span
    for (let i = 0; i < offsets.length; i++) offsets[i] *= f
    width = offsets[offsets.length - 1] + last.width
  }
  return {
    dx: items.map((it, i) => start + offsets[i] - it.left),
    stripLeft: start,
    stripWidth: width,
  }
}
