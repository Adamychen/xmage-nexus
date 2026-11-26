export type VfxColorKey =
  | 'W'
  | 'U'
  | 'B'
  | 'R'
  | 'G'
  | 'C'
  | 'gold'
  | 'ember'
  | 'ash'
  | 'blood'
  | 'toxic'
  | 'volt'
  | 'brand'
  | 'arena'

export type RgbTriplet = readonly [number, number, number]

const TOKEN_VAR: Record<VfxColorKey, string> = {
  W: '--mana-w-rgb',
  U: '--mana-u-rgb',
  B: '--mana-b-rgb',
  R: '--mana-r-rgb',
  G: '--mana-g-rgb',
  C: '--mana-c-rgb',
  gold: '--gold-rgb',
  ember: '--ember-rgb',
  ash: '--ash-rgb',
  blood: '--blood-rgb',
  toxic: '--toxic-rgb',
  volt: '--volt-rgb',
  brand: '--brand-rgb',
  arena: '--arena-glow-rgb',
}

/** Fallback neutral triplet used only in headless/jsdom environments where stylesheets are absent. */
const FALLBACK_RGB: RgbTriplet = [220, 226, 240]

const cache = new Map<VfxColorKey, RgbTriplet>()

function parseRgbTriplet(raw: string): RgbTriplet | null {
  const parts = raw
    .trim()
    .split(/[\s,]+/)
    .map((n) => Number.parseFloat(n))
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return null
  return [parts[0]!, parts[1]!, parts[2]!]
}

/** Resolves a semantic VFX color token from `web/src/ui/tokens.css`. */
export function resolveVfxRgb(key: VfxColorKey): RgbTriplet {
  const cached = cache.get(key)
  if (cached) return cached
  if (typeof document !== 'undefined' && typeof getComputedStyle === 'function') {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(TOKEN_VAR[key])
    const parsed = parseRgbTriplet(raw)
    if (parsed) {
      cache.set(key, parsed)
      return parsed
    }
  }
  return FALLBACK_RGB
}

export function clearVfxPaletteCache(): void {
  cache.clear()
}

export function rgba(rgb: RgbTriplet, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha))
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`
}

/** Maps a mana color code (`w`/`W`, `u`/`U`, `b`/`B`, `r`/`R`, `g`/`G`, `c`/`C`) to a VFX color key. */
export function manaToVfxColor(mana: string | null | undefined, fallback: VfxColorKey = 'gold'): VfxColorKey {
  const upper = String(mana ?? '').toUpperCase()
  if (upper === 'W' || upper === 'U' || upper === 'B' || upper === 'R' || upper === 'G' || upper === 'C') {
    return upper
  }
  return fallback
}
