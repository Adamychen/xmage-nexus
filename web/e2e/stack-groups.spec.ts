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

      // Hover sobre una carta de la pila (tras expandir el grupo): preview clásico, sin morph de mano
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
      await expect(preview, 'las cartas apiladas no usan el morph de la mano').not.toHaveClass(/is-morph/)

      // Click en una carta concreta de la pila: el uuid atraviesa el grupo
      await treasureGroup.hover()
      await treasureGroup.locator('.card-slot').nth(1).click()
      const dialog = page.locator('.feedback-dialog')
      await expect(dialog, 'el click en treasure-2 llega al servidor').toContainText('clicked:treasure-2', { timeout: 10_000 })

      expect(pageErrors).toEqual([])
    })
  })
})
