import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { quickStartGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import {
  triggerOrderScenario,
  triggerOrderTergridScenario,
  TERGRID_ELVES,
  TERGRID_SIGNET,
  TERGRID_SOL_RING,
  TRIGGER_ACTIONS,
  TRIGGER_PICKS,
  WASTE_NOT_TRIGGER,
} from '../fixtures/scenarios/triggerOrder'
fakeOnly()

const WARDEN = '11111111-1111-1111-1111-111111111111'
const ARTIST = '22222222-2222-2222-2222-222222222222'

test.describe('Trigger order overlay', { tag: '@triggers' }, () => {
  test('apply chains the whole order (bottom of the stack first)', async ({ page }) => {
    await withFakeServer(triggerOrderScenario, async () => {
      const { pageErrors } = await quickStartGame(page, {
        prefix: 'trg',
        skipAsks: true,
      })
      expect(pageErrors).toEqual([])
      const overlay = page.locator('[data-testid="trigger-order-prompt"]')
      await expect(overlay).toBeVisible()
      await expect(overlay.locator('[data-arena-card]')).toHaveCount(2)
      await expect(overlay.locator('[data-testid="trigger-bubble"]')).toContainText('Soul Warden')

      await overlay.locator('[data-testid="trigger-order-done"]').click()
      // The chain answers the second prompt on its own; the overlay only hides
      // after the server's final prompt is gone.
      await expect.poll(() => TRIGGER_PICKS.length, { timeout: 5000 }).toBe(2)
      await expect(overlay).toBeHidden({ timeout: 5000 })
      // Leftmost (Last) goes onto the stack first; rightmost (First) resolves first.
      expect(TRIGGER_PICKS).toEqual([ARTIST, WARDEN])
    })
  })

  test('reordering changes the applied stack order', async ({ page }) => {
    await withFakeServer(triggerOrderScenario, async () => {
      const { pageErrors } = await quickStartGame(page, {
        prefix: 'trg',
        skipAsks: true,
      })
      expect(pageErrors).toEqual([])
      const overlay = page.locator('[data-testid="trigger-order-prompt"]')
      await expect(overlay).toBeVisible()
      // Soul Warden starts as #1 (First / rightmost). Move it toward Last so Blood Artist resolves first.
      await overlay.locator('.trigger-bubble-tools button').first().click()
      await overlay.locator('[data-testid="trigger-order-done"]').click()
      await expect.poll(() => TRIGGER_PICKS.length, { timeout: 5000 }).toBe(2)
      await expect(overlay).toBeHidden({ timeout: 5000 })
      expect(TRIGGER_PICKS).toEqual([WARDEN, ARTIST])
    })
  })

  test('remembering "always first" does not place the trigger', async ({ page }) => {
    TRIGGER_ACTIONS.length = 0
    await withFakeServer(triggerOrderScenario, async () => {
      const { pageErrors } = await quickStartGame(page, {
        prefix: 'trg',
        skipAsks: true,
      })
      expect(pageErrors).toEqual([])
      const overlay = page.locator('[data-testid="trigger-order-prompt"]')
      await expect(overlay).toBeVisible()
      await overlay.locator('[data-testid="trigger-pin-first"]').click()
      await expect(overlay.locator('.trigger-saved')).toBeVisible()
      await expect(overlay).toBeVisible()
      expect(TRIGGER_PICKS).toEqual([])
      expect(TRIGGER_ACTIONS).toContain('TRIGGER_AUTO_ORDER_ABILITY_FIRST')
    })
  })

  test('PRM-14: Tergrid triggers show the graveyard card each one brings back, with preview and inspector', async ({ page }) => {
    await withFakeServer(triggerOrderTergridScenario, async () => {
      const { pageErrors } = await quickStartGame(page, {
        prefix: 'trg',
        skipAsks: true,
      })
      expect(pageErrors).toEqual([])
      const overlay = page.locator('[data-testid="trigger-order-prompt"]')
      await expect(overlay).toBeVisible()
      await expect(overlay.locator('[data-arena-card]')).toHaveCount(4)
      // Three sibling triggers of Tergrid carry target badges on the fan; Waste Not has none.
      await expect(overlay.locator(`[data-arena-card="${TERGRID_ELVES}"] .trigger-fan-target`)).toHaveText('→ Llanowar Elves')
      await expect(overlay.locator(`[data-arena-card="${TERGRID_SOL_RING}"] .trigger-fan-target`)).toHaveText('→ Sol Ring')
      await expect(overlay.locator(`[data-arena-card="${TERGRID_SIGNET}"] .trigger-fan-target`)).toHaveText('→ Arcane Signet')
      await expect(overlay.locator(`[data-arena-card="${WASTE_NOT_TRIGGER}"] .trigger-fan-target`)).toHaveCount(0)

      // The first trigger (Tergrid → Llanowar Elves) is active in the bubble, with its target card at full size beside it.
      const bubble = overlay.locator('[data-testid="trigger-bubble"]')
      await expect(bubble.locator('.trigger-object-name')).toHaveText('Llanowar Elves')

      const elves = overlay.locator('.trigger-object-art')
      await elves.hover()
      await expect(elves).toHaveClass(/is-previewing/)
      await elves.click({ button: 'right' })
      const inspector = page.locator('.card-inspector')
      await expect(inspector).toBeVisible()
      await expect(inspector).toContainText('Llanowar Elves')
      await page.keyboard.press('Escape')
      await expect(inspector).toBeHidden()
      await expect(overlay).toBeVisible()
      expect(TRIGGER_PICKS).toEqual([])

      await overlay.locator('[data-testid="trigger-order-done"]').click()
      await expect.poll(() => TRIGGER_PICKS.length, { timeout: 5000 }).toBe(4)
      await expect(overlay).toBeHidden({ timeout: 5000 })
    })
  })
})
