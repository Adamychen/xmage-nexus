/**
 * BRD-55: how far the digits of the board's display font sit from the middle of their line box,
 * as a share of the font size. A line box is ascent plus descent, and a display face whose ascent
 * is far taller than its digits leaves that slack above them, so a number centred by its box reads
 * low in a badge. The value is measured from the font itself and published as `--digit-shift`, so
 * the badges can lift their numbers onto the middle of the plate instead of carrying a constant
 * somebody tuned by eye on one machine.
 */
const FALLBACK = 0

export function measureDigitShift(font: string): number {
  if (typeof document === 'undefined') return FALLBACK
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return FALLBACK
  ctx.font = font
  const m = ctx.measureText('0123456789')
  const size = parseFloat(font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '0')
  if (!size) return FALLBACK
  const boxCentre = (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2
  const inkCentre = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2
  if (!Number.isFinite(boxCentre) || !Number.isFinite(inkCentre)) return FALLBACK
  // Positive when the ink sits below the middle of the box, which is the lift the badge needs.
  return (boxCentre - inkCentre) / size
}

function shiftOf(root: HTMLElement, family: string): number {
  const probe = document.createElement('span')
  probe.style.cssText = `position:absolute;visibility:hidden;font-family:${family};font-weight:800;font-size:100px`
  root.appendChild(probe)
  const style = getComputedStyle(probe)
  const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  probe.remove()
  return measureDigitShift(font)
}

/**
 * Measures both faces the board writes numbers in and publishes their lift: `--digit-shift` for
 * the display font (the life total) and `--digit-shift-ui` for the one the badges use.
 */
export function publishDigitShift(root: HTMLElement = document.documentElement): { display: number; ui: number } {
  const display = shiftOf(root, 'var(--font-display)')
  const ui = shiftOf(root, 'var(--font-ui)')
  root.style.setProperty('--digit-shift', `${display.toFixed(4)}em`)
  root.style.setProperty('--digit-shift-ui', `${ui.toFixed(4)}em`)
  return { display, ui }
}
