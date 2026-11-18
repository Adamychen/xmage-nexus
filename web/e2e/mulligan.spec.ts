import { fakeOnly } from './support/fake-mode'
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
import { quickStartGame } from './support/start-game'
import { framesOf, parseFrames, parseSent, sentOf } from './support/frames'

const SHOTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots')

test('PRM-2: la pantalla de mano inicial aparece y "Conservar mano" arranca la partida', { tag: '@fullflow' }, async ({ page }) => {
  fs.mkdirSync(SHOTS_DIR, { recursive: true })
  await withFakeServer(() => mulliganScenario(), async () => {
    const { pageErrors } = await quickStartGame(page, {
      prefix: 'mull',
      autoStartingPlayer: false,
    })

    // la mano inicial (GAME_ASK) se decide en una pantalla completa sobre el tablero
    const dialog = page.getByTestId('mulligan-bar')
    await expect(dialog).toBeVisible({ timeout: 15_000 })
    await expect(dialog).toContainText(/mulligan/i)
    await expect(page.getByTestId('mulligan-fan').locator('.card-slot')).toHaveCount(MULLIGAN_HAND_IDS.length)

    // screenshot de la ventana de mulligan
    const shot = await page.screenshot({ fullPage: true })
    fs.writeFileSync(path.join(SHOTS_DIR, 'mulligan-01-window.png'), shot)

    // el ask llegó al cliente (frame GAME_ASK)
    expect(parseFrames(framesOf(page)).some((f) => f.method === 'GAME_ASK' && /mulligan/i.test(String(f.data?.question ?? '')))).toBeTruthy()

    // Regresión (pasada 3 en vivo): la mano de abajo tapaba el botón Conservar
    // mano y el clic quedaba interceptado. Nada del tablero llega por delante
    // de la pantalla: el punto donde está el botón es el botón.
    const onTop = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="mulligan-keep"]') as HTMLElement
      const r = btn.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return Boolean(hit && btn.contains(hit))
    })
    expect(onTop, 'el botón Conservar mano recibe el clic, nada lo tapa').toBeTruthy()

    // Ver el tablero deja leerlo sin salir de la decisión.
    await page.getByTestId('mulligan-peek-open').click()
    await expect(page.getByTestId('mulligan-peek')).toBeVisible()
    await expect(page.locator('.mulligan-backdrop')).toHaveClass(/is-peeking/)
    await expect
      .poll(() => page.locator('.mulligan-screen').evaluate((el) => getComputedStyle(el).opacity))
      .toBe('0')
    await page.getByTestId('mulligan-peek-back').click()
    await expect(page.locator('.mulligan-backdrop')).not.toHaveClass(/is-peeking/)

    await dialog.getByRole('button', { name: /Conservar mano/ }).click()

    // el cliente envió sendPlayerBoolean(false) y la partida continúa (GAME_SELECT)
    await expect
      .poll(() => parseSent(sentOf(page)).some((s) => s.action === 'sendPlayerBoolean' && s.args?.value === false), { timeout: 10_000 })
      .toBeTruthy()
    await expect(page.getByTestId('game-status')).toBeVisible({ timeout: 15_000 })

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})

test('PRM-2: "Mulligan" abre el reparto de London (poner carta al fondo)', { tag: '@fullflow' }, async ({ page }) => {
  await withFakeServer(() => mulliganScenario(), async () => {
    const { pageErrors } = await quickStartGame(page, {
      prefix: 'mull2',
      autoStartingPlayer: false,
    })

    const dialog = page.getByTestId('mulligan-bar')
    await expect(dialog).toBeVisible({ timeout: 15_000 })

    // elegir "Mulligan" (boolean=true)
    await dialog.getByRole('button', { name: /^Mulligan/ }).click()

    const london = page.getByTestId('mulligan-screen')
    const grid = page.getByTestId('mulligan-london-grid')
    const keep = page.getByTestId('mulligan-keep')
    await expect(london).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('mulligan-title')).toContainText(String(MULLIGAN_BOTTOM_COUNT))
    await expect(grid.locator('.card-slot')).toHaveCount(MULLIGAN_HAND_IDS.length)

    // PRM-2: choosing is local and reversible, and nothing leaves the hand before the player
    // keeps it. The button stays dead until every card is chosen.
    const chosen = MULLIGAN_HAND_IDS.slice(0, MULLIGAN_BOTTOM_COUNT)
    for (const [i, id] of chosen.entries()) {
      await expect(keep).toBeDisabled()
      await grid.locator(`.card-slot[data-card-id="${id}"]`).first().click()
      await expect(page.getByTestId('mulligan-sub')).toContainText(`${i + 1}`)
    }
    await expect(keep).toBeEnabled()
    expect(parseSent(sentOf(page)).filter((s) => s.action === 'sendPlayerUUID')).toHaveLength(0)

    // Un-choosing the last one takes the button away again.
    await grid.locator(`.card-slot[data-card-id="${chosen[chosen.length - 1]}"]`).first().click()
    await expect(keep).toBeDisabled()
    await grid.locator(`.card-slot[data-card-id="${chosen[chosen.length - 1]}"]`).first().click()
    await expect(keep).toBeEnabled()

    await keep.click()
    for (const id of chosen) {
      await expect
        .poll(() => parseSent(sentOf(page)).some((s) => s.action === 'sendPlayerUUID' && String(s.args?.value) === id), { timeout: 10_000 })
        .toBeTruthy()
    }

    await expect(london).toBeHidden({ timeout: 10_000 })
    expect(parseSent(sentOf(page)).filter((s) => s.action === 'sendPlayerUUID')).toHaveLength(MULLIGAN_BOTTOM_COUNT)
    await expect(page.getByTestId('game-status')).toBeVisible({ timeout: 15_000 })

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})

test('PRM-2: la pantalla ofrece "Conceder" y confirma el envío de CONCEDE', { tag: '@fullflow' }, async ({ page }) => {
  await withFakeServer(() => mulliganScenario(), async () => {
    const { pageErrors } = await quickStartGame(page, {
      prefix: 'mull3',
      autoStartingPlayer: false,
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
