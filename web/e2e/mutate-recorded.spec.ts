import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { quickStartGame } from './support/start-game'
import { mutatePileOf } from './support/frames'
import { withFakeServer } from './support/fake-backend'
import { replayRecordedScenario } from '../fixtures/scenarios/replay-recorded'
fakeOnly()

const SHOTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots')
const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'recorded')

test.describe('Mutate mechanic (real recorded frame)', { tag: '@mutate-recorded' }, () => {
  test('renders the real mutateView pile captured from a live XMage server', async ({ page }) => {
    fs.mkdirSync(SHOTS_DIR, { recursive: true })

    await withFakeServer(() => replayRecordedScenario('mutate.json', 'Mutate Recorded (real frame)'), async () => {
      const { pageErrors } = await quickStartGame(page, {
        prefix: 'mutr',
      })

      expect(pageErrors).toEqual([])

      // La pila mutada del humano viene del frame REAL: Elvish Mystic + Gemrazer.
      const myPile = page.locator('.player-zone .card-mutate-pile')
      await expect(myPile).toBeVisible()
      await expect(myPile.locator('.mutated-badge')).toBeVisible()
      // Las partes bajo la carta de arriba son las constituyentes del frame real
      // menos el host (el permanente lleva la carta frontal; no se duplica como parte).
      const pile = mutatePileOf((JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'mutate.json'), 'utf8')) as { gameView: Record<string, unknown> }).gameView)
      expect(pile, 'el frame real debe tener una pila mutada').not.toBeNull()
      expect(pile!.under.length, 'debe quedar al menos una carta bajo el host').toBeGreaterThan(0)
      expect(pile!.under).toHaveLength(pile!.cards - 1)
      await expect(myPile.locator('.mutate-part')).toHaveCount(pile!.under.length)
      for (const card of pile!.under) {
        await expect(myPile.locator(`.mutate-part[data-card-name="${card.name}"]`)).toBeVisible()
      }
      await expect(myPile.locator('[data-card-name="Elvish Mystic"]').first()).toBeVisible()

      // No debe renderizarse como grupo de attachments (comportamiento heredado).
      await expect(page.locator('.card-attachment-group')).toHaveCount(0)

      const shot = await page.screenshot({ fullPage: true })
      fs.writeFileSync(path.join(SHOTS_DIR, 'mutate-recorded-01-board.png'), shot)
    })
  })
})
