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
 * starts at the first item and slides left (then compresses) to stay inside
 * `[minX, maxX]`, so a pile at the edge of its band never spills out of it.
 */
export function spreadLayout(items: SpreadItem[], gap: number, minX: number, maxX: number): SpreadLayout {
  if (items.length === 0) return { dx: [], stripLeft: 0, stripWidth: 0 }
  const last = items[items.length - 1]
  const offsets: number[] = [0]
  for (let i = 1; i < items.length; i++) offsets.push(offsets[i - 1] + items[i - 1].width + gap)
  const span = offsets[offsets.length - 1]
  let width = span + last.width
  const avail = maxX - minX
  if (width > avail && span > 0) {
    const f = Math.max(0, avail - last.width) / span
    for (let i = 0; i < offsets.length; i++) offsets[i] *= f
    width = offsets[offsets.length - 1] + last.width
  }
  let start = items[0].left
  if (start + width > maxX) start = maxX - width
  if (start < minX) start = minX
  return {
    dx: items.map((it, i) => start + offsets[i] - it.left),
    stripLeft: start,
    stripWidth: width,
  }
}
