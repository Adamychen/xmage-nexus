import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { login } from './support/start-game'
import { makeBaseScenario } from '../fixtures/fake'
import { playerGameView } from '../src/__fixtures__/gameViews'

fakeOnly()

const scenario = () => makeBaseScenario({
  tableId: 'table-a11y-1',
  tableName: 'a11y-room',
  gameId: 'game-a11y-1',
  gameView: playerGameView,
})

async function violations(page: Page, scope?: string) {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa'])
  if (scope) builder = builder.include(scope)
  const r = await builder.analyze()
  return r.violations.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0].target.join(' ')}`)
}

test('the lobby has no WCAG A/AA violations @a11y', async ({ page }) => {
  await withFakeServer(scenario, async () => {
    await login(page, 'a11y-user')
    expect(await violations(page)).toEqual([])
  })
})

test('the create-table dialog has no WCAG A/AA violations @a11y', async ({ page }) => {
  await withFakeServer(scenario, async () => {
    await login(page, 'a11y-user')
    await page.getByRole('button', { name: /Nueva/i }).first().click()
    await expect(page.getByRole('heading', { name: /Nueva mesa|Crear Mesa/i })).toBeVisible()
    expect(await violations(page, '.dlg-panel')).toEqual([])
  })
})

test('every settings section has no WCAG A/AA violations @a11y', async ({ page }) => {
  await withFakeServer(scenario, async () => {
    await login(page, 'a11y-user')
    await page.getByTestId('open-settings').click()
    await expect(page.getByTestId('settings-modal')).toBeVisible()
    const navs = page.locator('[data-testid^="settings-nav-"]')
    const n = await navs.count()
    expect(n).toBeGreaterThan(3)
    const found: string[] = []
    for (let i = 0; i < n; i++) {
      const nav = navs.nth(i)
      const id = await nav.getAttribute('data-testid')
      await nav.click()
      for (const v of await violations(page, '[data-testid="settings-modal"]')) found.push(`${id}: ${v}`)
    }
    expect(found).toEqual([])
  })
})

test('the about dialog has no WCAG A/AA violations @a11y', async ({ page }) => {
  await withFakeServer(scenario, async () => {
    await login(page, 'a11y-user')
    await page.getByTestId('lobby-more-menu').click()
    await page.getByTestId('open-about').click()
    await expect(page.locator('.dlg-panel')).toBeVisible()
    expect(await violations(page, '.dlg-panel')).toEqual([])
  })
})
