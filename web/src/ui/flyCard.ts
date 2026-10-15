import './flyCard.css'

const FLY_MS = 480
const IMPACT_AT = 0.85
const MAX_WAIT_FRAMES = 90
const SPARKS = 8

export type FlightTarget = string | (() => HTMLElement | null)

export interface FlightOptions {
  pop?: boolean
}

function motionAllowed(): boolean {
  if (document.documentElement.classList.contains('fx-off')) return false
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function landed(to: HTMLElement, pop: boolean, delay: number): void {
  const rect = to.getBoundingClientRect()
  if (rect.width === 0) return
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  const ring = document.createElement('div')
  ring.className = 'fly-card-ring'
  ring.setAttribute('aria-hidden', 'true')
  Object.assign(ring.style, { left: `${cx}px`, top: `${cy}px` })
  document.body.append(ring)
  ring.animate(
    [
      { transform: 'scale(0.25)', opacity: 0 },
      { transform: 'scale(0.25)', opacity: 1, offset: 0.1 },
      { transform: 'scale(1.9)', opacity: 0 },
    ],
    { duration: 480, delay, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' },
  ).onfinish = () => ring.remove()

  for (let i = 0; i < SPARKS; i++) {
    const angle = (i / SPARKS) * Math.PI * 2
    const reach = 44 + (i % 2) * 14
    const spark = document.createElement('div')
    spark.className = 'fly-card-spark'
    spark.setAttribute('aria-hidden', 'true')
    Object.assign(spark.style, { left: `${cx}px`, top: `${cy}px` })
    document.body.append(spark)
    spark.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.05 },
        { transform: `translate(${Math.cos(angle) * reach - 50}%, ${Math.sin(angle) * reach - 50}%) scale(0.2)`, opacity: 0 },
      ],
      { duration: 520, delay, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' },
    ).onfinish = () => spark.remove()
  }

  const glow = document.createElement('div')
  glow.className = 'fly-card-glow'
  glow.setAttribute('aria-hidden', 'true')
  Object.assign(glow.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    borderRadius: getComputedStyle(to).borderRadius,
  })
  document.body.append(glow)
  glow.animate(
    [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }],
    { duration: 700, delay, easing: 'ease-out', fill: 'both' },
  ).onfinish = () => glow.remove()

  if (pop && typeof to.animate === 'function') {
    to.animate(
      [{ scale: '1' }, { scale: '1.07', offset: 0.3 }, { scale: '1' }],
      { duration: 420, delay, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    )
  }
}

function launch(artSrc: string | null, from: DOMRect, to: HTMLElement | null, options: FlightOptions): void {
  if (!to) return
  const toRect = to.getBoundingClientRect()
  if (toRect.width === 0) return

  const ghost = document.createElement('div')
  ghost.className = 'fly-card-ghost'
  ghost.setAttribute('aria-hidden', 'true')
  if (artSrc) {
    const copy = document.createElement('img')
    copy.src = artSrc
    copy.alt = ''
    ghost.append(copy)
  }
  Object.assign(ghost.style, {
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
  })
  document.body.append(ghost)

  const dx = toRect.left + toRect.width / 2 - (from.left + from.width / 2)
  const dy = toRect.top + toRect.height / 2 - (from.top + from.height / 2)
  const flight = ghost.animate(
    [
      { transform: 'translate(0, 0) scale(1)' },
      { transform: `translate(${dx}px, ${dy}px) scale(0.4)` },
    ],
    { duration: FLY_MS, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' },
  )
  ghost.animate(
    [{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }],
    { duration: FLY_MS, fill: 'forwards' },
  )
  flight.onfinish = () => ghost.remove()
  flight.oncancel = () => ghost.remove()
  landed(to, options.pop ?? false, FLY_MS * IMPACT_AT)
}

function sameRect(a: DOMRect, b: DOMRect): boolean {
  return Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5
    && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5
}

function launchWhenResolved(
  artSrc: string | null,
  from: DOMRect,
  resolve: () => HTMLElement | null,
  options: FlightOptions,
  frames: number,
  previous: DOMRect | null = null,
) {
  const to = resolve()
  const rect = to?.getBoundingClientRect() ?? null
  if (to && rect && previous && sameRect(previous, rect)) {
    launch(artSrc, from, to, options)
    return
  }
  if (frames < MAX_WAIT_FRAMES) {
    requestAnimationFrame(() => launchWhenResolved(artSrc, from, resolve, options, frames + 1, rect))
  }
}

/** Flies a copy of `source` to `target`. A selector is resolved at once. A function is polled frame
 *  by frame until it returns a destination whose position has stopped moving, and if it never
 *  appears nothing flies. On landing the destination flashes; with `pop` it also bounces. */
export function flyCardTo(source: HTMLElement, target: FlightTarget, options: FlightOptions = {}): void {
  if (typeof source.animate !== 'function' || !motionAllowed()) return
  const from = source.getBoundingClientRect()
  if (from.width === 0) return
  const artSrc = source.querySelector('img')?.currentSrc || source.querySelector('img')?.src || null
  if (typeof target === 'string') {
    launch(artSrc, from, document.querySelector<HTMLElement>(target), options)
    return
  }
  launchWhenResolved(artSrc, from, target, options, 0)
}

export function landingRow(
  containerSelector: string,
  rowSelector: string,
  matches: (row: HTMLElement) => boolean,
): () => HTMLElement | null {
  let scrolled = false
  return () => {
    const rows = document.querySelectorAll<HTMLElement>(`${containerSelector} ${rowSelector}`)
    const row = [...rows].find(matches)
    if (!row) return null
    if (!scrolled) {
      row.scrollIntoView({ block: 'nearest' })
      scrolled = true
    }
    return row
  }
}
