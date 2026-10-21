import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { quickStartGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { planeswalkerScenario } from '../fixtures/scenarios/planeswalker'
fakeOnly()

test.describe('Planeswalker Ability Dialog', { tag: '@planeswalker' }, () => {
  test('renders dedicated PW dialog with loyalty deltas and activates', async ({ page }) => {
    await withFakeServer(planeswalkerScenario, async () => {
      const { pageErrors } = await quickStartGame(page, {
        prefix: 'pw',
      })
      expect(pageErrors).toEqual([])
      const dialog = page.locator('.pw-dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog).toContainText('PLANESWALKER')
      await expect(dialog).toContainText('+2')
      await expect(dialog).toContainText('-3')
      await expect(dialog).toContainText('-8')
      const btns = dialog.locator('.pw-ability-btn')
      await expect(btns).toHaveCount(3)
      await expect(btns.first()).toHaveClass(/delta-pos/)
      await btns.first().click()
      await expect(dialog).toBeHidden({ timeout: 5000 })
    })
  })
})
