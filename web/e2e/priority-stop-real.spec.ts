import { test, expect } from './fixtures'
import { FAKE_MODE } from './dual'
import { startGame } from './support/start-game'
import { DECK } from '../fixtures/deck-names'

/**
 * "Nunca se pasa una ventana que el jugador marcó" (docs/history/plan4.md §3.5): el grid de
 * `PhaseBar` (equivalente en pantalla a los F-keys de fase — clic = mi turno,
 * Shift+clic = turno rival) envía `updatePreferences({ phases })` al proxy, que
 * lo traduce a `UserSkipPrioritySteps` real y lo aplica en
 * `HumanPlayer.checkPassStep` del engine XMage (fork, no simulado): un paso
 * marcado en `true` SIEMPRE dispara un `GAME_SELECT` con prioridad real; uno en
 * `false` el engine lo autopasa server-side SIN preguntar nunca al cliente.
 * Solo real: el FixtureServer no implementa `UserSkipPrioritySteps` (no hay
 * equivalente fake de esta garantía).
 */
test.skip(
  FAKE_MODE,
  'Solo real: la retención de prioridad en un paso marcado es lógica del engine XMage ' +
    '(UserSkipPrioritySteps / HumanPlayer.checkPassStep); el FixtureServer no la implementa.',
)

test.setTimeout(240_000)

// Pasos configurables por PhaseBar/phaseStops (coincide 1:1 con SkipPrioritySteps
// del servidor real). DECLARE_ATTACKERS/DECLARE_BLOCKERS/COMBAT_DAMAGE NO son
// configurables ahí -- el engine siempre pregunta si hay algo real que decidir
// (por eso el mazo de ambos lados es solo tierras: cero criaturas, cero preguntas
// de combate que puedan mezclarse con la garantía que se está probando aquí).
const YOUR_TURN_OFF = ['DRAW', 'PRECOMBAT_MAIN', 'BEGIN_COMBAT', 'END_COMBAT', 'POSTCOMBAT_MAIN', 'END_TURN']
const ALL_STOP_STEPS = ['UPKEEP', ...YOUR_TURN_OFF]
const CONFIGURABLE_STEPS = new Set(ALL_STOP_STEPS)

/** Estado en vivo del store real de la página (no frames WS crudos): `game.step`/
 *  `hasPriority` los puebla directamente el `GameView` del servidor (GAME_SELECT/
 *  GAME_UPDATE) vía `handleMessage`, así que leerlos del store equivale a leer el
 *  protocolo -- es la MISMA fuente de verdad que pinta la UI (ground truth real,
 *  no una inferencia del test). */
async function liveGame(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const g = (globalThis as any).__mageStore?.getState?.()?.game
    const me = g?.players?.find((p: any) => p.controlled)
    return {
      turn: g?.turn as number | undefined,
      step: g?.step as string | undefined,
      hasPriority: me?.hasPriority as boolean | undefined,
      isActive: me?.isActive as boolean | undefined,
    }
  })
}

