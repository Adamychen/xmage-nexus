import { test, expect } from './fixtures'
import { cleanupUser } from './cleanup'
import { login } from './support/start-game'
import { FakeServer } from '../fixtures/fake'
import { finishedMatchesScenario } from '../fixtures/scenarios/finishedMatches'
import { FAKE_MODE } from './dual'
import { getFakePort, setFakePort } from './support/fake-port'

// Regresión 2026-09-14: el panel del Historial desbordaba el `.lobby-main`
// (overflow:hidden) y la lista no se podía desplazar.

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
