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
