const CENTER = 50
const RADIUS_X = 34
const RADIUS_Y = 30

/** Position (percent of the table box) of seat `index` around an oval; seat 0 sits at the bottom. */
export function seatNodePosition(index: number, count: number): { x: number; y: number } {
  const angle = Math.PI / 2 + (2 * Math.PI * index) / Math.max(count, 1)
  return {
    x: round(CENTER + RADIUS_X * Math.cos(angle)),
    y: round(CENTER + RADIUS_Y * Math.sin(angle)),
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
