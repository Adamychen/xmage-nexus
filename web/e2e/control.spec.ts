import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { startGame } from './support/start-game'
import { parseSent, sentOf } from './support/frames'
import { playableInScene } from './support/scene'
import { TABLE } from '../fixtures/table-names'
import {
  controlScenario,
  CONTROL_BATTLE_ID,
  CONTROL_CREATURE_ID,
  CONTROL_HAND_ID,
  CONTROL_HAND_ID_2,
  CONTROL_HUMAN_HAND_ID,
  CONTROL_SIM_NAME,
} from '../fixtures/scenarios/control'

fakeOnly()

/** Control total del turno ajeno (Mindslaver): con la prioridad en el jugador
 *  controlado (su mano viaja en opponentHands y sus objetos en canPlayObjects)
 *  la UI debe poder pasar, cambiar de mano y clicar sus jugables — todo en su
 *  nombre, como enruta el servidor (GameController.sendMessage). */
test('control del turno ajeno: pasar, mano cambiada y jugables del controlado @control', async ({ page }) => {
  await withFakeServer(controlScenario, async () => {
    const session = await startGame(page, { prefix: 'ctl', tableName: TABLE.control, skipAsks: true })

    // El helper WS no pasa la prioridad del controlado (me.hasPriority=false):
    // la ventana sigue abierta y es la UI la que decide.
    const actionBtn = page.locator('.big-action-btn')
    await expect(actionBtn).toBeEnabled({ timeout: 15_000 })
    await expect(actionBtn).toContainText(CONTROL_SIM_NAME)
    await expect(actionBtn).toContainText(/Controlas el turno de|You control/)

    // Sus objetos jugables llegan a la escena y se pueden clicar (enruta el UUID).
    await expect.poll(() => playableInScene(page, CONTROL_BATTLE_ID)).toBe(true)
    const battle = page.locator(`.opponent-zone [data-card-id="${CONTROL_BATTLE_ID}"]`)
    await battle.click()
    await expect
      .poll(() =>
        parseSent(sentOf(page)).some(
          (f) => f.action === 'sendPlayerUUID' && f.args?.value === CONTROL_BATTLE_ID,
        ),
      )
      .toBe(true)
    await expect(battle).toHaveAttribute('data-tapped', '1')

    // Switch Hands: la barra propia pasa a mostrar la mano del controlado y su
    // click también envía el UUID (el servidor lo enruta al jugador controlado).
    const bar = page.getByTestId('hand-bar')
    await expect(bar.locator(`[data-card-id="${CONTROL_HUMAN_HAND_ID}"]`)).toBeVisible()
    await page.getByTestId('hand-switch-btn').click()
    const simCard = bar.locator(`[data-card-id="${CONTROL_HAND_ID}"]`)
    await expect(simCard).toBeVisible()
    await expect(bar.locator(`[data-card-id="${CONTROL_HUMAN_HAND_ID}"]`)).toHaveCount(0)
    await simCard.click()
    await expect
      .poll(() =>
        parseSent(sentOf(page)).some(
          (f) => f.action === 'sendPlayerUUID' && f.args?.value === CONTROL_HAND_ID,
        ),
      )
      .toBe(true)
    // La carta jugada sale de su mano: la barra sigue mostrando la mano
    // controlada actualizada (y no la mía) mientras el control sigue activo.
    await expect(bar.locator(`[data-card-id="${CONTROL_HAND_ID_2}"]`)).toBeVisible()
    await expect(bar.locator(`[data-card-id="${CONTROL_HUMAN_HAND_ID}"]`)).toHaveCount(0)

    // Volver a la mano propia con el mismo botón.
    await page.getByTestId('hand-switch-btn').click()
    await expect(bar.locator(`[data-card-id="${CONTROL_HUMAN_HAND_ID}"]`)).toBeVisible()

    // Space regression: after clicking the log drawer toggle the button keeps
    // focus; Space must still pass priority and must not re-toggle the drawer.
    await page.getByTestId('drawer-tab-log').click()
    await expect(page.getByTestId('game-drawer')).toHaveAttribute('data-tab', 'log')
    await page.keyboard.press('Space')
    await expect
      .poll(() => parseSent(sentOf(page)).some((f) => f.action === 'sendPlayerBoolean'))
      .toBe(true)
    await expect(page.getByTestId('game-drawer')).toHaveAttribute('data-tab', 'log')

    // Ventana de combate del controlado (GAME_SELECT con possibleAttackers):
    // el botón pasa a confirmar atacantes y sus criaturas son clicables.
    await expect(actionBtn).toContainText(/Confirmar atacantes|Confirm Attackers/)
    await expect(actionBtn).toBeEnabled()
    const creature = page.locator(`.opponent-zone [data-card-id="${CONTROL_CREATURE_ID}"]`)
    await expect(creature).toBeVisible()
    await creature.click()
    await expect
      .poll(() =>
        parseSent(sentOf(page)).some(
          (f) => f.action === 'sendPlayerUUID' && f.args?.value === CONTROL_CREATURE_ID,
        ),
      )
      .toBe(true)

    // Regresión Space: con el foco en la criatura clicada, Space confirma
    // atacantes (atajo global de la región de juego) y no re-activa la carta.
    const booleansBefore = parseSent(sentOf(page)).filter((f) => f.action === 'sendPlayerBoolean').length
    const creatureUuidsBefore = parseSent(sentOf(page)).filter(
      (f) => f.action === 'sendPlayerUUID' && f.args?.value === CONTROL_CREATURE_ID,
    ).length
    await page.keyboard.press('Space')
    await expect
      .poll(() => parseSent(sentOf(page)).filter((f) => f.action === 'sendPlayerBoolean').length)
      .toBe(booleansBefore + 1)
    expect(
      parseSent(sentOf(page)).filter(
        (f) => f.action === 'sendPlayerUUID' && f.args?.value === CONTROL_CREATURE_ID,
      ).length,
      'Space no debe re-activar la carta enfocada',
    ).toBe(creatureUuidsBefore)

    expect(session.pageErrors, session.pageErrors.map(String).join(' | ')).toEqual([])
  })
})
