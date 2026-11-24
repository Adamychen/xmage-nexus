import { fakeOnly } from './support/fake-mode'
import { test, expect } from './fixtures'
import { combatHumanBlockScenario } from '../fixtures/scenarios/combatHuman'
import { withFakeServer } from './support/fake-backend'
import { quickStartGame } from './support/start-game'

fakeOnly()

const zOf = (page: import('@playwright/test').Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => Number(getComputedStyle(el).zIndex))

test('CMB-5, TGT-10: the game menu (⋯) paints over the dock and over the combat arrows, which stay over the board', { tag: '@combat' }, async ({ page }) => {
  await withFakeServer(() => combatHumanBlockScenario(), async () => {
    await quickStartGame(page, {
      prefix: 'gmo',
      skipCombat: true,
    })

    // 1. La franja de control (que porta el menú ⋯ y el cajón) pinta por encima
    //    del dock: el botón de acción no debe tapar su popup de configuración.
    const dockZ = await zOf(page, '.game-dock')
    const stripZ = await zOf(page, '.board-shell-top-strip.has-strip')
    expect(dockZ, 'el dock queda bajo la franja de control').toBeLessThan(stripZ)

    // 2. TGT-10: las flechas se dibujan sobre la propia chrome del tablero, sin
    //    depender de que haya un cajón abierto (ya no hay cajón de pila).
    const arrowsZ = await zOf(page, '.combat-arrows-overlay')
    expect(arrowsZ, 'las flechas van sobre el tablero').toBeGreaterThan(stripZ)

    // 3. …pero por debajo del menú ⋯: el popup es opaco y las líneas de combate
    //    no lo cruzan.
    await page.getByTestId('game-menu-btn').click()
    await expect(page.locator('.game-menu-panel')).toBeVisible()
    expect(await zOf(page, '.game-menu-panel'), 'el menú va sobre las flechas').toBeGreaterThan(arrowsZ)

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
