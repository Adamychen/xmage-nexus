export interface ChipReserveInput {
  reservedFor: string | null
  signature: string
  cardsTop: number
  chipBottom: number
  stableFrames: number
}

export interface ChipReserveState {
  reserve: boolean
  reservedFor: string | null
  recheck: boolean
}

export const CHIP_RESERVE_STABLE_FRAMES = 2
/** BRD-21: the step the zone has to change by before the reserve is decided again. */
export const CHIP_RESERVE_STEP = 8

export interface ChipSignatureInput {
  zoneW: number
  zoneH: number
  chipW: number
  chipH: number
  cards: number
}

/**
 * BRD-21: what the reserve is held for. Sizes are read in steps, not in exact pixels, because the
 * chip holds a clock: a tick that changes its measured width by a pixel must not drop the reserve
 * and jump the whole creatures row by the width of the chip. A real change (a resize, a card that
 * comes or goes) still gives a new signature and the reserve is decided again.
 */
export function chipSignature(input: ChipSignatureInput): string {
  const step = (value: number) => Math.round(value / CHIP_RESERVE_STEP)
  return `${step(input.zoneW)}x${step(input.zoneH)}|${step(input.chipW)}x${step(input.chipH)}|${input.cards}`
}

export function chipReserve(input: ChipReserveInput): ChipReserveState {
  if (input.reservedFor !== null) {
    return input.reservedFor === input.signature
      ? { reserve: true, reservedFor: input.reservedFor, recheck: false }
      : { reserve: false, reservedFor: null, recheck: false }
  }
  if (!(Number.isFinite(input.cardsTop) && input.cardsTop < input.chipBottom)) return { reserve: false, reservedFor: null, recheck: false }
  return input.stableFrames >= CHIP_RESERVE_STABLE_FRAMES
    ? { reserve: true, reservedFor: input.signature, recheck: false }
    : { reserve: false, reservedFor: null, recheck: true }
}
