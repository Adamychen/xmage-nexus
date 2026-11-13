import { intToRoman } from './saga'

/**
 * BRD-44: the chapters of a saga as the card prints them, one hexagon per
 * chapter with its numeral, the ones already read filled and the rest waiting.
 * The count comes from the card, so a saga of four or five chapters gets four
 * or five hexagons instead of the three a printed Saga usually has.
 */

const W = 78
const H = 90
const GAP = 10
const NUMERAL = 46
/** Share of the font size the digits fill above the baseline (see StatPlate). */
const CAP_HEIGHT = 0.7

function hexagon(x: number): string {
  const half = W / 2
  const quarter = H / 4
  return [
    `${x + half},0`,
    `${x + W},${quarter}`,
    `${x + W},${H - quarter}`,
    `${x + half},${H}`,
    `${x},${H - quarter}`,
    `${x},${quarter}`,
  ].join(' ')
}

export default function SagaTrack({ chapters, current }: { chapters: number; current: number }) {
  const total = Math.max(1, Math.min(chapters, 9))
  const width = total * W + (total - 1) * GAP
  return (
    <svg
      className="saga-track"
      viewBox={`-3 -3 ${width + 6} ${H + 6}`}
      data-chapters={total}
      data-current={current}
      aria-hidden="true"
      focusable="false"
    >
      {Array.from({ length: total }, (_, i) => {
        const x = i * (W + GAP)
        const chapter = i + 1
        const state = chapter < current ? 'read' : chapter === current ? 'now' : 'next'
        return (
          <g key={chapter} data-chapter-state={state}>
            <polygon points={hexagon(x)} />
            <text x={x + W / 2} y={H / 2 + (NUMERAL * CAP_HEIGHT) / 2} fontSize={NUMERAL} textAnchor="middle">
              {intToRoman(chapter)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
