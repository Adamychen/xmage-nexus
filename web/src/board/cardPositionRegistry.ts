export interface CardSourceSize {
  w: number
  h: number
}

interface PositionRecord {
  rect: DOMRect
  timestamp: number
  zone: string
  size?: CardSourceSize
}

const registry = new Map<string, PositionRecord>()
const EXPIRATION_MS = 3000

export function recordCardPosition(id: string, rect: DOMRect, zone = '', size?: CardSourceSize) {
  if (!id || rect.width <= 0 || rect.height <= 0) return
  registry.set(id, {
    rect,
    timestamp: Date.now(),
    zone,
    size: size && size.w > 0 && size.h > 0 ? size : undefined,
  })
}

export function getPreviousCardPosition(id: string): DOMRect | null {
  if (!id) return null
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
  if (!id) return null
  const record = registry.get(id)
  if (!record) return null
  if (Date.now() - record.timestamp > EXPIRATION_MS) {
    registry.delete(id)
    return null
  }
  return record.size ?? null
}

export function getPreviousCardZone(id: string): string {
  if (!id) return ''
  const record = registry.get(id)
  if (!record) return ''
  if (Date.now() - record.timestamp > EXPIRATION_MS) {
    registry.delete(id)
    return ''
  }
  return record.zone
}

export function consumePreviousCardPosition(id: string): { rect: DOMRect; zone: string; size?: CardSourceSize } | null {
  if (!id) return null
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
