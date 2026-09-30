import { fakeOnly } from './support/fake-mode'
import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'
import { test, expect } from './fixtures'
import { combatHumanBlockScenario } from '../fixtures/scenarios/combatHuman'
import { withFakeServer } from './support/fake-backend'
import { startGame } from './support/start-game'

fakeOnly()

const zOf = (page: import('@playwright/test').Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => Number(getComputedStyle(el).zIndex))

test('el menú de partida (⋯) manda sobre el dock y las flechas ceden con él abierto', { tag: '@combat' }, async ({ page }) => {
  await withFakeServer(() => combatHumanBlockScenario(), async () => {
    await startGame(page, {
      prefix: 'gmo',
      tableName: TABLE.combatHumanBlock,
      deck: DECK.combatHuman,
      simDeck: DECK.blockSim,
      skipCombat: true,
    })

    // 1. La franja de control (que porta el menú ⋯ y el cajón) pinta por encima
    //    del dock: el botón de acción no debe tapar su popup de configuración.
    const dockZ = await zOf(page, '.game-dock')
    const stripZ = await zOf(page, '.board-shell-divider.has-strip')
    expect(dockZ, 'el dock queda bajo la franja de control').toBeLessThan(stripZ)

    // 2. Con el cajón de pila abierto las flechas suben sobre el tablero…
    await page.locator('.drawer-toggles button').first().click()
    await expect(page.locator('.game-drawer[data-tab="stack"]')).toBeVisible()
    expect(await zOf(page, '.combat-arrows-overlay')).toBe(45)

    // 3. …pero ceden mientras el menú ⋯ está abierto: el popup es opaco y las
    //    líneas de combate no lo cruzan.
    await page.getByTestId('game-menu-btn').click()
    await expect(page.locator('.game-menu-panel')).toBeVisible()
    expect(await zOf(page, '.combat-arrows-overlay')).toBe(28)

    // 4. La prueba de pintado real: donde el panel solapa el dock, el punto
    //    pertenece al panel (si la geometría los solapa en este viewport).
    const overlapped = await page.evaluate(() => {
      const panel = document.querySelector('.game-menu-panel') as HTMLElement | null
      const pill = document.querySelector('.big-action-btn') as HTMLElement | null
      if (!panel || !pill) return null
      const a = panel.getBoundingClientRect()
      const b = pill.getBoundingClientRect()
      const x = Math.max(a.left, b.left) + 10
      const y = Math.min(a.bottom, b.bottom) - 10
      if (x >= Math.min(a.right, b.right) || y <= Math.max(a.top, b.top)) return null
      const hit = document.elementFromPoint(x, y)
      return hit ? panel.contains(hit) || hit === panel : false
    })
    if (overlapped !== null) expect(overlapped, 'el panel gana el solape con el dock').toBe(true)
  })
})
