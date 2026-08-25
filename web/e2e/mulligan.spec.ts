import { fakeOnly } from './support/fake-mode'
import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'
/**
 * Mulligan (Keep + Mulligan London): con auto-keep desactivado, la ventana de
 * mulligan (FeedbackDialog con GAME_ASK) debe aparecer y poderse ejercitar.
 *  - Keep hand: la partida continúa (GAME_SELECT).
 *  - Mulligan: aparece la barra de target de London (poner carta al fondo) y al
 *    elegir la carta en mano la partida continúa. Se captura una screenshot de la
 *    ventana de mulligan.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from './fixtures'
import { FAKE_MODE } from './dual'
fakeOnly()
import { mulliganScenario, MULLIGAN_HAND_IDS } from '../fixtures/scenarios/mulligan'
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

    // la ventana de mulligan (GAME_ASK) debe pintarse
    const dialog = page.locator('.mulligan-dialog')
    await expect(dialog).toBeVisible({ timeout: 15_000 })
    await expect(dialog).toContainText(/mulligan/i)

    // screenshot de la ventana de mulligan
    const shot = await page.screenshot({ fullPage: true })
    fs.writeFileSync(path.join(SHOTS_DIR, 'mulligan-01-window.png'), shot)

    // el ask llegó al cliente (frame GAME_ASK)
    expect(parseFrames(framesOf(page)).some((f) => f.method === 'GAME_ASK' && /mulligan/i.test(String(f.data?.question ?? '')))).toBeTruthy()

    // elegir "Keep hand" (boolean=false); la UI dedicada pinta "✋ Mantener (N)"
    await page.locator('.mulligan-dialog').getByRole('button', { name: /Mantener/ }).click()

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

    const dialog = page.locator('.mulligan-dialog')
    await expect(dialog).toBeVisible({ timeout: 15_000 })

    // elegir "Mulligan" (boolean=true)
    await page.getByRole('button', { name: 'Mulligan' }).click()

    // el servidor responde con el diálogo de London (poner cartas al fondo)
    await expect(page.locator('.mulligan-dialog.mulligan-london')).toBeVisible({ timeout: 10_000 })

    // elegir la primera carta de la mano como objetivo (se pone al fondo)
    const targetId = MULLIGAN_HAND_IDS[0]
    await page.locator(`.mulligan-dialog .card-slot[data-card-id="${targetId}"]`).first().click()

    // el cliente envió el UUID y la partida continúa
    await expect
      .poll(() => parseSent(sentOf(page)).some((s) => s.action === 'sendPlayerUUID' && String(s.args?.value) === targetId), { timeout: 10_000 })
      .toBeTruthy()
    await expect(page.getByTestId('game-status')).toBeVisible({ timeout: 15_000 })

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})
