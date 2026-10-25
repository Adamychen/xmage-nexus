/**
 * Container for the full-screen viewers portaled out of the board
 * (`PileOverlay`, `HandViewer`, `CrossZoneOverlay`).
 *
 * <p>The dev gallery (`#/gallery`) renders its own `[data-overlay-root]` inside
 * the stage: a body-level portal with `z-index: 100` was painted under the
 * gallery shell (`z-index: 500`), so revealed/looked-at/companion, cemetery
 * and cross-zone viewers existed in the DOM but were invisible. Inside the
 * gallery those overlays must sit above the board and below the state selector
 * (`z-index: 1000000`), which is exactly what an in-stage root provides.
 *
 * <p>Without a gallery host the overlays go to a body-level `.board-surface`
 * wrapper (created once), so they take the dark game palette (APR-2) even
 * though they sit outside the game screen.
 */
let bodySurfaceRoot: HTMLElement | null = null

function bodySurface(): HTMLElement {
  if (!bodySurfaceRoot || !bodySurfaceRoot.isConnected) {
    bodySurfaceRoot = document.createElement('div')
    bodySurfaceRoot.className = 'board-surface'
    document.body.appendChild(bodySurfaceRoot)
  }
  return bodySurfaceRoot
}

export function overlayRoot(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-overlay-root]') ?? bodySurface()
}
