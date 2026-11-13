/**
 * BRD-46: the symbols of a +1/+1 and a -1/-1 counter, which carry the sign cut
 * into the shape, so the badge beside them only has to say how many.
 *
 * From the Mana icon set (https://github.com/andrewgioia/mana, font under SIL
 * OFL 1.1 and styles under MIT; the symbols themselves are Wizards of the
 * Coast's, like the mana symbols this app already serves from
 * `public/symbols`). `currentColor` paints them, so the colour comes from the
 * badge the chip is in.
 */
const MARKS = {
  plus: 'M12.813 0l12.803 8.743v23.257l-12.803-8.708-12.803 8.708v-23.257l12.813-8.743zM14.25 7.75h-2.875v4.75h-4.75v2.875h4.75v4.75h2.875v-4.75h4.75v-2.875h-4.75v-4.75z',
  minus: 'M25.616 0v23.257l-12.803 8.743-12.803-8.743v-23.257l12.803 8.708 12.803-8.708zM14.499 15.382l-5.799-0.004-1.935 3.248h10.16l1.935-3.248-4.361 0.004z',
} as const

export type CounterMarkKind = keyof typeof MARKS

export default function CounterMark({ kind }: { kind: CounterMarkKind }) {
  return (
    <svg className={`counter-mark is-${kind}`} viewBox="0 0 26 32" aria-hidden="true" focusable="false">
      <path d={MARKS[kind]} fillRule="evenodd" />
    </svg>
  )
}
