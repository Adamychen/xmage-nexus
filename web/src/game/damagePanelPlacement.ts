/** The box a trigger button occupies on screen, in viewport coordinates. */
export interface TriggerBox {
  left: number
  right: number
  top: number
  bottom: number
}

export interface PlacementInput {
  trigger: TriggerBox
  /** The panel's own height once rendered; 0 before it has been measured. */
  panelHeight: number
  panelWidth: number
  viewport: { width: number; height: number }
  /** Where the panel is drawn from: the own seat opens upwards, an opponent's downwards. */
  side: 'my' | 'opp'
}

export interface Placement {
  left: number
  top: number
  /** The room the panel has on screen, so a long list scrolls instead of growing off it. */
  maxHeight: number
}

export const PANEL_MARGIN = 10
export const PANEL_GAP = 6

/**
 * PNL-12: where the commander damage panel goes. It opens away from the board (the own seat
 * upwards, an opponent's downwards) while that side has room for it, turns to the other side when
 * it does not, and stays on screen either way.
 */
export function placeDamagePanel({ trigger, panelHeight, panelWidth, viewport, side }: PlacementInput): Placement {
  const left = Math.max(
    PANEL_MARGIN,
    Math.min(trigger.left + (trigger.right - trigger.left) / 2 - panelWidth / 2, viewport.width - panelWidth - PANEL_MARGIN),
  )
  const maxHeight = Math.max(0, viewport.height - PANEL_MARGIN * 2)
  const height = Math.min(panelHeight, maxHeight)

  const above = trigger.top - PANEL_GAP - height
  const below = trigger.bottom + PANEL_GAP
  const fitsAbove = above >= PANEL_MARGIN
  const fitsBelow = below + height <= viewport.height - PANEL_MARGIN

  let top: number
  if (side === 'my') top = fitsAbove ? above : fitsBelow ? below : above
  else top = fitsBelow ? below : fitsAbove ? above : below

  return { left, top: Math.max(PANEL_MARGIN, Math.min(top, viewport.height - height - PANEL_MARGIN)), maxHeight }
}
