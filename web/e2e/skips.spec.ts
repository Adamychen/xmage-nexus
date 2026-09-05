import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'
/**
 * Skips one-shot estilo desktop (corte A + rediseño): el menú ▾ del botón Pasar
 * y las teclas F envían `sendPlayerAction(PASS_PRIORITY_*)`, el flag `passed*`
 * del servidor marca el skip activo (botón + menú) y F3 lo cancela.
 *
 * Dual fake/real. Fake (determinista): teclas F10/F3 + clics de menú + marcas
 * DOM. Real (contrato XMage 1.4.61, doctrina WS: acciones frágiles por helper,
 * UI solo verifica): ok del proxy a las 7 acciones, eco de passedAllTurns en
 * la vista y limpieza permanente con F3. Lecciones embebidas: turnos de ~0.5s
 * (polls a 100ms, ventanas largas, sin cursores — el buffer es un anillo de
 * 500), usernames ≤14 chars para compartir sesión página/helper.
 */
import { test, expect } from './fixtures'
import { FAKE_MODE } from './dual'
import type { Page } from '@playwright/test'
import { skipsScenario } from '../fixtures/scenarios/skips'
import { withFakeServer } from './support/fake-backend'
import { startGame } from './support/start-game'
import {
  parseSent,
  sentOf,
  parseFrames,
  lastGameView,
} from './support/frames'

const PASSED_FLAGS = [
  'passedTurn',
  'passedUntilEndOfTurn',
  'passedUntilNextMain',
  'passedAllTurns',
  'passedUntilStackResolved',
  'passedUntilEndStepBeforeMyTurn',
]

type View = Record<string, unknown> | null

function myPlayerOfView(view: View): Record<string, unknown> | null {
  const players = (view as { players?: unknown } | null)?.players
  if (!Array.isArray(players)) return null
  return (players.find((p) => (p as { controlled?: boolean })?.controlled === true) as Record<string, unknown> | undefined) ?? null
}

async function sentSkip(page: Page, action: string, timeout = 10_000) {
  await expect
    .poll(
      () =>
        parseSent(sentOf(page)).some(
          (s) => s.action === 'sendPlayerAction' && String(s.args?.action) === action,
        ),
      { timeout },
    )
    .toBeTruthy()
}

async function openPassMenu(page: Page) {
  await page.locator('[data-testid="pass-split-toggle"]').click()
  await expect(page.locator('[data-testid="pass-menu"]')).toBeVisible({ timeout: 10_000 })
}

