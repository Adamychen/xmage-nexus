import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from './fixtures'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { replayRecordedScenario } from '../fixtures/scenarios/replay-recorded'

const SHOTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots')

test.describe('Mutate mechanic (real recorded frame)', { tag: '@mutate-recorded' }, () => {
  test('renders the real mutateView pile captured from a live XMage server', async ({ page }) => {
    fs.mkdirSync(SHOTS_DIR, { recursive: true })

    await withFakeServer(() => replayRecordedScenario('mutate.json', 'Mutate Recorded (real frame)'), async () => {
      const { pageErrors } = await startGame(page, {
        prefix: 'mutr',
        tableName: TABLE.mutateRecorded,
        deck: DECK.advanced,
      })

      expect(pageErrors).toEqual([])

      // La pila mutada del humano viene del frame REAL: Elvish Mystic + Gemrazer.
      const myPile = page.locator('.player-zone .card-mutate-pile')
      await expect(myPile).toBeVisible()
      await expect(myPile.locator('.mutated-badge')).toBeVisible()
      // El mutateView real tiene 2 partes constituyentes.
      await expect(myPile.locator('.mutate-part')).toHaveCount(2)
      // La carta de arriba (la que mutó) es Gemrazer; debajo, Elvish Mystic.
      // Se scopea a .mutate-part porque el permanente fusionado también lleva
      // data-card-name="Elvish Mystic" como carta frontal de la pila.
      await expect(myPile.locator('.mutate-part[data-card-name="Gemrazer"]')).toBeVisible()
      await expect(myPile.locator('.mutate-part[data-card-name="Elvish Mystic"]')).toBeVisible()

      // No debe renderizarse como grupo de attachments (comportamiento heredado).
      await expect(page.locator('.card-attachment-group')).toHaveCount(0)

      const shot = await page.screenshot({ fullPage: true })
      fs.writeFileSync(path.join(SHOTS_DIR, 'mutate-recorded-01-board.png'), shot)
    })
  })
})
