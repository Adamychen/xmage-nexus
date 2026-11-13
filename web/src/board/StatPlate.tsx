/**
 * BRD-43: the plates a card prints its own numbers on, drawn as vectors with
 * the number inside them: the loyalty plate of a planeswalker and the spiked
 * defense badge of a battle.
 *
 * The number is SVG text inside the same drawing, not HTML text centred over
 * it, because an HTML box is centred by its line box: with this display font
 * the half-leading is negative and the ink of a digit lands above the middle,
 * which is what made the number read high on the plate. Here it is placed from
 * the shape's own centre and the cap height of the digits, so what is centred
 * is the ink.
 *
 * The outlines come from the Mana icon set (https://github.com/andrewgioia/mana,
 * font under SIL OFL 1.1 and styles under MIT; the symbols themselves are
 * Wizards of the Coast's, like the mana symbols this app already serves from
 * `public/symbols`). The defense symbol only ships as a font glyph, so its path
 * comes from the glyph, flipped upright: an SVG font draws from the baseline
 * upwards. Each viewBox is its shape plus half of the stroke that rims it, so
 * the badge box and the painted shape share a centre.
 */

/** Share of the font size the digits of the display font fill above the baseline. */
const CAP_HEIGHT = 0.7

interface Shape {
  viewBox: string
  /** Where the body of the shape reads as centred, in its own units. */
  centre: [x: number, y: number]
  /** Font size per digit count, so a longer number never reaches the rim. */
  size: [one: number, two: number, more: number]
  path: string
  /** Flip for a path taken from an SVG font (baseline up). */
  flip?: number
}

const LOYALTY: Shape = {
  viewBox: '-1.6 4.8 35.2 21.8',
  centre: [16, 17.2],
  size: [12.6, 10.4, 8],
  path: 'M22.308 6.408l9.648 3.523c0 0-1.648 2.304-2.12 5.295s-0.006 5.352-0.006 5.352l-13.831 4.813-13.738-4.813c0 0 0.396-2.361 0.081-5.037s-2.3-5.61-2.3-5.61l9.608-3.431 0.069-0.001c0.665 1.74 2.739 2.587 4.338 2.904 0.889 0.177 1.162 0.164 1.941 0.189 2.027-0.029 5.556-0.81 6.308-3.184z',
}

const DEFENSE: Shape = {
  viewBox: '49.29 103.88 822.35 858.84',
  centre: [460.5, 533.3],
  size: [430, 350, 270],
  flip: 960,
  path: 'M370.481 724.636c0 0 95.104 99.485 95.104 99.485s93.865-99.485 93.865-99.485c0 0 279.156 71.741 279.156 71.741s-116.427-258.057-116.427-258.057c0 0 106.249-111.572 106.249-111.572s-106.249-112.959-106.249-112.959c0 0 117.456-257.567 117.456-257.567s-280.185 72.724-280.185 72.724c0 0-94.433-99.669-94.433-99.669s-94.536 99.669-94.536 99.669c0 0-289.195-79.34-289.195-79.34s122.539 266.088 122.856 264.182c0.319-1.905-104.911 111.939-104.911 111.939s104.911 112.592 104.911 112.592c0 0-121.264 254.394-121.264 254.394s287.602-68.079 287.602-68.079z',
}

function StatPlate({ shape, kind, value, valueClass = '' }: { shape: Shape; kind: 'loyalty' | 'defense'; value: string; valueClass?: string }) {
  const digits = value.length
  const size = shape.size[Math.min(digits, 3) - 1]
  const [cx, cy] = shape.centre
  return (
    <svg className={`${kind}-plate`} viewBox={shape.viewBox} aria-hidden="true" focusable="false">
      <g transform={shape.flip ? `translate(0, ${shape.flip}) scale(1, -1)` : undefined}>
        <path paintOrder="stroke" d={shape.path} />
      </g>
      <text
        className={`${kind}-val ${valueClass}`.trim()}
        x={cx}
        y={cy + (size * CAP_HEIGHT) / 2}
        fontSize={size}
        textAnchor="middle"
      >
        {value}
      </text>
    </svg>
  )
}

export function LoyaltyPlate(props: { value: string; valueClass?: string }) {
  return <StatPlate shape={LOYALTY} kind="loyalty" {...props} />
}

export function DefensePlate(props: { value: string; valueClass?: string }) {
  return <StatPlate shape={DEFENSE} kind="defense" {...props} />
}