test('skips: teclas F + menú ▾ envían PASS_PRIORITY_* y marcan el skip activo', { tag: '@fullflow' }, async ({ page }) => {
  test.setTimeout(FAKE_MODE ? 60_000 : 240_000)
  await withFakeServer(() => skipsScenario(), async () => {
    const { pageErrors, frames: sessionFrames, helper: sessionHelper } = await startGame(page, {
      prefix: 'skips',
      tableName: TABLE.skips,
      ...(FAKE_MODE ? { deck: DECK.lands, simDeck: DECK.aiLands } : {}),
    })

    // el toggle ▾ existe cuando hay jugador controlado (ambos modos)
    await expect(page.locator('[data-testid="pass-split-toggle"]')).toBeVisible({ timeout: 60_000 })

    if (FAKE_MODE) {
      // 1. Tecla F10 (saltar la pila) llega al servidor como one-shot
      await page.keyboard.press('F10')
      await sentSkip(page, 'PASS_PRIORITY_UNTIL_STACK_RESOLVED')

      // 2. El flag passedUntilStackResolved marca el skip activo en menú y botón
      await openPassMenu(page)
      await expect(page.locator('[data-testid="skip-stack"]')).toHaveClass(/is-active/, { timeout: 10_000 })
      await expect(page.locator('.big-action-split')).toHaveClass(/has-skip/)
      await expect(page.locator('.action-btn-sublabel')).toContainText(/Saltando a/)
      await expect(page.locator('[data-testid="skip-cancel"]')).toBeVisible()

      // 3. Clic en otro skip (F9: hasta mi turno) lo sustituye en el servidor
      await page.locator('[data-testid="skip-myTurn"]').click()
      await sentSkip(page, 'PASS_PRIORITY_UNTIL_MY_NEXT_TURN')
      await openPassMenu(page)
      await expect(page.locator('[data-testid="skip-myTurn"]')).toHaveClass(/is-active/, { timeout: 10_000 })

      // 4. F3 cancela: CANCEL llega al servidor y la marca desaparece
      await page.keyboard.press('Escape')
      await page.keyboard.press('F3')
      await sentSkip(page, 'PASS_PRIORITY_CANCEL_ALL_ACTIONS')
      await openPassMenu(page)
      await expect(page.locator('[data-testid="skip-myTurn"]')).not.toHaveClass(/is-active/, { timeout: 10_000 })
      await expect(page.locator('[data-testid="skip-cancel"]')).toBeHidden()
      await expect(page.locator('.big-action-split')).not.toHaveClass(/has-skip/)
    } else {
      // Rama real: acciones frágiles por WS (helper), la UI solo verifica
      // (doctrina e2e del repo). El envío por clic/tecla de la página contra el
      // proxy real ya lo prueban otros specs (hold-priority en stack-priority…);
      // aquí se verifica el contrato servidor: passthrough + eco de flags.
      const realHelper = sessionHelper
      const latestView = (): View => lastGameView(parseFrames(sessionFrames))
      const latestTurn = (): number => {
        const turn = (latestView() as { turn?: unknown } | null)?.turn
        return typeof turn === 'number' ? turn : 0
      }
      const latestFlag = (flag: string): boolean => myPlayerOfView(latestView())?.[flag] === true
      const latestCleared = (): boolean => {
        const me = myPlayerOfView(latestView())
        return !!me && PASSED_FLAGS.every((flag) => !me[flag])
      }
      const myTurnNow = (): boolean => {
        const gv = latestView() as { activePlayerId?: unknown; myPlayerId?: unknown } | null
        return !!gv && gv.activePlayerId === gv.myPlayerId && gv.myPlayerId != null
      }

      // Los turnos vuelan (~1s) y la partida deckea sobre el turno ~100: actuar
      // pronto (turno 3+) y preferir ventanas largas.
      await expect.poll(latestTurn, { timeout: 120_000 }).toBeGreaterThanOrEqual(3)

      // 1. Transporte: el proxy+servidor aceptan las 7 acciones (ok por WS).
      // F10 con pila vacía es no-op en el servidor (PlayerImpl), pero el ok
      // prueba el passthrough del proxy igualmente.
      for (const action of [
        'PASS_PRIORITY_UNTIL_NEXT_TURN',
        'PASS_PRIORITY_UNTIL_TURN_END_STEP',
        'PASS_PRIORITY_UNTIL_NEXT_MAIN_PHASE',
        'PASS_PRIORITY_UNTIL_MY_NEXT_TURN',
        'PASS_PRIORITY_UNTIL_STACK_RESOLVED',
        'PASS_PRIORITY_UNTIL_END_STEP_BEFORE_MY_NEXT_TURN',
        'PASS_PRIORITY_CANCEL_ALL_ACTIONS',
      ]) {
        await test.step(`helper ${action}`, async () => {
          expect(await realHelper.sendPlayerAction(action), `proxy ok para ${action}`).toBe(true)
        })
      }

      // 2. Semántica: F9 en MI turno (ventana ~ronda y media) deja el flag
      // passedAllTurns en la vista. Dos intentos por si el primero cae entre
      // muestras con turnos rapidísimos. (El pintado del flag se prueba en fake.)
      await expect.poll(myTurnNow, { timeout: 60_000, intervals: [200] }).toBe(true)
      let flagSeen = false
      for (let attempt = 0; attempt < 2 && !flagSeen; attempt++) {
        await test.step(`flag F9 (intento ${attempt + 1})`, async () => {
          expect(await realHelper.sendPlayerAction('PASS_PRIORITY_UNTIL_MY_NEXT_TURN')).toBe(true)
          try {
            await expect.poll(() => latestFlag('passedAllTurns'), { timeout: 45_000, intervals: [100] }).toBe(true)
            flagSeen = true
          } catch {
            // ventana perdida entre muestras: reintentar con una ventana fresca
          }
        })
      }
      expect(flagSeen, 'el servidor debió ecoar passedAllTurns en alguna ventana').toBe(true)

      // 3. Cancel: F3 limpia los flags de forma PERMANENTE (condición estable,
      // sin carreras: tras cancelar no se envía nada más).
      await test.step('cancel F3', async () => {
        expect(await realHelper.sendPlayerAction('PASS_PRIORITY_CANCEL_ALL_ACTIONS')).toBe(true)
        await expect.poll(latestCleared, { timeout: 90_000 }).toBe(true)
      })
    }

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})
