import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from './fixtures'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { mutateScenario } from '../fixtures/scenarios/mutate'

const SHOTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots')

test.describe('Mutate mechanic (protocol-faithful)', { tag: '@mutate' }, () => {
  test('renders the mutated pile, badge, and activates its ability via GAME_CHOOSE_ABILITY', async ({ page }) => {
    fs.mkdirSync(SHOTS_DIR, { recursive: true })

    await withFakeServer(mutateScenario, async () => {
      const { pageErrors } = await startGame(page, {
        prefix: 'mut',
        tableName: 'Mutate Showcase',
        deck: 'Mage Web advanced',
      })

      expect(pageErrors).toEqual([])

      // 1. Mutated creature on the human side: pile + badge + 2 constituent parts
      const myPile = page.locator('.player-zone .card-mutate-pile')
      await expect(myPile).toBeVisible()
      await expect(myPile.locator('.mutated-badge')).toBeVisible()
      await expect(myPile.locator('.mutate-part')).toHaveCount(2)
      await expect(myPile.locator('[data-card-name="Sea-Dasher Octopus"]')).toBeVisible()
      await expect(myPile.locator('[data-card-name="Gemrazer"]')).toBeVisible()
      await expect(myPile.locator('[data-card-name="Pouncing Shoreshark"]')).toBeVisible()

      // 2. Opponent mutated creature also renders as a pile (no attachment group)
      const oppPile = page.locator('.opponent-zone .card-mutate-pile')
      await expect(oppPile).toBeVisible()
      await expect(oppPile.locator('.mutate-part')).toHaveCount(1)
      await expect(page.locator('.card-attachment-group')).toHaveCount(0)

      const fullShot = await page.screenshot({ fullPage: true })
      fs.writeFileSync(path.join(SHOTS_DIR, 'mutate-01-board.png'), fullShot)

      // 3. Click the mutated creature → GAME_CHOOSE_ABILITY (ability activation)
      await myPile.locator('[data-card-id="mutcreature"]').click()
      const dialog = page.locator('.feedback-dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog).toContainText('Habilidad de Mutar')
      await dialog.locator('text=Habilidad de Mutar').click()
      await expect(dialog).toHaveCount(0)

      const finalShot = await page.screenshot({ fullPage: true })
      fs.writeFileSync(path.join(SHOTS_DIR, 'mutate-02-ability-activated.png'), finalShot)
    })
  })
})
