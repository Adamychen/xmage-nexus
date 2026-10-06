import { fakeOnly } from './support/fake-mode'
import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'
/**
 * Mulligan (Keep + Mulligan London): con auto-keep desactivado, la ventana de
 * mulligan (FeedbackDialog con GAME_ASK) debe aparecer y poderse ejercitar.
 *  - Keep hand: la partida continúa (GAME_SELECT).
 *  - Mulligan: the London dialog shows how many cards are left, each click
 *    bottoms exactly one card (one UUID per server re-ask) and the game goes on.
 *    Se captura una screenshot de la ventana de mulligan.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from './fixtures'
fakeOnly()
import { mulliganScenario, MULLIGAN_BOTTOM_COUNT, MULLIGAN_HAND_IDS } from '../fixtures/scenarios/mulligan'
import { withFakeServer } from './support/fake-backend'
import { startGame } from './support/start-game'
import { framesOf, parseFrames, parseSent, sentOf } from './support/frames'

const SHOTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots')

test('mulligan: la ventana aparece y "Keep hand" arranca la partida', { tag: '@fullflow' }, async ({ page }) => {
  fs.mkdirSync(SHOTS_DIR, { recursive: true })
  await withFakeServer(() => mulliganScenario(), async () => {
    const { pageErrors } = await startGame(page, {
      prefix: 'mull',
      tableName: TABLE.mulligan,
      deck: DECK.lands,
      simDeck: DECK.aiLands,
      autoKeepMulligan: false,
    })

    // la barra de mano inicial (GAME_ASK) debe pintarse sobre la mano elevada
    const dialog = page.getByTestId('mulligan-bar')
    await expect(dialog).toBeVisible({ timeout: 15_000 })
    await expect(dialog).toContainText(/mulligan/i)
    await expect(page.locator('[data-testid="hand-bar"]')).toHaveClass(/is-raised/)

    // screenshot de la ventana de mulligan
    const shot = await page.screenshot({ fullPage: true })
    fs.writeFileSync(path.join(SHOTS_DIR, 'mulligan-01-window.png'), shot)

    // el ask llegó al cliente (frame GAME_ASK)
    expect(parseFrames(framesOf(page)).some((f) => f.method === 'GAME_ASK' && /mulligan/i.test(String(f.data?.question ?? '')))).toBeTruthy()

    // Regresión (pasada 3 en vivo): con la última carta en hover, la carta
    // crecida tapaba el botón Conservar mano y el clic quedaba interceptado.
    // El prompt de mano debe apilarse por encima de la carta crecida (z 50).
    await page.locator('[data-testid="hand-bar"] .hand-card').last().hover()
    const zRanks = await page.evaluate(() => {
      const prompt = document.querySelector('.hand-bar-prompt')
      const grown = document.querySelector('.hand-bar .hand-card-slot:hover')
      return {
        prompt: Number(getComputedStyle(prompt as Element).zIndex),
        grown: Number(getComputedStyle(grown as Element).zIndex || 0),
      }
    })
    expect(zRanks.prompt, 'el prompt de mano debe ir por encima de la carta crecida').toBeGreaterThan(zRanks.grown)
    await dialog.getByRole('button', { name: /Conservar mano/ }).click()

    // el cliente envió sendPlayerBoolean(false) y la partida continúa (GAME_SELECT)
    await expect
      .poll(() => parseSent(sentOf(page)).some((s) => s.action === 'sendPlayerBoolean' && s.args?.value === false), { timeout: 10_000 })
      .toBeTruthy()
    await expect(page.getByTestId('game-status')).toBeVisible({ timeout: 15_000 })

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})

test('mulligan: "Mulligan" abre el target de London (poner carta al fondo)', { tag: '@fullflow' }, async ({ page }) => {
  await withFakeServer(() => mulliganScenario(), async () => {
    const { pageErrors } = await startGame(page, {
      prefix: 'mull2',
      tableName: TABLE.mulligan,
      deck: DECK.lands,
      simDeck: DECK.aiLands,
      autoKeepMulligan: false,
    })

    const dialog = page.getByTestId('mulligan-bar')
    await expect(dialog).toBeVisible({ timeout: 15_000 })

    // elegir "Mulligan" (boolean=true)
    await dialog.getByRole('button', { name: /^Mulligan/ }).click()

    const london = page.locator('.mulligan-dialog.mulligan-london')
    const remaining = page.getByTestId('mulligan-london-remaining')
    for (let left = MULLIGAN_BOTTOM_COUNT; left > 0; left -= 1) {
      await expect(london).toBeVisible({ timeout: 10_000 })
      await expect(remaining).toContainText(String(left))
      const grid = page.getByTestId('mulligan-london-grid')
      await expect(grid.locator('.card-slot')).toHaveCount(MULLIGAN_HAND_IDS.length - (MULLIGAN_BOTTOM_COUNT - left))
      const targetId = MULLIGAN_HAND_IDS[MULLIGAN_BOTTOM_COUNT - left]
      await grid.locator(`.card-slot[data-card-id="${targetId}"]`).first().click()
      await expect
        .poll(() => parseSent(sentOf(page)).some((s) => s.action === 'sendPlayerUUID' && String(s.args?.value) === targetId), { timeout: 10_000 })
        .toBeTruthy()
    }

    await expect(london).toBeHidden({ timeout: 10_000 })
    expect(parseSent(sentOf(page)).filter((s) => s.action === 'sendPlayerUUID')).toHaveLength(MULLIGAN_BOTTOM_COUNT)
    await expect(page.getByTestId('game-status')).toBeVisible({ timeout: 15_000 })

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})

test('mulligan: la ventana ofrece "Conceder" y confirma el envío de CONCEDE', { tag: '@fullflow' }, async ({ page }) => {
  await withFakeServer(() => mulliganScenario(), async () => {
    const { pageErrors } = await startGame(page, {
      prefix: 'mull3',
      tableName: TABLE.mulligan,
      deck: DECK.lands,
      simDeck: DECK.aiLands,
      autoKeepMulligan: false,
    })

    const dialog = page.getByTestId('mulligan-bar')
    await expect(dialog).toBeVisible({ timeout: 15_000 })

    const concedeBtn = dialog.getByTestId('mulligan-concede')
    await expect(concedeBtn).toBeVisible()
    await expect(concedeBtn).toBeEnabled()
    await concedeBtn.click()

    // confirmación in-app (mismo camino que el menú ⋯) y envío de CONCEDE
    await expect(page.getByTestId('confirm-modal')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('confirm-modal-ok').click()

    await expect
      .poll(
        () => parseSent(sentOf(page)).some((s) => s.action === 'sendPlayerAction' && String(s.args?.action) === 'CONCEDE'),
        { timeout: 10_000 },
      )
      .toBeTruthy()

    // al aceptarse la acción el feedback se limpia: el diálogo deja de bloquear
    await expect(dialog).toHaveCount(0, { timeout: 10_000 })

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})
