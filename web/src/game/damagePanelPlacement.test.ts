import { describe, it, expect } from 'vitest'
import { placeDamagePanel, PANEL_MARGIN } from './damagePanelPlacement'

const viewport = { width: 1280, height: 720 }
const trigger = (top: number, height = 20) => ({ left: 600, right: 620, top, bottom: top + height })

describe('PNL-12: where the commander damage panel opens', () => {
  it('PNL-12: the own seat opens upwards while there is room above the button', () => {
    const { top } = placeDamagePanel({ trigger: trigger(600), panelHeight: 220, panelWidth: 264, viewport, side: 'my' })
    expect(top).toBe(600 - 6 - 220)
  })

  it('PNL-12: with no room above, the own panel turns over and opens downwards', () => {
    const { top } = placeDamagePanel({ trigger: trigger(120), panelHeight: 400, panelWidth: 264, viewport, side: 'my' })
    expect(top).toBe(140 + 6)
  })

  it('PNL-12: an opponent opens downwards, and turns over when the bottom has no room', () => {
    const down = placeDamagePanel({ trigger: trigger(60), panelHeight: 220, panelWidth: 264, viewport, side: 'opp' })
    expect(down.top).toBe(80 + 6)
    const up = placeDamagePanel({ trigger: trigger(600), panelHeight: 220, panelWidth: 264, viewport, side: 'opp' })
    expect(up.top).toBe(600 - 6 - 220)
  })

  it('PNL-12: a panel that fits on neither side still has its head on screen and scrolls the rest', () => {
    const tall = placeDamagePanel({ trigger: trigger(300), panelHeight: 900, panelWidth: 264, viewport, side: 'my' })
    expect(tall.top).toBe(PANEL_MARGIN)
    expect(tall.maxHeight).toBe(viewport.height - PANEL_MARGIN * 2)
  })

  it('PNL-12: the panel is centred on its button without leaving the screen sideways', () => {
    const edge = placeDamagePanel({
      trigger: { left: 1270, right: 1278, top: 400, bottom: 420 },
      panelHeight: 200,
      panelWidth: 264,
      viewport,
      side: 'my',
    })
    expect(edge.left).toBe(viewport.width - 264 - PANEL_MARGIN)
    expect(edge.left + 264).toBeLessThanOrEqual(viewport.width)
  })
})
