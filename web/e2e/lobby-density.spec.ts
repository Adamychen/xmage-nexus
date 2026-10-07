import { test, expect } from '@playwright/test'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { login } from './support/start-game'
import { makeBaseScenario } from '../fixtures/fake'
import { playerGameView } from '../src/__fixtures__/gameViews'

fakeOnly()

const scenario = () => makeBaseScenario({
  tableId: 'table-density-1',
  tableName: 'density-e2e-room',
  gameId: 'game-density-1',
  gameView: playerGameView,
})

test('the tables list switches to compact rows and remembers it', { tag: '@lobby' }, async ({ page }) => {
  await withFakeServer(scenario, async () => {
    await login(page, 'density-user')
    const list = page.locator('.tables-list')
    const toggle = page.getByTestId('tables-density-toggle')
    await expect(list).not.toHaveClass(/is-compact/)
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')

    await toggle.click()
    await expect(list).toHaveClass(/is-compact/)
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    // one line per table: the seat roster is the bulk of a card
    await expect(page.locator('.tables-list .table-seats-roster').first()).toBeHidden()

    await page.reload()
    await expect(page.locator('.tables-list')).toHaveClass(/is-compact/, { timeout: 20_000 })
  })
})
