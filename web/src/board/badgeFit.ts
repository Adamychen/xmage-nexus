/**
 * BRD-51: how many badges a strip shows. The strip may run in several lanes (the keyword column
 * breaks into a second column beside the first), so its room is the room of one lane times the
 * lanes it may use; when they do not all fit, one slot is left for the "+N" chip.
 */
export function visibleBadges(count: number, width: number, size: number, gap: number, lanes = 1): number {
  if (count <= 0 || width <= 0 || size <= 0) return count
  const perLane = Math.max(1, Math.floor((width + gap) / (size + gap)))
  const capacity = perLane * Math.max(1, lanes)
  if (count <= capacity) return count
  return capacity - 1
}
