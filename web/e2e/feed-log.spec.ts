import type { Locator } from '@playwright/test'
import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { quickStartGame } from './support/start-game'
import { openDrawerTab } from './support/game-screen'
import { FEED_BURST_LINES, FEED_EMIT_PREFIX, feedLogScenario } from '../fixtures/scenarios/feedLog'

fakeOnly()

const CLOCK = /^(\d{1,2}):(\d{2}):(\d{2})$/

function secondsOfDay(ms: number): number {
  const d = new Date(ms)
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()
}

function clockSeconds(text: string): number {
  const m = CLOCK.exec(text.trim())
  if (!m) throw new Error(`not an HH:MM:SS clock: "${text}"`)
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

function distanceFromBottom(feed: Locator): Promise<number> {
  return feed.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)
}

test.describe('Log de partida: horas y auto-scroll', { tag: '@feed' }, () => {
  test('cada entrada lleva su hora de llegada y el feed sigue la última línea solo mientras estás al fondo', async ({ page }) => {
    await withFakeServer(feedLogScenario, async () => {
      const t0 = Date.now()
      const { pageErrors, helper } = await quickStartGame(page, {
        prefix: 'flog',
      })
      const emit = async (text: string) => {
        expect(await helper.raw('sendChatMessage', { chatId: 'log-feed', text: `${FEED_EMIT_PREFIX}${text}` })).toBe(true)
      }

      await openDrawerTab(page, 'log')
      const feed = page.locator('.action-feed-list')
      await expect(feed).toContainText(`Log line ${FEED_BURST_LINES}`, { timeout: 15_000 })
      const t1 = Date.now()

      const stamps = await feed.locator('.action-time').allTextContents()
      expect(stamps.length).toBeGreaterThanOrEqual(FEED_BURST_LINES)
      for (const stamp of stamps) {
        const sec = clockSeconds(stamp)
        expect(sec, `"${stamp}" está fuera de la ventana de la prueba`).toBeGreaterThanOrEqual(secondsOfDay(t0))
        expect(sec, `"${stamp}" está fuera de la ventana de la prueba`).toBeLessThanOrEqual(secondsOfDay(t1))
      }

      expect(await feed.evaluate((el) => el.scrollHeight > el.clientHeight), 'el burst debe desbordar el feed').toBe(true)
      await expect.poll(() => distanceFromBottom(feed)).toBeLessThan(2)

      await emit('pinned line')
      await expect(feed).toContainText('pinned line')
      await expect.poll(() => distanceFromBottom(feed)).toBeLessThan(2)

      await feed.evaluate((el) => { el.scrollTop = 0 })
      await expect.poll(() => distanceFromBottom(feed)).toBeGreaterThan(40)
      await emit('unpinned line')
      await expect(feed).toContainText('unpinned line')
      expect(await feed.evaluate((el) => el.scrollTop), 'leer arriba no debe arrastrarte al fondo').toBe(0)

      await feed.evaluate((el) => { el.scrollTop = el.scrollHeight })
      await expect.poll(() => distanceFromBottom(feed)).toBeLessThan(2)
      await emit('repinned line')
      await expect(feed).toContainText('repinned line')
      await expect.poll(() => distanceFromBottom(feed)).toBeLessThan(2)

      expect(pageErrors).toEqual([])
    })
  })
})
