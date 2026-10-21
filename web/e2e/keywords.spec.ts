import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { quickStartGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { dismissInfoWindows } from './support/info-windows'
import { mechanicsScenario } from '../fixtures/scenarios/mechanics'
fakeOnly()

test.describe('Keyword badges & hover', { tag: '@keywords' }, () => {
  test('renders keyword badges on card and hover shows keyword boxes', async ({ page }) => {
    await withFakeServer(mechanicsScenario, async () => {
      const { pageErrors } = await quickStartGame(page, {
        prefix: 'kw',
      })
      expect(pageErrors).toEqual([])
      // the scenario reveals a card, which latches its viewer open over the board
      await dismissInfoWindows(page)

      const beast = page.locator('[data-card-name="Keyword Beast"]').first()
      await expect(beast).toBeVisible()
      const badges = beast.locator('.keyword-badges .keyword-badge')
      await expect(badges.first()).toBeVisible()
      expect(await badges.count()).toBeGreaterThanOrEqual(2)

      const goadIcon = beast.locator('.card-icon.restriction')
      await expect(goadIcon).toBeVisible()

      const monoBadge = beast.locator('.designation-badge.is-monstrous')
      await expect(monoBadge).toBeVisible()
      expect(await monoBadge.getAttribute('aria-label')).toContain('Monstruosidad')

      const suspectBadge = beast.locator('.designation-badge.is-suspected')
      await expect(suspectBadge).toBeVisible()

      const pairBadge = beast.locator('.designation-badge.is-paired')
      await expect(pairBadge).toBeVisible()
      expect(await pairBadge.getAttribute('aria-label')).toContain("Consul's Lieutenant")

      const bard = page.locator('[data-card-name="Bard Class"]').first()
      await expect(bard).toBeVisible()
      const classBadge = bard.locator('.designation-badge.is-classlevel')
      await expect(classBadge).toBeVisible()
      expect(await classBadge.textContent()).toContain('2')

      const reno = page.locator('[data-card-name="Consul\'s Lieutenant"]').first()
      await expect(reno).toBeVisible()
      const renoBadge = reno.locator('.designation-badge.is-renowned')
      await expect(renoBadge).toBeVisible()
      expect(await renoBadge.getAttribute('aria-label')).toContain('Renombre')

      await beast.hover()
      const kwBox = page.locator('.floating-card-keywords')
      await expect(kwBox).toBeVisible({ timeout: 3000 })
      await expect(kwBox).toContainText('Volar')
      await expect(kwBox).toContainText('Toque mortal')
    })
  })
  for (const size of [{ width: 1600, height: 900 }, { width: 760, height: 520 }]) {
    test(`keyword badge row stays inside its card at ${size.width}px`, async ({ page }) => {
      await page.setViewportSize(size)
      await withFakeServer(mechanicsScenario, async () => {
        await quickStartGame(page, { prefix: 'kw' })
        await dismissInfoWindows(page)
        const rows = page.locator('.card-slot .keyword-badges')
        await expect(rows.first()).toBeAttached()
        if (size.width >= 1600) await expect(rows.first()).toBeVisible()
        const overflow = await rows.evaluateAll((els) =>
          els.filter((row) => getComputedStyle(row).visibility !== 'hidden').filter((row) => {
            const card = row.closest('.card-slot')!.getBoundingClientRect()
            const r = row.getBoundingClientRect()
            const kids = [...row.children].map((c) => c.getBoundingClientRect())
            const sticksOut = kids.some((k) => k.right > r.right + 0.5 || k.left < r.left - 0.5)
            return sticksOut || r.right > card.right + 0.5 || r.left < card.left - 0.5
          }).length,
        )
        expect(overflow).toBe(0)
      })
    })
  }
  for (const size of [{ width: 1600, height: 900 }, { width: 760, height: 520 }]) {
    test(`no two badge zones overlap on any card at ${size.width}px`, async ({ page }) => {
      await page.setViewportSize(size)
      await withFakeServer(mechanicsScenario, async () => {
        await quickStartGame(page, { prefix: 'kw' })
        await dismissInfoWindows(page)
        await expect(page.locator('.card-slot [data-badge-zone]').first()).toBeVisible()
        await page.waitForTimeout(400)
        const report = await page.evaluate(() => {
          const boxOf = (el: Element) => {
            const kids = el instanceof HTMLElement && el.dataset.badgeZone === 'keyword' ? [...el.children] : []
            const rects = (kids.length ? kids : [el]).map((k) => k.getBoundingClientRect())
            return {
              left: Math.min(...rects.map((r) => r.left)),
              right: Math.max(...rects.map((r) => r.right)),
              top: Math.min(...rects.map((r) => r.top)),
              bottom: Math.max(...rects.map((r) => r.bottom)),
            }
          }
          const hits: string[] = []
          let crowded = 0
          for (const slot of document.querySelectorAll('.card-slot')) {
            const zones = [...slot.querySelectorAll('[data-badge-zone]')].filter((z) => z.closest('.card-slot') === slot && getComputedStyle(z).visibility !== 'hidden')
            if (zones.length < 2) continue
            crowded += 1
            const boxes = zones.map((z) => ({ name: (z as HTMLElement).dataset.badgeZone, ...boxOf(z) }))
            for (let i = 0; i < boxes.length; i++) {
              for (let j = i + 1; j < boxes.length; j++) {
                const a = boxes[i]
                const b = boxes[j]
                const x = Math.min(a.right, b.right) - Math.max(a.left, b.left)
                const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
                if (x > 0.5 && y > 0.5) hits.push(`${slot.getAttribute('data-card-name')}: ${a.name} x ${b.name}`)
              }
            }
          }
          return { hits, crowded }
        })
        expect(report.crowded).toBeGreaterThan(0)
        expect(report.hits).toEqual([])
      })
    })
  }
})
