import { test, expect } from './fixtures'
import { cleanupUser } from './cleanup'
import { login } from './support/start-game'
import { FakeServer } from '../fixtures/fake'
import { finishedMatchesScenario } from '../fixtures/scenarios/finishedMatches'
import { FAKE_MODE } from './dual'
import { getFakePort, setFakePort } from './support/fake-port'

// 2026-09-14 regression: the History panel overflowed `.lobby-main`
// (overflow:hidden) and the list could not be scrolled.

const historyTest = test.extend<{ historyServer: FakeServer | null }>({
  historyServer: [
    async ({}, use) => {
      if (!FAKE_MODE) {
        await use(null)
        return
      }
      const server = await FakeServer.start(0, () => finishedMatchesScenario())
      const previousPort = getFakePort()
      setFakePort(server.port)
      try {
        await use(server)
      } finally {
        try {
          await server.stop()
        } finally {
          setFakePort(previousPort)
        }
      }
    },
    { scope: 'test' },
  ],
})

historyTest(
  'historial: la lista de partidas terminadas se desplaza hasta la última',
  { tag: '@history' },
  async ({ page, historyServer }) => {
    void historyServer
    const username = `hist-${String(Date.now()).slice(-9)}`
    cleanupUser(username)

    await login(page, username)
    await page.getByRole('button', { name: /^Historial$/ }).click()

    const list = page.locator('.finished-matches-list')
    await expect(list).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.match-card')).toHaveCount(14)

    if (FAKE_MODE) {
      const multiCard = page.locator('.match-card', { has: page.locator('.match-scoreboard.is-multi') })
      await expect(multiCard).toHaveCount(1)
      await expect(multiCard.locator('.player-slot')).toHaveCount(4)
      for (const name of ['Ari', 'Bea', 'Cid', 'Dora']) {
        await expect(multiCard.getByText(name)).toBeVisible()
      }
    }

    const metrics = await list.evaluate((el) => ({
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
      overflowY: getComputedStyle(el).overflowY,
    }))
    expect(metrics.overflowY).toBe('auto')
    expect(metrics.scrollH).toBeGreaterThan(metrics.clientH)

    await list.evaluate((el) => { el.scrollTop = el.scrollHeight })
    const scrollTop = await list.evaluate((el) => el.scrollTop)
    expect(scrollTop).toBeGreaterThan(0)
    await expect(page.locator('.match-card').last()).toBeVisible()
  },
)

historyTest(
  'historial: source tabs and replay button share the content column and keyboard focus has no ring',
  { tag: '@history' },
  async ({ page, historyServer }) => {
    void historyServer
    const username = `hist-${String(Date.now()).slice(-9)}`
    cleanupUser(username)

    await login(page, username)
    await page.getByRole('button', { name: /^Historial$/ }).click()
    await expect(page.locator('.finished-matches-list')).toBeVisible({ timeout: 10_000 })

    const panel = await page.locator('.finished-matches-panel').boundingBox()
    const toolbar = await page.locator('.matches-toolbar').boundingBox()
    const replay = await page.getByTestId('replay-open').boundingBox()
    expect(panel && toolbar && replay).toBeTruthy()
    expect(Math.abs(toolbar!.x - panel!.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(toolbar!.x + toolbar!.width - (panel!.x + panel!.width))).toBeLessThanOrEqual(1)
    expect(replay!.x + replay!.width).toBeLessThanOrEqual(panel!.x + panel!.width + 1)

    await page.getByRole('tab', { name: 'Partidas del servidor' }).focus()
    await page.keyboard.press('ArrowRight')
    const statsTab = page.getByRole('tab', { name: 'Mis estadísticas' })
    await expect(statsTab).toBeFocused()
    const boxShadow = await statsTab.evaluate((el) => getComputedStyle(el).boxShadow)
    expect(boxShadow).toBe('none')
  },
)
