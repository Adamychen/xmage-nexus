export const FAN_SLICE = 0.44
export const FAN_STEP_DEG = 4.5
export const PILE_DEPTH = 3
export const PILE_STEP_DEG = 1.1

const rad = (deg: number) => (deg * Math.PI) / 180

export function fanRadius(cardW: number): number {
  return (cardW * FAN_SLICE) / (2 * Math.sin(rad(FAN_STEP_DEG) / 2))
}

export function pileWidth(cardW: number): number {
  return 2 * fanRadius(cardW) * Math.sin(rad(PILE_STEP_DEG) / 2) * PILE_DEPTH
}

function fit(cardW: number, roomW: number): number {
  return Math.floor((roomW - cardW) / (cardW * FAN_SLICE)) + 1
}

export function fanWindow(count: number, cardW: number, roomW: number): number {
  if (count <= 0) return 0
  if (cardW <= 0 || roomW <= 0) return count
  if (fit(cardW, roomW) >= count) return count
  const visible = fit(cardW, roomW - 2 * pileWidth(cardW))
  return Math.min(count, Math.max(1, visible))
}

export function fanMaxScroll(count: number, visible: number): number {
  return Math.max(0, count - visible)
}

export function clampFanScroll(scroll: number, count: number, visible: number): number {
  return Math.min(fanMaxScroll(count, visible), Math.max(0, scroll))
}

export interface FanSlot {
  angleDeg: number
  shown: boolean
  piled: boolean
}

export function fanSlot(index: number, scroll: number, visible: number): FanSlot {
  const mid = (visible - 1) / 2
  const offset = index - scroll - mid
  const reach = Math.abs(offset)
  const angle = reach <= mid
    ? offset * FAN_STEP_DEG
    : Math.sign(offset) * (mid * FAN_STEP_DEG + Math.min(reach - mid, PILE_DEPTH) * PILE_STEP_DEG)
  const shown = reach <= mid + 0.5
  return {
    angleDeg: Math.round(angle * 100) / 100 || 0,
    shown,
    piled: !shown && reach <= mid + PILE_DEPTH + 0.5,
  }
}

export function fanDrop(cardW: number, visible: number, piled = false): number {
  const edge = rad(((visible - 1) / 2) * FAN_STEP_DEG + (piled ? PILE_DEPTH * PILE_STEP_DEG : 0))
  return fanRadius(cardW) * (1 - Math.cos(edge))
}

export function thumbLeft(scroll: number, maxScroll: number, trackW: number, thumbW: number): number {
  if (maxScroll <= 0 || trackW <= thumbW) return 0
  return Math.round((Math.min(maxScroll, Math.max(0, scroll)) / maxScroll) * (trackW - thumbW))
}

export function scrollFromThumb(left: number, maxScroll: number, trackW: number, thumbW: number): number {
  const travel = trackW - thumbW
  if (maxScroll <= 0 || travel <= 0) return 0
  return (Math.min(travel, Math.max(0, left)) / travel) * maxScroll
}
