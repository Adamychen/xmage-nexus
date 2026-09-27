import { TABLE } from '../fixtures/table-names'
import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { startGame } from './support/start-game'
import { tokensScenario } from '../fixtures/scenarios/tokens'
fakeOnly()

test.describe('Apilado visual de tokens (×3)', () => {
  test('tokens fungibles se apilan desde ×3 y el click atraviesa la pila @fullflow @stack-groups', async ({ page }) => {
    await withFakeServer(tokensScenario, async () => {
      const { pageErrors } = await startGame(page, {
        prefix: 'sg',
        tableName: TABLE.tokens,
      })

      const myZone = page.locator('.player-zone:not(.mirrored)')
      await expect(myZone).toBeVisible({ timeout: 30_000 })

      // 4 Treasure enderezados → una pila ×4
      const treasureGroup = myZone.locator('.stack-group[data-stack-name="Treasure"]')
      await expect(treasureGroup).toHaveCount(1)
      expect(await treasureGroup.getAttribute('data-count')).toBe('4')
      await expect(treasureGroup.locator('.stack-group-badge')).toContainText('×4')
      expect(await treasureGroup.locator('.card-slot').count()).toBe(4)

      // 3 Soldier 1/1 → una pila ×3
      const soldierGroup = myZone.locator('.stack-group[data-stack-name="Soldier"]')
      await expect(soldierGroup).toHaveCount(1)
      expect(await soldierGroup.getAttribute('data-count')).toBe('3')

      // Sueltos: 2 Treasure girados (bajo el umbral) + Soldier con contador + Grizzly Bears
      expect(await myZone.locator('.bz-band > .card-slot').count()).toBe(4)

      // Hover sobre una carta de la pila (tras expandir el grupo): preview flotante clásico
      const preview = page.locator('.floating-card-preview')
      await expect(preview).toHaveCount(0)
      await treasureGroup.hover()
      await treasureGroup.locator('.card-slot').first().hover()
      await expect(preview).toBeVisible({ timeout: 10_000 })
      const previewImg = preview.locator('img.floating-card-img')
      if ((await previewImg.count()) > 0) {
        await expect(previewImg).toHaveAttribute('alt', 'Treasure')
      } else {
        await expect(preview.locator('.floating-card-name')).toContainText('Treasure')
      }

      // Click en una carta concreta de la pila: el uuid atraviesa el grupo
      await treasureGroup.hover()
      await treasureGroup.locator('.card-slot').nth(1).click()
      const dialog = page.locator('.feedback-dialog')
      await expect(dialog, 'el click en treasure-2 llega al servidor').toContainText('clicked:treasure-2', { timeout: 10_000 })

      expect(pageErrors).toEqual([])
    })
  })

  test('compact piles fan out as an overlay: no reflow and no hover flicker at the edge @stack-groups', async ({ page }) => {
    await withFakeServer(tokensScenario, async () => {
      const { pageErrors } = await startGame(page, { prefix: 'sge', tableName: TABLE.tokens })
      const myZone = page.locator('.player-zone:not(.mirrored)')
      await expect(myZone).toBeVisible({ timeout: 30_000 })
      await page.evaluate(() => (globalThis as any).__mageStore.setSetting('cardStyle', 'compact'))
      await expect(myZone.locator('.stack-group .card-slot.is-compact').first()).toBeVisible()

      const sel = '.player-zone:not(.mirrored) .stack-group[data-stack-name="Treasure"]'
      const group = page.locator(sel)
      await page.mouse.move(2, 2)
      await page.waitForTimeout(400)
      const box = (await group.boundingBox())!
      await page.mouse.move(box.x + box.width - 2, box.y + 4)

      const samples = await page.evaluate(async (s) => {
        const g = document.querySelector(s) as HTMLElement
        const band = g.parentElement!
        const out: { spread: boolean; hover: boolean; width: number; layout: string }[] = []
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 33))
          out.push({
            spread: g.hasAttribute('data-spread'),
            hover: g.matches(':hover'),
            width: g.offsetWidth,
            layout: Array.from(band.children).map((c) => (c as HTMLElement).offsetLeft).join(','),
          })
        }
        return out
      }, sel)

      expect(samples.every((x) => x.spread && x.hover), 'the pile stays spread under a still pointer').toBe(true)
      expect(new Set(samples.map((x) => x.width)).size, 'the pile keeps its collapsed footprint').toBe(1)
      expect(new Set(samples.map((x) => x.layout)).size, 'nothing else in the band moves').toBe(1)
      expect(Math.round(samples[0].width)).toBe(Math.round(box.width))

      const lefts = await group.locator('.card-slot').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().left))
      for (let i = 1; i < lefts.length; i++) expect(lefts[i]).toBeGreaterThan(lefts[i - 1] + 20)

      await page.mouse.move(2, 2)
      await expect(group).not.toHaveAttribute('data-spread')
      expect(pageErrors).toEqual([])
    })
  })
})
