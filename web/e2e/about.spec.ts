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
      await expect(page.getByTestId('whats-new-dot')).toBeVisible({ timeout: 20000 })
      await page.getByTestId('lobby-more-menu').click()
      await page.getByTestId('open-about').click()
      await expect(page.getByTestId('about-modal')).toBeVisible()
      await page.getByTestId('about-tab-news').click()
      await expect(page.getByTestId('about-feed-nexus')).toContainText('Nine')
      await expect(page.getByTestId('about-feed-xmage')).toContainText('Xm')
      await page.getByTestId('about-close').click()
      await expect(page.getByTestId('about-modal')).toBeHidden()
      await expect(page.getByTestId('whats-new-dot')).toBeHidden()
    })
  })

  test('LBY-26: the bell shows unseen releases, opens player notes and clears the badge', async ({ page }) => {
    await withFakeServer(lobbyScenario, async () => {
      const body = [
        '## Download: pick ONE file, the one for your system',
        '| Your system | File |',
        '| --- | --- |',
        '| Windows | `XMage Nexus_9.9_x64-setup.exe` |',
        '',
        '<details><summary>What changed in v9.9</summary>',
        '',
        "## What's new in 9.9",
        '',
        '**New board view**',
        '- One board fills the main area.',
        '',
        '**Under the hood**',
        '- Proxy session lifecycle.',
        '',
        '</details>',
      ].join('\n')
      await page.route('https://api.github.com/repos/Adamychen/xmage-nexus/releases*', (route) =>
        route.fulfill({ json: [
          { tag_name: 'v9.9', name: 'v9.9', body, html_url: 'https://github.com/n', published_at: '2026-10-29T09:00:00Z' },
          { tag_name: 'v9.8', name: 'v9.8', body: '- older note', html_url: 'https://github.com/n8', published_at: '2026-10-20T09:00:00Z' },
        ] }),
      )
      await page.route('https://api.github.com/repos/magefree/mage/releases*', (route) =>
        route.fulfill({ json: XMAGE_RELEASES }),
      )
      await page.addInitScript(() => {
        window.localStorage.clear()
      })
      await login(page, 'whatsnew-e2e')
      await expect(page.getByTestId('whats-new-dot')).toBeVisible({ timeout: 20000 })
      await page.getByTestId('whats-new-button').click()
      const latest = page.getByTestId('whats-new-latest')
      await expect(latest).toContainText('One board fills the main area.')
      await expect(latest).not.toContainText('setup.exe')
      await expect(latest).not.toContainText('Proxy session lifecycle')
      await expect(page.getByTestId('whats-new-previous')).toContainText('1')
      await expect(page.getByTestId('whats-new-dot')).toBeHidden()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('whats-new-panel')).toBeHidden()
    })
  })

  test('news with GitHub unreachable (desktop CSP / rate limit) fetches once and stays responsive', async ({ page }) => {
    await withFakeServer(lobbyScenario, async () => {
      let githubCalls = 0
      await page.route('https://api.github.com/**', (route) => {
        githubCalls++
        return route.abort()
      })
      await page.addInitScript(() => {
        window.localStorage.clear()
      })
      await login(page, 'about-offline')
      const beforeOpen = githubCalls
      await page.getByTestId('lobby-more-menu').click()
      await page.getByTestId('open-about').click()
      await page.getByTestId('about-tab-news').click()
      await expect(page.getByTestId('about-modal')).toContainText(/offline|sin conexión|GitHub/i, { timeout: 10000 })
      await page.waitForTimeout(3000)
      expect(githubCalls - beforeOpen, 'news must not refetch in a loop when GitHub fails').toBeLessThanOrEqual(2)
      await page.getByTestId('about-close').click()
      await expect(page.getByTestId('about-modal')).toBeHidden()
    })
  })
})
