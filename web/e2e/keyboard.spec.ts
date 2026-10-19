import { test, expect } from '@playwright/test'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { login } from './support/start-game'
import { makeBaseScenario } from '../fixtures/fake'
import { playerGameView } from '../src/__fixtures__/gameViews'

fakeOnly()

const scenario = () => makeBaseScenario({
  tableId: 'table-kb-1',
  tableName: 'keyboard-room',
  gameId: 'game-kb-1',
  gameView: playerGameView,
})

test('the lobby can be driven with the keyboard alone @a11y', async ({ page }) => {
  await withFakeServer(scenario, async () => {
    await login(page, 'kb-user')
    const create = page.locator('.top-nav-create')
    await expect(create).toBeVisible()

    await create.focus()
    await expect(create).toBeFocused()
    await page.keyboard.press('Enter')
    const heading = page.getByRole('heading', { name: /Nueva mesa|Crear Mesa/i })
    await expect(heading).toBeVisible()

    const dialog = page.locator('.dlg-panel').first()
    await page.keyboard.press('Tab')
    const insideAfterTab = await dialog.evaluate((d) => d.contains(document.activeElement))
    expect(insideAfterTab).toBe(true)

    for (let i = 0; i < 12; i++) await page.keyboard.press('Tab')
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)

    await page.keyboard.press('Escape')
    await expect(heading).toBeHidden()
  })
})

test('every top-nav control is reachable by Tab and has an accessible name @a11y', async ({ page }) => {
  await withFakeServer(scenario, async () => {
    await login(page, 'kb-user')
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const buttons = nav.locator('button')
    const n = await buttons.count()
    expect(n).toBeGreaterThanOrEqual(3)
    for (let i = 0; i < n; i++) {
      const b = buttons.nth(i)
      const name = ((await b.getAttribute('aria-label')) ?? (await b.innerText()) ?? (await b.getAttribute('title')) ?? '').trim()
      expect(name.length, `nav button #${i} has no accessible name`).toBeGreaterThan(0)
      expect(await b.getAttribute('tabindex')).not.toBe('-1')
    }
    await buttons.first().focus()
    const seen = new Set<string>()
    for (let i = 0; i < n + 2; i++) {
      seen.add(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.className ?? ''))
      await page.keyboard.press('Tab')
    }
    expect(seen.size).toBeGreaterThanOrEqual(3)
  })
})

test('settings opens from the keyboard and Escape closes it @a11y', async ({ page }) => {
  await withFakeServer(scenario, async () => {
    await login(page, 'kb-user')
    await page.getByTestId('open-settings').focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('settings-modal')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('settings-modal')).toBeHidden()
  })
})
