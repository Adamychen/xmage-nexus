export const CARD_ASPECT = 1.4
export const MAX_BAND_LINES = 3
const WRAP_WASTE = 1.12

export interface BandFitInput {
  /** Ancho de carta con el que se midió `contentW` (el que el DOM tenía aplicado). */
  measuredW: number
  /** Suma de los anchos de los hijos de la banda (con sus márgenes) a `measuredW`. */
  contentW: number
  itemCount: number
  gap: number
  availW: number
  availH: number
  /** Ancho máximo (el que calcula la zona por altura). */
  maxW: number
  /** Suelo: por debajo de esto se prefiere el scroll horizontal a seguir encogiendo. */
  minW: number
}

export interface BandFit {
  cardW: number
  lines: number
}

/**
 * Ancho de carta con el que cabe el contenido de una banda en `lines` líneas.
 * Los anchos de los hijos son proporcionales al ancho de carta, así que el
 * contenido escala linealmente; los huecos entre cartas son fijos.
 */
function widthFit(input: BandFitInput, lines: number): number {
  const { measuredW, contentW, itemCount, gap, availW } = input
  if (contentW <= 0 || itemCount <= 0) return Infinity
  const perLine = Math.ceil(itemCount / lines)
  const waste = lines > 1 ? WRAP_WASTE : 1
  const room = availW - Math.max(0, perLine - 1) * gap
  if (room <= 0) return 0
  return (measuredW * room * lines) / (contentW * waste)
}

function heightFit(input: BandFitInput, lines: number): number {
  const rowGap = lines > 1 ? Math.max(2, Math.round(input.gap / 2)) : 0
  return (input.availH - (lines - 1) * rowGap) / (CARD_ASPECT * lines)
}

/**
 * Elige el tamaño de carta y el número de líneas de una banda: la carta más
 * grande (hasta `maxW`) que cabe sin scroll, repartiendo en 2-3 líneas cuando
 * eso permite cartas mayores que forzarlas todas en una. Si ni así se llega al
 * suelo `minW`, se queda en una línea con `minW` y el scroll horizontal hace el resto.
 */
export function fitBand(input: BandFitInput): BandFit {
  const floor = Math.min(input.minW, input.maxW)
  if (input.itemCount <= 0 || input.contentW <= 0 || input.availW <= 0) {
    return { cardW: input.maxW, lines: 1 }
  }

  let best: BandFit = { cardW: -1, lines: 1 }
  for (let lines = 1; lines <= MAX_BAND_LINES; lines++) {
    if (lines > input.itemCount) break
    const w = Math.min(input.maxW, widthFit(input, lines), heightFit(input, lines))
    if (w > best.cardW + 0.5) best = { cardW: w, lines }
  }

  if (best.cardW < floor) return { cardW: floor, lines: 1 }
  return { cardW: Math.floor(best.cardW), lines: best.lines }
}