test(
  'nunca se pasa una ventana de prioridad marcada por el jugador (phaseStops real, F-keys de fase)',
  { tag: '@priority-stop-real' },
  async ({ page }) => {
    const session = await startGame(page, {
      prefix: 'ps',
      deck: DECK.lands,
      simDeck: DECK.aiLands,
    })

    // El helper WS comparte SESIÓN con la página (mismo usuario, dos conexiones
    // sobre el mismo jugador real) y por diseño (wshelper.ts: handleSelect, rama
    // por defecto) pasa CUALQUIER ventana de prioridad que no sea mi main phase
    // con jugables o una ventana de combate -- justo lo que hay que verificar que
    // NO ocurra en el paso marcado. Se detiene: la página queda como única
    // conexión y decide ella sola, tal como lo haría un jugador real.
    await session.helper.stop()

    const passBtn = page.locator('.big-action-btn.interactive')

    // --- Configurar phaseStops por la UI REAL del PhaseBar --------------------
    // Deja SOLO "mi upkeep" marcado para detenerse; apaga todo lo demás (mi
    // turno y el del rival) para que el engine autopase en silencio el resto.
    for (const step of YOUR_TURN_OFF) {
      await page.getByTestId(`phase-bar-step-${step}`).click()
    }
    for (const step of ALL_STOP_STEPS) {
      await page.getByTestId(`phase-bar-step-${step}`).click({ modifiers: ['Shift'] })
    }
    await expect
      .poll(() => page.evaluate(() => (globalThis as any).__mageStore?.getState?.()?.phaseStops))
      .toMatchObject({
        yourTurn: { upkeep: true, draw: false, main1: false, beginCombat: false, endCombat: false, main2: false, endStep: false },
        opponentTurn: { upkeep: false, draw: false, main1: false, beginCombat: false, endCombat: false, main2: false, endStep: false },
      })

    // --- Monitor único, basado en el estado en vivo del store (no en el buffer de
    // frames: la transición de turno que abre "mi upkeep" y el propio GAME_SELECT
    // que la trae llegan en el MISMO evento, así que anclar un cursor de frames
    // DESPUÉS de detectar el cambio de turno se comía justo esa ventana -- primer
    // intento de este test, quedaba en 0 paradas con la UI ya parada ahí mismo). --
    // El turno en el que se terminó de reconfigurar puede traer restos de la
    // config de fábrica (todo=true): esas ventanas se pasan sin contar como
    // parada ("leniente"). Desde el turno SIGUIENTE, cualquier prioridad real
    // fuera de "mi upkeep" es una violación de la garantía.
    const turnAtConfig = (await liveGame(page)).turn ?? 0
    let hits = 0
    let lastHandledTurn: number | null = null
    const TARGET_HITS = 3
    const deadline = Date.now() + 120_000

    while (hits < TARGET_HITS && Date.now() < deadline) {
      // Descarte forzado por límite de mano (7 cartas): al no jugar nunca
      // tierras (main1 está apagado a propósito), la mano de un mazo de solo
      // tierras desborda en un par de turnos y el CLEANUP pide descartar. Es
      // un GAME_TARGET resuelto por `TargetBar` (feedbackModes/TargetBar.tsx):
      // el propio objetivo es una carta de la mano marcada `.targetable`, NO
      // un `CardGrid` modal (esa fue la hipótesis equivocada de la 2ª corrida:
      // se quedó esperando para siempre). Tampoco es una ventana de prioridad
      // -- el jugador puede no tener prioridad mientras está abierta -- así
      // que se resuelve ANTES de mirar `hasPriority`.
      //
      // `.last()` y no `.first()` (3ª corrida, causa raíz): la carta MÁS A LA
      // IZQUIERDA del abanico queda tapada por la siguiente (solape real ~65%
      // del ancho), así que el hit-test de Playwright nunca la alcanza; con
      // actionTimeout=0 el click reintenta hasta agotar el timeout del test
      // (443 reintentos medidos en el trace) y el descarte no se responde
      // jamás. La última carta del DOM no tiene hermanos posteriores encima.
      // Timeout acotado: un click que no llega no puede consumir la corrida
      // entera; se salta esa iteración y el bucle reintenta.
      const discardTarget = page.locator('.hand-card.targetable, .card-grid-cell').last()
      if (await discardTarget.isVisible().catch(() => false)) {
        await discardTarget.click({ timeout: 5_000 }).catch(() => {})
        // El prompt desaparece en cuanto el server acepta el UUID; esperarlo
        // (con tope) en vez de un sleep fijo acelera el bucle y evita contar
        // como ventana una parada que ya se resolvió.
        await expect
          .poll(
            () =>
              page.evaluate(
                () => ((globalThis as any).__mageStore?.getState?.()?.feedback?.method ?? null) as string | null,
              ),
            { timeout: 10_000 },
          )
          .not.toBe('GAME_TARGET')
          .catch(() => {})
        continue
      }

      const g = await liveGame(page)
      if (!g.hasPriority) {
        await page.waitForTimeout(120)
        continue
      }
      const lenient = (g.turn ?? 0) <= turnAtConfig
      const isMarkedStop = g.step === 'UPKEEP' && g.isActive === true
      // DECLARE_ATTACKERS/DECLARE_BLOCKERS/COMBAT_DAMAGE/CLEANUP no son
      // configurables por phaseStops (ni en `SkipPrioritySteps` real ni en el
      // grid del PhaseBar: sin stopKey) -- el engine SIEMPRE reparte una ronda
      // de prioridad ahí si hay algo que resolver, marcado o no. No cuentan
      // como parada de este test ni como violación: se pasan sin más.
      const isConfigurable = typeof g.step === 'string' && CONFIGURABLE_STEPS.has(g.step)

      if (!isConfigurable) {
        await passBtn.click().catch(() => {})
        await page.waitForTimeout(150)
        continue
      }

      if (!isMarkedStop) {
        if (!lenient) {
          throw new Error(
            `violación de phaseStops: el cliente tiene prioridad real en un paso configurable marcado ` +
              `como auto-skip (step=${g.step}, isActive=${g.isActive}, turn=${g.turn}) -- el engine no ` +
              `debería haber preguntado nunca ahí.`,
          )
        }
        await passBtn.click().catch(() => {})
        await page.waitForTimeout(150)
        continue
      }

      if (lenient || g.turn === lastHandledTurn) {
        // resto de la config previa en el turno de la reconfiguración, o la
        // misma parada ya procesada (aún no hemos vuelto a sondear tras pasar).
        if (lenient) await passBtn.click().catch(() => {})
        await page.waitForTimeout(150)
        continue
      }

      // *** parada real marcada por el jugador: "mi upkeep" ***
      hits++
      lastHandledTurn = g.turn ?? null

      // "Nunca se pasa": el cliente debe seguir bloqueado esperando al jugador,
      // no autocontinuar en silencio. Se verifica ANTES de tocar nada y de nuevo
      // tras esperar, para descartar un auto-pase silencioso (cliente o engine).
      expect(g.step, `hit #${hits}: el cliente debería seguir en UPKEEP esperando al jugador`).toBe('UPKEEP')
      expect(g.hasPriority, `hit #${hits}: el cliente debería seguir con prioridad real`).toBe(true)
      await expect(passBtn, `hit #${hits}: botón "Pasar Prioridad" interactivo en la ventana marcada`).toBeVisible({
        timeout: 5_000,
      })

      await page.waitForTimeout(2_000)

      const after = await liveGame(page)
      expect(after.turn, `hit #${hits}: no debería avanzar de turno solo por esperar`).toBe(g.turn)
      expect(after.step, `hit #${hits}: no debería salir de UPKEEP solo por esperar (auto-pase silencioso)`).toBe('UPKEEP')
      expect(after.hasPriority, `hit #${hits}: no debería perder la prioridad sin que el jugador pasara`).toBe(true)
      await expect(passBtn, `hit #${hits}: sigue interactivo tras la espera`).toBeVisible()

      // Ahora sí: el jugador decide pasar, por la UI real (mismo botón/atajo Espacio).
      await passBtn.click()
      await expect
        .poll(async () => (await liveGame(page)).step, { timeout: 15_000 })
        .not.toBe('UPKEEP')
    }

    expect(hits, `se esperaban ${TARGET_HITS} paradas reales en mi upkeep; solo se observaron ${hits}`).toBe(TARGET_HITS)
    expect(session.pageErrors, `pageerrors: ${session.pageErrors.map(String).join(' | ')}`).toEqual([])
  },
)
