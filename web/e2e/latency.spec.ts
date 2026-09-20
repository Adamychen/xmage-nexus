/**
 * Latencia percibida (plan4 §5.4): por acción medible, (a) el acuse visual
 * ocurre <100 ms tras el clic, (b) la confirmación (eco) del servidor se
 * registra con su duración, y (c) si el eco se retarda >1 s hay estado de
 * espera visible (botón disabled / clase pending / is-busy).
 *
 * El eco artificial (>1 s) solo existe en el FixtureServer, así que la matriz
 * determinista se ejecuta en fake; en real los tests se saltan (el nightly del
 * stack mide la latencia real del proxy sin forzar retardos).
 */

import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { FAKE_MODE } from './dual'
import { DECK } from '../fixtures/deck-names'
import { startGame, login } from './support/start-game'
import { waitPlayable } from './support/game-screen'
import { makeDraftScenario } from '../fixtures/scenarios/draft'
import {
  latencyCombatScenario,
  latencyLandScenario,
  latencyPassScenario,
  latencyTargetScenario,
} from '../fixtures/scenarios/latency'
import {
  LATENCY_ECHO_MS,
  armAckProbe,
  perfClear,
  perfEntries,
  readAckMs,
  waitEventsQuiet,
  withDelayedFakeServer,
  type PerfEntry,
} from './support/perf'
import {
  framesOf,
  lastGameView,
  nextManaSource,
  parseFrames,
  parsedLen,
  targetIdsOf,
  waitFrame,
  waitFrameAt,
} from './support/frames'
import { waitSceneCombat } from './support/scene'

const ACK_BUDGET_MS = 100
const WAIT_STATE_MS = 500

const FAKE_ONLY_REASON =
  'Latencia con eco artificial >1s: el retardo determinista solo existe en el FixtureServer (en real lo mide el nightly del stack).'

function expectAckUnder(ackMs: number, label: string): void {
  expect(ackMs, `${label}: acuse visual <${ACK_BUDGET_MS}ms (recibido ${ackMs.toFixed(1)}ms)`).toBeGreaterThanOrEqual(0)
  expect(ackMs, `${label}: acuse visual <${ACK_BUDGET_MS}ms`).toBeLessThan(ACK_BUDGET_MS)
}

/** Primera marca de eco (evento del servidor) posterior a `click`. */
async function echoAfter(page: Page, clickName: string, timeoutMs = LATENCY_ECHO_MS + 5000) {
  const deadline = Date.now() + timeoutMs
  const findIn = (entries: PerfEntry[]) => {
    const click = [...entries].reverse().find((e: PerfEntry) => e.kind === 'click' && e.name === clickName)
    const echo = click && entries.find((e: PerfEntry) => e.kind === 'event' && e.mono >= click.mono)
    return { click, echo }
  }
  for (;;) {
    const { click, echo } = findIn(await perfEntries(page))
    if (!click) throw new Error(`sin marca click "${clickName}" en __magePerf`)
    if (echo) return { click, echo, echoMs: echo.mono - click.mono }
    if (Date.now() > deadline) throw new Error(`sin marca de eco del servidor tras "${clickName}"`)
    await page.waitForTimeout(50)
  }
}

