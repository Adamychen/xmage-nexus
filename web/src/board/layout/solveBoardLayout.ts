import { solveRow, type RowInput, type RowOut } from './solveRow'

export type BoardLayoutKind = 'standard' | 'pod' | 'arena' | 'table' | 'spotlight' | '2hg'

export type RowSpec = Omit<RowInput, 'width' | 'height' | 'aspect' | 'minW' | 'maxW'>

export interface RowBox {
  width: number
  height: number
}

export interface SeatInput {
  id: string
  own: boolean
  rowBoxes: { creatures: RowBox; permanents: RowBox }
  rows: { creatures: RowSpec; permanents: RowSpec }
  capW: number
  compactPod: boolean
}

export interface BoardInput {
  layout: BoardLayoutKind
  seats: SeatInput[]
  aspect: number
  opponentsCappedByOwn: boolean
}

export interface SeatOut {
  id: string
  zoneCardW: number
  rows: { creatures: RowOut; permanents: RowOut }
}

export interface BoardOut {
  seats: SeatOut[]
}

const MIN_CARD_W = 44
const MAX_CARD_W = 240
const MAX_PLAYER_CARD_W = 280
const MAX_COMPACT_CARD_W = 190
const MAX_COMPACT_PLAYER_CARD_W = 230
const ROW_FLOOR_W = 46
const ROW_FLOOR_W_POD = 38

function zoneCardW(seat: SeatInput, aspect: number, capW: number): number {
  const tallest = Math.max(seat.rowBoxes.creatures.height, seat.rowBoxes.permanents.height)
  if (tallest <= 0) return MIN_CARD_W
  const safeCardH = Math.max(28, tallest - (seat.compactPod ? 2 : 4))
  const fromHeight = safeCardH / aspect
  const compact = aspect < 1
  const maxW = compact
    ? seat.own ? MAX_COMPACT_PLAYER_CARD_W : MAX_COMPACT_CARD_W
    : seat.own ? MAX_PLAYER_CARD_W : MAX_CARD_W
  return Math.min(Math.floor(capW), Math.round(Math.max(MIN_CARD_W, Math.min(maxW, fromHeight))))
}

function solveSeat(seat: SeatInput, aspect: number, capW: number): SeatOut {
  const zoneW = zoneCardW(seat, aspect, capW)
  const minW = Math.min(seat.compactPod ? ROW_FLOOR_W_POD : ROW_FLOOR_W, zoneW)
  const row = (spec: RowSpec, box: RowBox): RowOut =>
    solveRow({
      ...spec,
      width: box.width,
      height: box.height,
      aspect,
      minW,
      maxW: zoneW,
    })
  return {
    id: seat.id,
    zoneCardW: zoneW,
    rows: {
      creatures: row(seat.rows.creatures, seat.rowBoxes.creatures),
      permanents: row(seat.rows.permanents, seat.rowBoxes.permanents),
    },
  }
}

function ownCardW(input: SeatInput, out: SeatOut): number {
  const creatures = input.rows.creatures.bands.some((b) => b.items.length > 0) ? out.rows.creatures.cardW : 0
  const permanents = input.rows.permanents.bands.some((b) => b.items.length > 0) ? out.rows.permanents.cardW : 0
  return Math.max(creatures, permanents)
}

/** Every seat's zone and row sizes in one pure pass (BRD-25); opponents are capped by the own seat when asked (BRD-3). */
export function solveBoardLayout(input: BoardInput): BoardOut {
  const ownIndexes = input.seats.map((s, i) => (s.own ? i : -1)).filter((i) => i >= 0)
  const ownSolved = new Map<number, SeatOut>()
  let ownCap = Infinity
  if (input.opponentsCappedByOwn && ownIndexes.length > 0) {
    let largest = 0
    for (const i of ownIndexes) {
      const seat = input.seats[i]
      const out = solveSeat(seat, input.aspect, seat.capW)
      ownSolved.set(i, out)
      largest = Math.max(largest, ownCardW(seat, out))
    }
    ownCap = largest > 0 ? largest : Infinity
  }
  return {
    seats: input.seats.map((seat, i) => {
      const own = ownSolved.get(i)
      if (own) return own
      const cap = input.opponentsCappedByOwn ? Math.min(seat.capW, ownCap) : seat.capW
      return solveSeat(seat, input.aspect, cap)
    }),
  }
}
