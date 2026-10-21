export function visibleBadges(count: number, width: number, size: number, gap: number): number {
  if (count <= 0 || width <= 0 || size <= 0) return count
  const capacity = Math.max(1, Math.floor((width + gap) / (size + gap)))
  if (count <= capacity) return count
  return capacity - 1
}
