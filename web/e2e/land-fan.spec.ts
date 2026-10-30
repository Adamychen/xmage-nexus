import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { quickStartGame } from './support/start-game'
import { landFanScenario } from '../fixtures/scenarios/landFan'
fakeOnly()

const ARENA = { gameUi: 'v2', boardLayout: 'arena', boardLayoutManual: true }
const ZONE = '.player-zone:not(.mirrored)'

test.describe('Land piles fan out beside the lands they sit on', () => {
  test('BRD-23: a land pile at the band edge fans to the right and never covers the tapped lands before it @fullflow', async ({ page }) => {
    await withFakeServer(landFanScenario, async () => {
      const { pageErrors } = await quickStartGame(page, { prefix: 'lf' })
      const myZone = page.locator(ZONE)
      await expect(myZone).toBeVisible({ timeout: 30_000 })
      await page.evaluate((settings) => {
        const store = (globalThis as any).__mageStore
        for (const [key, value] of Object.entries(settings)) store.setSetting(key, value)
      }, ARENA)

      const band = myZone.locator('[data-testid="lands-band"]')
      await expect(band).toBeVisible({ timeout: 10_000 })
      const forest = band.locator('.stack-group[data-stack-name="Forest"]')
      await expect(forest).toHaveCount(1)
      expect(await forest.getAttribute('data-count')).toBe('5')
      await expect(band.locator('.stack-group[data-stack-name="Island"] .card-slot.tapped')).toHaveCount(3)

      const edge = await page.evaluate((zone) => {
        const z = document.querySelector(zone)!
        const bandRect = z.querySelector('[data-testid="lands-band"]')!.getBoundingClientRect()
        const pileRect = z.querySelector('.stack-group[data-stack-name="Forest"]')!.getBoundingClientRect()
        const cardW = z.querySelector('.stack-group[data-stack-name="Forest"] .card-slot')!.getBoundingClientRect().width
        return { gapToBandRight: bandRect.right - pileRect.right, cardW }
      }, ZONE)
      expect(edge.gapToBandRight, 'the forest pile sits within one card of the lands band right edge').toBeLessThan(edge.cardW)

      await page.mouse.move(2, 2)
      await page.waitForTimeout(300)
      await forest.hover()
      await expect(forest).toHaveAttribute('data-spread', '', { timeout: 2_000 })
      await page.waitForTimeout(700)

      const overlaps = await page.evaluate((zone) => {
        const z = document.querySelector(zone)!
        const islands = Array.from(z.querySelectorAll<HTMLElement>('.stack-group[data-stack-name="Island"] .card-slot.tapped'))
        const fanned = Array.from(z.querySelectorAll<HTMLElement>('.stack-group[data-stack-name="Forest"] .card-slot'))
        const fannedRects = fanned.map((el) => el.getBoundingClientRect())
        return islands.map((el, i) => {
          const r = el.getBoundingClientRect()
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) as HTMLElement | null
          return {
            i,
            hitIsland: hit?.closest('.stack-group[data-stack-name="Island"]') != null,
            hitForest: hit?.closest('.stack-group[data-stack-name="Forest"]') != null,
            cardOverlap: fannedRects.some((f) => f.left < r.right - 1 && f.right > r.left + 1 && f.top < r.bottom - 1 && f.bottom > r.top + 1),
          }
        })
      }, ZONE)

      expect(overlaps.length, 'the tapped islands are on the board').toBe(3)
      for (const o of overlaps) {
        expect(o.cardOverlap, `tapped island ${o.i}: no fanned forest card covers it`).toBe(false)
        expect(o.hitForest, `tapped island ${o.i}: the fanned forest pile does not cover it`).toBe(false)
        expect(o.hitIsland, `tapped island ${o.i}: it is the element under its own centre`).toBe(true)
      }
      expect(pageErrors).toEqual([])
    })
  })
})
