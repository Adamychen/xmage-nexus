import { DECK } from '../fixtures/deck-names'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from './fixtures'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { replayRecordedScenario, REPLAY_TABLE_NAME } from '../fixtures/scenarios/replay-recorded'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'recorded', 'manifest.json'), 'utf8'),
) as Array<{ file: string; mechanic: string; assert: string }>

// Smoke test anti-deriva: cada frame real grabado se reemite en el FakeServer y
// el web debe pintarlo sin errores. No depende del servidor real ni de beta.
test.describe('Recorded real frames (anti-drift smoke)', { tag: '@recorded' }, () => {
  for (const entry of manifest) {
    test(`${entry.mechanic} (${entry.file}) renderiza sin errores`, async ({ page }) => {
      await withFakeServer(() => replayRecordedScenario(entry.file), async () => {
        const { pageErrors } = await startGame(page, {
          prefix: `rec-${entry.mechanic}`,
          tableName: REPLAY_TABLE_NAME,
          deck: DECK.advanced,
        })

        expect(pageErrors).toEqual([])

        // El tablero pinta al menos una carta del humano.
        const myCard = page.locator('.player-zone .card-slot').first()
        await expect(myCard).toBeVisible()

        // Sin grupos de attachment heredados (el render de mutate/pila es distinto).
        await expect(page.locator('.card-attachment-group')).toHaveCount(0)

        if (entry.assert === 'hasMutatedPermanent') {
          await expect(page.locator('.player-zone .card-mutate-pile')).toBeVisible()
          await expect(page.locator('.player-zone .card-mutate-pile .mutate-part')).toHaveCount(2)
        }
        if (entry.assert === 'hasNonMutatedCreature') {
          await expect(page.locator('.player-zone .card-slot[data-card-name="Elvish Mystic"]')).toBeVisible()
        }
      })
    })
  }
})
