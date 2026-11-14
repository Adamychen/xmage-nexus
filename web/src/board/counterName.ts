/**
 * BRD-46: the name a counter is known by in the game, from the one the server sends. The wire
 * carries the engine's own ids ("P1P1", "M1M1"), which no player reads on a card, so the +1/+1 and
 * -1/-1 counters are named the way the cards print them and the rest keep their word, capitalised.
 */
const PRINTED: Record<string, string> = {
  p1p1: '+1/+1',
  'p+1/+1': '+1/+1',
  m1m1: '-1/-1',
  'm-1/-1': '-1/-1',
}

export function counterName(name: string): string {
  const raw = String(name ?? '').trim()
  const printed = PRINTED[raw.toLowerCase()]
  if (printed) return printed
  if (!raw) return raw
  return raw
    .split(/\s+/)
    .map((word) => (/^[a-z]/.test(word) ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ')
}

/** The counter as a badge names it: its name and how many there are. */
export function counterTip(name: string, count: number): string {
  return `${counterName(name)}: ${count}`
}
