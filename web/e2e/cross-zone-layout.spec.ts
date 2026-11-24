import { fakeOnly } from './support/fake-mode'
import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import { crossZoneScenario } from '../fixtures/scenarios/crossZone'
import { quickStartGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { waitCrossZonePlayable } from './support/game-screen'
fakeOnly()

async function openTenCards(page: Page, prefix: string) {
  const { pageErrors } = await quickStartGame(page, { prefix })
  await waitCrossZonePlayable(page, 'Arc Trail', { timeoutMs: 30_000, minUntapped: 0 })
  await page.getByTestId('pile-card-playable').click()
  await expect(page.locator('.cross-zone-overlay')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.cross-zone-entry')).toHaveCount(10)
  await expect(page.locator('.cross-zone-overlay .zone-fan.is-measured')).toHaveCount(1)
  await page.waitForTimeout(300)
  return pageErrors
}

function readFan(page: Page) {
  return page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.cross-zone-entry')).map((e) => {
    const r = e.getBoundingClientRect()
    return {
      name: e.dataset.cardName ?? '',
      shown: !e.classList.contains('is-off-fan') && !e.classList.contains('is-piled'),
      piled: e.classList.contains('is-piled'),
      angle: parseFloat(getComputedStyle(e).rotate) || 0,
      top: r.top,
      left: r.left,
      right: r.right,
      bottom: r.bottom,
    }
  }))
}

test.describe('Zone viewer fan', () => {
  for (const [name, width, height] of [['1600', 1600, 900], ['1280', 1280, 720]] as const) {
    test(`BRD-24: the cards fan out on an arc and the thumb slides them along it at ${name}`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await withFakeServer(() => crossZoneScenario('graveyard-many'), async () => {
        const pageErrors = await openTenCards(page, `cz${name[0]}`)
        const all = await readFan(page)
        const fan = all.filter((c) => c.shown)
        expect(fan.length, 'a window of the row is shown').toBeGreaterThan(2)
        const pile = all.filter((c) => c.piled)
        expect(pile.length, 'the rest gathers in a pile at the right side').toBeGreaterThan(0)
        expect(pile.every((c) => c.left > fan[fan.length - 1].left), 'the pile sits past the last fanned card').toBe(true)
        expect(pile[0].angle - fan[fan.length - 1].angle, 'the pile is tighter than the fan').toBeLessThan(fan[1].angle - fan[0].angle)
        expect(fan.length, 'ten cards do not all fit at once').toBeLessThan(10)
        const steps = fan.slice(1).map((c, i) => c.angle - fan[i].angle)
        for (const step of steps) expect(step, 'each card turns by the same angle').toBeCloseTo(steps[0], 1)
        expect(steps[0], 'the fan opens left to right').toBeGreaterThan(0)
        const middle = fan[Math.floor(fan.length / 2)]
        const centerY = (c: { top: number; bottom: number }) => (c.top + c.bottom) / 2
        expect(centerY(fan[0]), 'the outer cards sit lower on the arc').toBeGreaterThan(centerY(middle))
        expect(centerY(fan[fan.length - 1]), 'the outer cards sit lower on the arc').toBeGreaterThan(centerY(middle))

        const thumb = page.locator('.cross-zone-overlay .zone-fan-thumb')
        await expect(thumb).toBeVisible()
        const box = (await thumb.boundingBox())!
        const track = (await page.locator('.cross-zone-overlay .zone-fan-scrollbar').boundingBox())!
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(track.x + track.width + 20, box.y + box.height / 2, { steps: 8 })
        await page.mouse.up()
        await expect.poll(async () => (await readFan(page)).at(-1)?.shown, { message: 'the last card comes into the fan' }).toBe(true)
        const scrolled = await readFan(page)
        expect(scrolled[0].shown, 'the first card has left the fan').toBe(false)
        expect(scrolled[0].piled, 'the first card waits in the left pile').toBe(true)

        await page.mouse.move(width / 2, middle.top + 40)
        await page.mouse.wheel(0, -2000)
        await expect.poll(async () => (await readFan(page))[0].shown, { message: 'the wheel slides back to the first card' }).toBe(true)

        const onPile = await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll<HTMLElement>('.cross-zone-entry.is-piled'))
          const r = items[items.length - 1].getBoundingClientRect()
          const y = (r.top + r.bottom) / 2
          for (let x = r.right; x > r.left; x -= 2) {
            if (document.elementFromPoint(x, y)?.closest('.is-piled')) return { x, y }
          }
          return null
        })
        expect(onPile, 'part of the pile shows past the fan').not.toBeNull()
        await page.mouse.click(onPile!.x, onPile!.y)
        await expect.poll(async () => (await readFan(page))[0].piled, { message: 'clicking the pile slides the fan one card toward it' }).toBe(true)
        await expect(page.locator('.cross-zone-overlay'), 'a card in the pile is not played').toBeVisible()
        expect(pageErrors).toEqual([])
      })
    })
  }

  test('BRD-24: sweeping the pointer along the fan lifts every shown card in order, skipping none', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await withFakeServer(() => crossZoneScenario('graveyard-many'), async () => {
      const pageErrors = await openTenCards(page, 'czs')
      const fan = (await readFan(page)).filter((c) => c.shown)
      const middle = fan[Math.floor(fan.length / 2)]
      const y = middle.top + (middle.bottom - middle.top) * 0.6
      const seen: string[] = []
      for (let x = fan[0].left + 10; x <= fan[fan.length - 1].right - 10; x += 8) {
        await page.mouse.move(x, y)
        const lifted = await page.evaluate(() => document.querySelector<HTMLElement>('.cross-zone-entry.is-lifted')?.dataset.cardName ?? null)
        if (lifted && seen[seen.length - 1] !== lifted) seen.push(lifted)
      }
      expect(seen, 'each card lifts once, in fan order').toEqual(fan.map((c) => c.name))
      await page.mouse.move((middle.left + middle.right) / 2, y)
      await expect(page.locator('.zone-fan-lift')).toHaveCount(1)
      await page.mouse.move(5, 5)
      await expect(page.locator('.zone-fan-lift')).toHaveCount(0)
      expect(pageErrors).toEqual([])
    })
  })
})
