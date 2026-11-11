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

test.describe('Trigger order dialog', { tag: '@triggers' }, () => {
  test('renders one row per trigger and picks them one by one', async ({ page }) => {
    await withFakeServer(triggerOrderScenario, async () => {
      const { pageErrors } = await quickStartGame(page, {
        prefix: 'trg',
        skipAsks: true,
      })
      expect(pageErrors).toEqual([])
      const dialog = page.locator('.trigger-dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.locator('.trigger-row')).toHaveCount(2)
      await expect(dialog).toContainText('Soul Warden')
      await expect(dialog).toContainText('Blood Artist')

      await dialog.locator(`[data-testid="trigger-row-${WARDEN}"] .ui-btn--primary`).click()
      // The server re-asks with the remaining ability.
      await expect(dialog.locator('.trigger-row')).toHaveCount(1)
      await expect(dialog).toContainText('Blood Artist')
      await dialog.locator(`[data-testid="trigger-row-${ARTIST}"] .ui-btn--primary`).click()
      await expect(dialog).toBeHidden({ timeout: 5000 })
      expect(TRIGGER_PICKS).toEqual([WARDEN, ARTIST])
    })
  })

  test('apply chains the whole order (bottom of the stack first)', async ({ page }) => {
    await withFakeServer(triggerOrderScenario, async () => {
      const { pageErrors } = await quickStartGame(page, {
        prefix: 'trg',
        skipAsks: true,
      })
      expect(pageErrors).toEqual([])
      const dialog = page.locator('.trigger-dialog')
      await expect(dialog).toBeVisible()
      await dialog.locator('.trigger-apply').click()
      // The chain answers the second prompt on its own; the dialog only hides
      // after the server's final prompt is gone.
      await expect.poll(() => TRIGGER_PICKS.length, { timeout: 5000 }).toBe(2)
      await expect(dialog).toBeHidden({ timeout: 5000 })
      // Display order is resolution order: the last one resolves first, so it is
      // the first UUID the server receives.
      expect(TRIGGER_PICKS).toEqual([ARTIST, WARDEN])
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
      const dialog = page.locator('.trigger-dialog')
      await expect(dialog).toBeVisible()
      const row = dialog.locator(`[data-testid="trigger-row-${WARDEN}"]`)
      await row.locator('.trigger-actions button').nth(1).click()
      await expect(row.locator('.trigger-saved')).toBeVisible()
      await expect(dialog).toBeVisible()
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
      const dialog = page.locator('.trigger-dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.locator('.trigger-row')).toHaveCount(4)
      // Three rows of one source, told apart by the card each one points at.
      await expect(dialog.locator('.trigger-row.is-sibling')).toHaveCount(3)
      const names = (id: string) => dialog.locator(`[data-testid="trigger-row-${id}"] .trigger-object-name`)
      await expect(names(TERGRID_ELVES)).toHaveText('Llanowar Elves')
      await expect(names(TERGRID_SOL_RING)).toHaveText('Sol Ring')
      await expect(names(TERGRID_SIGNET)).toHaveText('Arcane Signet')
      await expect(dialog.locator(`[data-testid="trigger-row-${WASTE_NOT_TRIGGER}"] .trigger-object`)).toHaveCount(0)

      const elves = dialog.locator(`[data-testid="trigger-row-${TERGRID_ELVES}"] .trigger-object-art`)
      await elves.hover()
      await expect(elves).toHaveClass(/is-previewing/)
      await elves.click({ button: 'right' })
      const inspector = page.locator('.card-inspector')
      await expect(inspector).toBeVisible()
      await expect(inspector).toContainText('Llanowar Elves')
      await page.keyboard.press('Escape')
      await expect(inspector).toBeHidden()
      await expect(dialog).toBeVisible()
      expect(TRIGGER_PICKS).toEqual([])

      await dialog.locator(`[data-testid="trigger-row-${TERGRID_SOL_RING}"] .ui-btn--primary`).click()
      await expect(dialog.locator('.trigger-row')).toHaveCount(3)
      expect(TRIGGER_PICKS).toEqual([TERGRID_SOL_RING])
    })
  })
})
