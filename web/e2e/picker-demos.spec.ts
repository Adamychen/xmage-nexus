import { test, expect } from '@playwright/test'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { login } from './support/start-game'
import { makeBaseScenario } from '../fixtures/fake'
import { playerGameView } from '../src/__fixtures__/gameViews'

fakeOnly()

function lobbyScenario() {
  return makeBaseScenario({
    tableId: 'table-demo-1',
    tableName: 'picker-demos',
    gameId: 'game-demo-1',
    gameView: playerGameView,
  })
}

/** Every decorative `<img>` in scope must actually decode: local showcase art
 * is committed, so a 404 (renamed/missing file) must fail here, not silently. */
async function expectAllImagesLoaded(page: import('@playwright/test').Page, selector: string, minCount: number) {
  await expect
    .poll(
      async () =>
        page.evaluate((sel: string) => {
          const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(sel))
          return imgs.every((i) => i.complete && i.naturalWidth > 0) ? imgs.length : -1
        }, selector),
      { timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(minCount)
}

test.describe('Visual preset & playmat pickers', { tag: '@site' }, () => {
  test('gameplay presets and playmat tiles render with loaded local art', async ({ page }) => {
    await withFakeServer(lobbyScenario, async () => {
      await login(page, 'e2e')
      await page.getByTestId('open-settings').click()
      await page.getByTestId('settings-nav-gameplay').click()
      for (const id of ['simple', 'balanced', 'manual']) {
        await expect(page.getByTestId(`preset-demo-${id}`)).toBeVisible()
      }
      await expectAllImagesLoaded(page, '[data-testid^="preset-demo-"] .preset-tile-art', 13)
      await page.screenshot({ path: '/tmp/picker-presets.png' })
      await page.getByTestId('settings-nav-board').click()
      await expectAllImagesLoaded(page, '.settings-content .playmat-item img.playmat-table-card', 20)
      await page.screenshot({ path: '/tmp/picker-playmats.png' })
    })
  })
})
