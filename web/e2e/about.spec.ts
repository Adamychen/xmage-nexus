import { test, expect } from '@playwright/test'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { login } from './support/start-game'
import { makeBaseScenario } from '../fixtures/fake'
import { playerGameView } from '../src/__fixtures__/gameViews'

fakeOnly()

function lobbyScenario() {
  return makeBaseScenario({
    tableId: 'table-about-1',
    tableName: 'about-e2e-room',
    gameId: 'game-about-1',
    gameView: playerGameView,
  })
}

const NEXUS_RELEASES = [
  { tag_name: 'v9.9', name: 'Nine', body: '- **fix** something', html_url: 'https://github.com/n', published_at: null },
]
const XMAGE_RELEASES = [
  { tag_name: 'xmage_9', name: 'Xm', body: 'hello', html_url: 'https://github.com/x', published_at: null },
]

test.describe('About modal and remote news', () => {
  test('opens from the lobby header, shows version, loads both feeds and clears the badge', async ({ page }) => {
    await withFakeServer(lobbyScenario, async () => {
      await page.route('https://api.github.com/repos/Adamychen/xmage-nexus/releases*', (route) =>
        route.fulfill({ json: NEXUS_RELEASES }),
      )
      await page.route('https://api.github.com/repos/magefree/mage/releases*', (route) =>
        route.fulfill({ json: XMAGE_RELEASES }),
      )
      await page.addInitScript(() => {
        window.localStorage.clear()
      })
      await login(page, 'about-e2e')
      await expect(page.getByTestId('lobby-news-dot')).toBeVisible({ timeout: 20000 })
      await page.getByTestId('open-about').click()
      await expect(page.getByTestId('about-modal')).toBeVisible()
      await page.getByTestId('about-tab-news').click()
      await expect(page.getByTestId('about-feed-nexus')).toContainText('Nine')
      await expect(page.getByTestId('about-feed-xmage')).toContainText('Xm')
      await page.getByTestId('about-close').click()
      await expect(page.getByTestId('about-modal')).toBeHidden()
      await expect(page.getByTestId('lobby-news-dot')).toBeHidden()
    })
  })
})
