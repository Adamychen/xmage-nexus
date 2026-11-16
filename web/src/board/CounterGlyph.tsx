import type { CSSProperties } from 'react'
import { counterArtUrl } from './glyphs/counterArt'
import './CounterGlyph.css'

/**
 * BRD-53: the symbol of a counter, painted through a mask so it takes the colour of the badge it
 * sits in. A counter with no symbol of its own draws nothing here and the badge falls back to the
 * glyph it used before.
 */
export default function CounterGlyph({ name }: { name: string }): React.ReactElement | null {
  const art = counterArtUrl(name)
  if (!art) return null
  return <span className="counter-art" style={{ '--counter-art': `url("${art}")` } as CSSProperties} aria-hidden="true" />
}
