import { fakeOnly } from './support/fake-mode'
import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'
import { test, expect } from './fixtures'
fakeOnly()
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { spellsScenario } from '../fixtures/scenarios/spells'
import type { Page } from '@playwright/test'

const svg = (w: number, h: number, fill: string, label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${fill}"/>` +
  `<text x="50%" y="50%" font-size="${Math.round(h / 8)}" text-anchor="middle" fill="#000">${label}</text></svg>`

async function stubCardArt(page: Page): Promise<void> {
  await page.route('**/api.scryfall.com/cards/**', (route) =>
    route.fulfill({ json: { name: 'Probe', image_uris: { normal: 'https://cards.scryfall.io/normal/front/p/r/probe.svg' } } }),
  )
  await page.route('**/cards.scryfall.io/normal/**', (route) =>
    route.fulfill({ contentType: 'image/svg+xml', body: svg(488, 680, '#9ecbff', 'FULL CARD') }),
  )
  await page.route('**/cards.scryfall.io/art_crop/**', (route) =>
    route.fulfill({ contentType: 'image/svg+xml', body: svg(626, 457, '#ffb347', 'ART CROP') }),
  )
}

interface Sample {
  w: number
  h: number
  crop: string | null
  cropOpacity: number
}

test('an ability leaving a compact tile flies as its art crop, not the middle of the full card @flights', async ({ page }) => {
  await stubCardArt(page)
  await withFakeServer(
    () => spellsScenario('blaze'),
    async () => {
      const { pageErrors } = await startGame(page, {
        prefix: 'flc',
        tableName: TABLE.spellsBlaze,
        deck: DECK.advanced,
        skipAsks: true,
      })
      await expect(page.locator('.game-board')).toBeVisible({ timeout: 20_000 })
      await page.evaluate(() => (globalThis as any).__mageStore.setSetting('cardStyle', 'compact'))

      const setup = await page.evaluate(() => {
        const s = (globalThis as any).__mageStore.getState()
        const me = s.game.players.find((p: any) => p.controlled)
        return { gameId: s.gameId as string, sourceId: Object.keys(me.battlefield ?? {})[0] ?? null }
      })
      expect(setup.sourceId, 'a permanent on the battlefield').toBeTruthy()
      const tile = page.locator(`.player-zone .card-slot.is-compact[data-card-id="${setup.sourceId}"]`)
      await expect(tile).toBeVisible()
      await expect(tile.locator('img.card-art-crop')).toHaveAttribute('src', /art_crop/)
      await expect.poll(() => page.evaluate(() => (globalThis as any).__mageFlights.active().length)).toBe(0)

      await page.evaluate(() => {
        const w = globalThis as any
        w.__flightSamples = []
        const tick = () => {
          const item = document.querySelector('.flying-card-item:has(img[alt="Ability"])')
          if (item) {
            const r = item.getBoundingClientRect()
            const crop = item.querySelector<HTMLImageElement>('.flying-card-crop')
            w.__flightSamples.push({
              w: r.width,
              h: r.height,
              crop: crop?.getAttribute('src') ?? null,
              cropOpacity: crop ? Number(getComputedStyle(crop).opacity) : 0,
            })
          }
          if (w.__flightSamples.length < 400) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })

      await page.evaluate(({ gameId, sourceId }) => {
        const st = (globalThis as any).__mageStore
        const next = structuredClone(st.getState().game)
        const me = next.players.find((p: any) => p.controlled)
        const source = me.battlefield[sourceId]
        next.stack = {
          ...(next.stack ?? {}),
          'ability-probe': {
            id: 'ability-probe',
            name: 'Ability',
            mageObjectType: 'ABILITY',
            cardTypes: [],
            rules: ['{T}: Probe ability.'],
            controllerId: me.playerId,
            controllerName: me.name,
            sourceCard: { ...source, id: sourceId },
          },
        }
        st.handleMessage({ type: 'event', method: 'GAME_UPDATE', messageId: Date.now(), objectId: gameId, data: { gameView: next } })
      }, setup)

      await expect.poll(() => page.evaluate(() => (globalThis as any).__flightSamples.length), { timeout: 3_000 }).toBeGreaterThan(3)
      await page.screenshot({ path: test.info().outputPath('compact-ability-flight.png') })
      await page.waitForTimeout(700)

      const samples: Sample[] = await page.evaluate(() => (globalThis as any).__flightSamples)
      const first = samples[0]
      expect(first.w, 'the clone leaves the tile landscape').toBeGreaterThan(first.h)
      expect(first.crop, 'the clone paints the art crop').toMatch(/art_crop/)
      expect(first.cropOpacity, 'the art crop covers the clone at take-off').toBeGreaterThan(0.9)
      const last = samples[samples.length - 1]
      expect(last.h, 'the clone lands card-shaped on the stack').toBeGreaterThan(last.w)
      expect(last.cropOpacity, 'the full card shows on landing').toBeLessThan(0.1)
      expect(pageErrors).toEqual([])
    },
  )
})
