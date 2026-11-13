/**
 * BRD-45: the mark on a commander, the Commander symbol itself in gold instead
 * of a generic crown. Three panels, the middle one over the two sides, drawn
 * with `currentColor` so the colour comes from the badge.
 */
const SIDE = 'M12 93 L120 85 L138 95 Q156 200 160 352 L125 351 L22 308 Q5 210 0 113 Z'
const MIDDLE = 'M282 0 L384 48 L406 70 Q380 190 382 386 L373 390 L282 437 L191 390 L183 386 Q184 190 159 70 L180 48 Z'

export default function CommanderMark({ className = '' }: { className?: string }) {
  return (
    <svg className={`commander-mark ${className}`.trim()} viewBox="0 0 565 437" aria-hidden="true" focusable="false">
      <path d={SIDE} />
      <path d={SIDE} transform="matrix(-1 0 0 1 565 0)" />
      <path d={MIDDLE} />
    </svg>
  )
}
