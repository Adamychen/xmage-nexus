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
 */
export function overlayRoot(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-overlay-root]') ?? document.body
}