test.describe('Latencia percibida (acuse <100ms + eco con retardo)', { tag: '@latency' }, () => {
  // El eco artificial retrasa TODOS los eventos del FixtureServer: en paralelo
  // con otros workers el escenario se ralentiza. Serial dentro del fichero y
  // margen holgado; el presupuesto que se asserta es el del ACUSE (<100 ms),
  // no el del eco (que es artificial).
  test.describe.configure({ mode: 'serial', timeout: 240_000 })

  test('pasar prioridad: ack en el botón y espera explícita mientras el eco viaja', async ({ page }) => {
    test.skip(!FAKE_MODE, FAKE_ONLY_REASON)
    await withDelayedFakeServer(latencyPassScenario, async () => {
      const { pageErrors } = await startGame(page, { prefix: 'lta', tableName: 'latency-pass', deck: DECK.lands })
      const button = page.locator('.big-action-btn')
      await expect(button).toBeEnabled({ timeout: 20_000 })

      await waitEventsQuiet(page)

      await perfClear(page)
      await armAckProbe(page, '.big-action-btn', { disabled: true })
      await button.click()
      expectAckUnder(await readAckMs(page, 2000), 'pasar prioridad')
      await page.waitForTimeout(WAIT_STATE_MS)
      await expect(button, 'estado de espera visible con eco >1s').toBeDisabled()

      const { echoMs } = await echoAfter(page, 'pass')
      expect(echoMs, 'eco del pass retrasado').toBeGreaterThan(LATENCY_ECHO_MS * 0.6)
      await expect(button).toBeEnabled({ timeout: LATENCY_ECHO_MS + 5000 })
      expect(pageErrors).toEqual([])
    })
  })

  test('jugar tierra: is-pending inmediato y se limpia con el eco', async ({ page }) => {
    test.skip(!FAKE_MODE, FAKE_ONLY_REASON)
    await withDelayedFakeServer(latencyLandScenario, async () => {
      const { pageErrors } = await startGame(page, { prefix: 'ltl', tableName: 'latency-land', deck: DECK.lands })
      // El helper juega una tierra por turno: reintenta la medición en el
      // siguiente turno si la ventana se cerró mientras el test armaba la sonda.
      let ackMs = -1
      let echoMs = -1
      for (let attempt = 0; attempt < 4 && ackMs < 0; attempt++) {
        const landId = await waitPlayable(page, 'Mountain', { minUntapped: 0, timeoutMs: 20_000 })
        const selector = `[data-testid="hand-bar"] [data-card-id="${landId ?? ''}"]`
        if (!landId || (await page.locator(selector).count()) === 0) continue
        await perfClear(page)
        await armAckProbe(page, '[data-testid="hand-bar"] .card-slot.is-pending', {})
        await page.locator(selector).click({ force: true })
        ackMs = await readAckMs(page, 2000)
        if (ackMs >= 0) {
          await page.waitForTimeout(WAIT_STATE_MS)
          echoMs = (await echoAfter(page, 'playable')).echoMs
          // Un eco más rápido que el retardo es un evento del helper enviado
          // antes del clic (juega su tierra en paralelo): intento contaminado.
          if (echoMs <= LATENCY_ECHO_MS * 0.6 && attempt < 3) ackMs = -1
        }
      }
      expectAckUnder(ackMs, 'jugar tierra')
      expect(echoMs, 'eco de la tierra retrasado').toBeGreaterThan(LATENCY_ECHO_MS * 0.6)
      expect(pageErrors).toEqual([])
    })
  })

  test('lanzar carta: is-pending inmediato y eco retrasado', async ({ page }) => {
    test.skip(!FAKE_MODE, FAKE_ONLY_REASON)
    await withDelayedFakeServer(latencyTargetScenario, async () => {
      const { pageErrors } = await startGame(page, { prefix: 'ltc', tableName: 'latency-target', deck: DECK.lands })
      const boltId = await waitPlayable(page, 'Lightning Bolt', { minUntapped: 1, timeoutMs: 20_000 })
      expect(boltId, 'Lightning Bolt jugable').toBeTruthy()
      const selector = `[data-testid="hand-bar"] [data-card-id="${boltId}"]`
      await expect(page.locator(selector)).toBeVisible({ timeout: 10_000 })

      await waitEventsQuiet(page)

      await perfClear(page)
      await armAckProbe(page, selector, { className: 'is-pending' })
      await page.locator(selector).click()
      expectAckUnder(await readAckMs(page, 2000), 'lanzar carta')
      await page.waitForTimeout(WAIT_STATE_MS)
      expect(await page.locator(selector).getAttribute('class')).toContain('is-pending')

      const { echoMs } = await echoAfter(page, 'playable')
      expect(echoMs, 'eco del lanzamiento retrasado').toBeGreaterThan(LATENCY_ECHO_MS * 0.6)
      expect(pageErrors).toEqual([])
    })
  })

  test('elegir objetivo: is-chosen-pending inmediato y eco que lo confirma', async ({ page }) => {
    test.skip(!FAKE_MODE, FAKE_ONLY_REASON)
    await withDelayedFakeServer(latencyTargetScenario, async () => {
      const { pageErrors, helper } = await startGame(page, { prefix: 'ltt', tableName: 'latency-target', deck: DECK.lands })
      const boltId = await waitPlayable(page, 'Lightning Bolt', { minUntapped: 1, timeoutMs: 20_000 })
      expect(boltId, 'Bolt jugable').toBeTruthy()
      expect(await helper.playCard(boltId!), 'lanzar el Bolt por WS').toBeTruthy()
      const target = await waitFrameAt(page, (f) => f.method === 'GAME_TARGET', 'GAME_TARGET del Bolt', 20_000)
      const targetId = targetIdsOf(target.frame)[0]
      const selector = `.card-slot[data-card-id="${targetId}"]`
      await expect(page.locator(selector)).toBeVisible({ timeout: 10_000 })

      await waitEventsQuiet(page)

      await perfClear(page)
      await armAckProbe(page, selector, { className: 'is-chosen-pending' })
      await page.locator(selector).click({ force: true })
      expectAckUnder(await readAckMs(page, 2000), 'elegir objetivo')
      await page.waitForTimeout(WAIT_STATE_MS)
      expect(await page.locator(selector).getAttribute('class')).toContain('is-chosen-pending')

      const { echoMs } = await echoAfter(page, 'target')
      expect(echoMs, 'eco del objetivo retrasado').toBeGreaterThan(LATENCY_ECHO_MS * 0.6)
      expect(pageErrors).toEqual([])
    })
  })

  test('pagar maná: is-pending al clicar la fuente y eco retrasado', async ({ page }) => {
    test.skip(!FAKE_MODE, FAKE_ONLY_REASON)
    await withDelayedFakeServer(latencyTargetScenario, async () => {
      const { pageErrors, helper } = await startGame(page, { prefix: 'ltm', tableName: 'latency-target', deck: DECK.lands })
      const boltId = await waitPlayable(page, 'Lightning Bolt', { minUntapped: 1, timeoutMs: 20_000 })
      expect(boltId, 'Bolt jugable').toBeTruthy()
      expect(await helper.playCard(boltId!), 'lanzar el Bolt por WS').toBeTruthy()
      const target = await waitFrameAt(page, (f) => f.method === 'GAME_TARGET', 'GAME_TARGET del Bolt', 20_000)
      expect(await helper.playCard(targetIdsOf(target.frame)[0]), 'elegir objetivo por WS').toBeTruthy()
      await waitFrameAt(page, (f) => f.method === 'GAME_PLAY_MANA', 'GAME_PLAY_MANA', 20_000)

      const sourceId = nextManaSource(lastGameView(parseFrames(framesOf(page))), null)
      expect(sourceId, 'fuente de maná sin girar').toBeTruthy()
      const selector = `.card-slot[data-card-id="${sourceId}"]`
      await expect(page.locator(selector)).toBeVisible({ timeout: 10_000 })

      await waitEventsQuiet(page)

      await perfClear(page)
      await armAckProbe(page, selector, { className: 'is-pending' })
      await page.locator(selector).click()
      expectAckUnder(await readAckMs(page, 2000), 'pagar maná')
      await page.waitForTimeout(WAIT_STATE_MS)
      expect(await page.locator(selector).getAttribute('class')).toContain('is-pending')

      const { echoMs } = await echoAfter(page, 'mana')
      expect(echoMs, 'eco del pago retrasado').toBeGreaterThan(LATENCY_ECHO_MS * 0.6)
      expect(pageErrors).toEqual([])
    })
  })

  test('declarar atacantes: is-pending inmediato y eco posterior', async ({ page }) => {
    test.skip(!FAKE_MODE, FAKE_ONLY_REASON)
    await withDelayedFakeServer(latencyCombatScenario, async () => {
      const { pageErrors } = await startGame(page, {
        prefix: 'ltk',
        tableName: 'latency-combat',
        deck: DECK.combatHuman,
        skipCombat: true,
      })
      const combat = await waitSceneCombat(page, (c) => c.active && c.mode === 'attack', 'ventana de atacantes', 25_000)
      const attackerId = combat.selectable[0]
      expect(attackerId, 'criatura seleccionable como atacante').toBeTruthy()
      const selector = `.card-slot[data-card-id="${attackerId}"]`
      await expect(page.locator(selector)).toBeVisible({ timeout: 10_000 })

      await waitEventsQuiet(page)

      await perfClear(page)
      await armAckProbe(page, selector, { className: 'is-pending' })
      await page.locator(selector).click()
      expectAckUnder(await readAckMs(page, 2000), 'declarar atacante')
      await page.waitForTimeout(WAIT_STATE_MS)
      expect(await page.locator(selector).getAttribute('class')).toContain('is-pending')

      const { echoMs } = await echoAfter(page, 'combat')
      expect(echoMs, 'eco del atacante retrasado').toBeGreaterThan(LATENCY_ECHO_MS * 0.6)
      expect(pageErrors).toEqual([])
    })
  })

  test('pick de draft: is-busy inmediato y eco DRAFT_UPDATE retrasado', async ({ page }) => {
    test.skip(!FAKE_MODE, FAKE_ONLY_REASON)
    await withDelayedFakeServer(() => makeDraftScenario({ nextPickDelayMs: 3000 }), async () => {
      await login(page, `latd-${String(Date.now()).slice(-6)}`)
      await expect(page.locator('.draft-screen').first()).toBeVisible({ timeout: 20_000 })
      const card = page.locator('.draft-card').first()
      await expect(card).toBeEnabled({ timeout: 20_000 })

      await perfClear(page)
      await armAckProbe(page, '.draft-card', { className: 'is-busy' })
      const clickedAt = Date.now()
      await card.click({ force: true })
      expectAckUnder(await readAckMs(page, 2000), 'pick de draft')
      expect(await page.locator('.draft-card.is-busy').count(), 'estado is-busy visible tras el ack').toBeGreaterThan(0)
      await page.waitForTimeout(WAIT_STATE_MS)
      expect(await card.getAttribute('class'), 'la carta queda bloqueada/confirmada mientras viaja el eco').toMatch(/is-busy|is-picked|is-disabled/)

      // el eco DRAFT_UPDATE llega tras el retardo del eco + el del siguiente pick
      await expect(page.getByTestId('draft-picked-banner')).toBeVisible({ timeout: LATENCY_ECHO_MS + 10_000 })
      const echoDeadline = Date.now() + LATENCY_ECHO_MS + 8000
      let echo = (await perfEntries(page)).find((e) => e.kind === 'event' && e.name === 'DRAFT_UPDATE' && e.wall >= clickedAt)
      while (!echo && Date.now() < echoDeadline) {
        await page.waitForTimeout(100)
        echo = (await perfEntries(page)).find((e) => e.kind === 'event' && e.name === 'DRAFT_UPDATE' && e.wall >= clickedAt)
      }
      expect(echo, 'eco DRAFT_UPDATE en __magePerf').toBeTruthy()
      expect(echo!.wall - clickedAt, 'eco del draft retrasado').toBeGreaterThan(LATENCY_ECHO_MS * 0.6)
    })
  })
})
