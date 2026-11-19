export interface CardSourceSize {
  w: number
  h: number
  /** The source was a compact art-crop tile (landscape), not a printed card. */
  compact?: boolean
}

interface PositionRecord {
  rect: DOMRect
  timestamp: number
  zone: string
  size?: CardSourceSize
  /** The picture the card was showing when it left, so its flight can wear the same one. */
  img?: string
}

const registry = new Map<string, PositionRecord>()
const EXPIRATION_MS = 3000

/** Until when the registry neither writes nor answers (see `blindCardPositions`). */
let blindUntil = 0

function blind(): boolean {
  return Date.now() < blindUntil
}

/**
 * FX-15: the board on screen is about to be replaced by an unrelated one. The cards leaving write
 * down where they stood, as they always do, and the cards arriving carry the same ids in a board
 * of their own, so each one would fly in from wherever its namesake happened to be standing. For
 * `ms` around the swap the registry is blind: nothing is written and nothing is found, so the new
 * board simply appears.
 */
export function blindCardPositions(ms: number): void {
  blindUntil = Date.now() + ms
  registry.clear()
}

export function recordCardPosition(id: string, rect: DOMRect, zone = '', size?: CardSourceSize, img?: string) {
  if (!id || blind() || rect.width <= 0 || rect.height <= 0) return
  registry.set(id, {
    rect,
    timestamp: Date.now(),
    zone,
    size: size && size.w > 0 && size.h > 0 ? size : undefined,
    img: img || undefined,
  })
}

/**
 * FX-13: the picture the card was wearing when it left the board. A flight asks the card cache for
 * its image like anything else, and that answer is asynchronous: for a card whose art was not
 * already loaded the url arrives after the flight is over, and the clone spends the whole flight
 * as a grey plate with a name on it. The card it is flying out of had the picture on screen, so
 * the flight borrows that one.
 */
export function getPreviousCardImage(id: string): string | null {
  if (!id || blind()) return null
  const record = registry.get(id)
  if (!record || Date.now() - record.timestamp > EXPIRATION_MS) return null
  return record.img ?? null
}

export function getPreviousCardPosition(id: string): DOMRect | null {
  if (!id || blind()) return null
  const record = registry.get(id)
  if (!record) return null
  if (Date.now() - record.timestamp > EXPIRATION_MS) {
    registry.delete(id)
    return null
  }
  return record.rect
}

/** Tamaño real (sin transforms) de la carta registrada: offsetWidth/offsetHeight
 *  del elemento de origen, inmune a rotaciones (tapped, abanico de la mano). */
export function getPreviousCardSize(id: string): CardSourceSize | null {
  if (!id || blind()) return null
  const record = registry.get(id)
  if (!record) return null
  if (Date.now() - record.timestamp > EXPIRATION_MS) {
    registry.delete(id)
    return null
  }
  return record.size ?? null
}

export function getPreviousCardZone(id: string): string {
  if (!id || blind()) return ''
  const record = registry.get(id)
  if (!record) return ''
  if (Date.now() - record.timestamp > EXPIRATION_MS) {
    registry.delete(id)
    return ''
  }
  return record.zone
}

export function consumePreviousCardPosition(id: string): { rect: DOMRect; zone: string; size?: CardSourceSize } | null {
  if (!id || blind()) return null
  const record = registry.get(id)
  if (!record) return null
  registry.delete(id)
  if (Date.now() - record.timestamp > EXPIRATION_MS) {
    return null
  }
  return record.size
    ? { rect: record.rect, zone: record.zone, size: record.size }
    : { rect: record.rect, zone: record.zone }
}

export function clearCardPositionRegistry() {
  registry.clear()
}

export function getFallbackSourceRect(element: HTMLElement): DOMRect | null {
  const isHand = !!element.closest('.hand-zone')
  const isStack = !!element.closest('.stack-zone')
  const isPlayerZone = !!element.closest('.player-zone')
  const isOppZone = !!element.closest('.opponent-zone')

  const root = element.closest('.game-board, .pod-board') || document.body

  if (isHand) {
    const lib = isOppZone
      ? root.querySelector('.opp-top-row .library-stack, .oz-top-row .library-stack')
      : root.querySelector('.pz-bottom-row .library-stack, .bz-status-row .library-stack')
    if (lib) return lib.getBoundingClientRect()
  } else if (isStack) {
    const hand = isOppZone
      ? root.querySelector('.opp-zone .hand-zone, .oz-top-row .hand-zone')
      : root.querySelector('.pz-bottom-row .hand-zone, .bz-status-row .hand-zone')
    if (hand) return hand.getBoundingClientRect()
  } else if (isPlayerZone || isOppZone) {
    const stack = root.querySelector('.stack-zone')
    if (stack) return stack.getBoundingClientRect()
    const hand = isOppZone
      ? root.querySelector('.opp-zone .hand-zone, .oz-top-row .hand-zone')
      : root.querySelector('.pz-bottom-row .hand-zone, .bz-status-row .hand-zone')
    if (hand) return hand.getBoundingClientRect()
  }

  return null
}
