import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { quickStartGame } from './support/start-game'
import { manaStackScenario } from '../fixtures/scenarios/manaStack'
fakeOnly()

test.describe('Mana permanents next to a land pile', () => {
  test('the mana rocks beside a fanned land pile are pushed aside and every land stays clickable @stack-groups', async ({ page }) => {
    await withFakeServer(manaStackScenario, async () => {
      const { pageErrors } = await quickStartGame(page, { prefix: 'ms' })
      const myZone = page.locator('.player-zone:not(.mirrored)')
      const pile = myZone.locator('.stack-group[data-stack-name="Plains"]')
      await expect(pile).toHaveCount(1, { timeout: 30_000 })
      await page.mouse.move(2, 2)
      await pile.hover()
      await expect(pile).toHaveAttribute('data-spread', '')
      await pile.evaluate((el) =>
        Promise.all(el.parentElement!.getAnimations({ subtree: true }).filter((a) => a instanceof CSSTransition).map((a) => a.finished.catch(() => undefined))),
      )

      await expect(pile.locator('.card-slot')).toHaveCount(3)
      for (const name of ['Sol Ring', 'Arcane Signet']) {
        const rock = myZone.locator('.bz-band > .card-slot', { hasText: name })
        const box = (await rock.boundingBox())!
        const x = box.x + box.width / 2
        const y = box.y + box.height / 2
        const topId = await page.evaluate(([px, py]) => {
          const el = document.elementFromPoint(px, py)
          return el?.closest('.card-slot')?.getAttribute('data-card-id') ?? null
        }, [x, y])
        expect(topId, `${name} is the topmost card under its own centre`).toBe(await rock.getAttribute('data-card-id'))
      }

      const lands = pile.locator('.card-slot')
      const landIds = await lands.evaluateAll((els) => els.map((e) => e.getAttribute('data-card-id')))
      for (const [i, id] of landIds.entries()) {
        const box = (await lands.nth(i).boundingBox())!
        const hit = await page.evaluate(
          ([px, py]) => document.elementFromPoint(px, py)?.closest('.card-slot')?.getAttribute('data-card-id') ?? null,
          [box.x + box.width / 2, box.y + box.height / 2],
        )
        expect(hit, `${id} is topmost under its own centre while the pile is fanned`).toBe(id)
      }
      await myZone.locator('.bz-band > .card-slot', { hasText: 'Sol Ring' }).hover()
      await expect(pile).not.toHaveAttribute('data-spread')
      expect(pageErrors).toEqual([])
    })
  })
})

test.describe('Tapping a land moves it between piles', () => {
  test('the card slides from its old place instead of jumping @stack-groups', async ({ page }) => {
    await withFakeServer(manaStackScenario, async () => {
      const { pageErrors } = await quickStartGame(page, { prefix: 'mf' })
      const myZone = page.locator('.player-zone:not(.mirrored)')
      await expect(myZone.locator('[data-card-id="plains-5"]')).toBeVisible({ timeout: 30_000 })
      await page.evaluate(() => {
        const calls: { id: string | null; from: string; to: string }[] = []
        ;(window as unknown as { __flip: typeof calls }).__flip = calls
        const original = Element.prototype.animate
        Element.prototype.animate = function (keyframes: Keyframe[] | PropertyIndexedKeyframes | null, options?: number | KeyframeAnimationOptions) {
          const frames = keyframes as Keyframe[]
          if (Array.isArray(frames) && frames[0]?.translate !== undefined) {
            calls.push({ id: this.getAttribute('data-card-id'), from: String(frames[0].translate), to: String(frames[1]?.translate) })
          }
          return original.call(this, keyframes as Keyframe[], options)
        }
      })
      await myZone.locator('[data-card-id="plains-5"]').click()
      await expect(myZone.locator('[data-card-id="plains-5"]')).toHaveClass(/tapped/)
      const calls = await page.evaluate(() => (window as unknown as { __flip: { id: string; from: string; to: string }[] }).__flip)
      const mine = calls.find((c) => c.id === 'plains-5')
      expect(mine, 'the tapped land is animated').toBeTruthy()
      expect(mine!.from, 'it starts away from its destination').not.toBe('0px 0px')
      expect(mine!.to).toBe('0px 0px')
      expect(pageErrors).toEqual([])
    })
  })
})
