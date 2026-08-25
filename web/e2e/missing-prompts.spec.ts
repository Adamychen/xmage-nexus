import { fakeOnly } from './support/fake-mode'
import { TABLE } from '../fixtures/table-names'
import { test, expect } from './fixtures'
import { FAKE_MODE } from './dual'
fakeOnly()
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { missingPromptsScenario } from '../fixtures/scenarios/missingPrompts'
import { SIM_NAME } from '../fixtures/humanGameConstants'
import { parsedLen, waitFrameAt, parseSent, sentOf } from './support/frames'
import { resolveInteger } from './support/game-screen'

const SHOTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots')

test('prompts faltantes del servidor: SELECT_PLAYER, CHOOSE_STRING (lista+libre), CHOOSE_NUMBER, CHOOSE_ONE, CHOOSE_BETWEEN, CHOOSE_MODE, CHOOSE_CARDS, TARGET_PLAYER, TARGET_AMOUNT, SELECT_CARDS, PLAY_XMANA, USER_REQUEST_DIALOG @prompts', async ({ page }) => {
  fs.mkdirSync(SHOTS_DIR, { recursive: true })

  await withFakeServer(() => missingPromptsScenario(), async () => {
    const { pageErrors } = await startGame(page, {
      prefix: 'pr',
      tableName: TABLE.missingPrompts,
      skipAsks: true,
    })

    const dialog = page.locator('.feedback-dialog')
    let cursor = 0

    async function step(method: string): Promise<void> {
      await waitFrameAt(page, (f) => f.method === method, method, 15_000, cursor)
      // refresca el cursor al índice del frame recién llegado para no re-matchear
      cursor = parsedLen(page)
      await expect(dialog).toBeVisible({ timeout: 15_000 })
      await expect(dialog).toContainText(method, { timeout: 5_000 })
      await page.waitForTimeout(150)
      fs.writeFileSync(path.join(SHOTS_DIR, `prompts-${method}.png`), await page.screenshot({ fullPage: true }))
    }

    const options = () => dialog.locator('.feedback-options button')

    // 1. GAME_SELECT_PLAYER (uuid)
    await step('GAME_SELECT_PLAYER')
    await options().filter({ hasText: SIM_NAME }).first().click()

    // 2. GAME_CHOOSE_STRING con opciones (string + lista)
    await step('GAME_CHOOSE_STRING')
    await options().filter({ hasText: /Black Lotus/i }).first().click()

    // 3. GAME_CHOOSE_STRING sin opciones (texto libre) — verifica el input arreglado
    await step('GAME_CHOOSE_STRING')
    const freeInput = page.getByLabel('Texto libre')
    await expect(freeInput).toBeVisible({ timeout: 10_000 })
    await freeInput.fill('Blinkmoth Nexus')
    await dialog.getByRole('button', { name: 'Enviar' }).click()
    expect(
      parseSent(sentOf(page)).some(
        (s) => s.action === 'sendPlayerString' && String(s.args?.value) === 'Blinkmoth Nexus',
      ),
      'el texto libre debería enviarse como sendPlayerString',
    ).toBeTruthy()

    // 4. GAME_CHOOSE_NUMBER (integer)
    await step('GAME_CHOOSE_NUMBER')
    await resolveInteger(page, 3, 'CHOOSE_NUMBER')

    // 5. GAME_CHOOSE_ONE (string + options)
    await step('GAME_CHOOSE_ONE')
    await options().first().click()

    // 6. GAME_CHOOSE_BETWEEN (string + options)
    await step('GAME_CHOOSE_BETWEEN')
    await options().first().click()

    // 7. GAME_CHOOSE_MODE (uuid + choices)
    await step('GAME_CHOOSE_MODE')
    await options().first().click()

    // 8. GAME_CHOOSE_CARDS (uuid + cardsView1, selección de 1)
    await step('GAME_CHOOSE_CARDS')
    await options().first().click()
    expect(
      parseSent(sentOf(page)).some(
        (s) => s.action === 'sendPlayerUUID' && String(s.args?.value) === 'c-a',
      ),
      'GAME_CHOOSE_CARDS debería enviar sendPlayerUUID con la carta elegida',
    ).toBeTruthy()

    // 9. GAME_TARGET_PLAYER (uuid, eligir jugador)
    await step('GAME_TARGET_PLAYER')
    await options().filter({ hasText: SIM_NAME }).first().click()

    // 10. GAME_TARGET_AMOUNT (integer, dividir daño)
    await step('GAME_TARGET_AMOUNT')
    await resolveInteger(page, 2, 'TARGET_AMOUNT')

    // 11. GAME_SELECT_CARDS (uuid + cardsView1, multi-selección de 2)
    await step('GAME_SELECT_CARDS')
    await options().nth(0).click()
    await options().nth(1).click()
    await dialog.getByRole('button', { name: /Confirmar/i }).click()
    expect(
      parseSent(sentOf(page)).filter((s) => s.action === 'sendPlayerUUID').length >= 2,
      'GAME_SELECT_CARDS debería enviar al menos 2 sendPlayerUUID',
    ).toBeTruthy()

    // 12. GAME_PLAY_XMANA (boolean)
    await step('GAME_PLAY_XMANA')
    await dialog.getByRole('button', { name: /Confirmar|sí|yes/i }).click()

    // 13. USER_REQUEST_DIALOG (botones -> sendPlayerAction)
    await step('USER_REQUEST_DIALOG')
    await dialog.getByRole('button', { name: /Rebobinar/i }).click()
    expect(
      parseSent(sentOf(page)).some(
        (s) => s.action === 'sendPlayerAction' && String(s.args?.action) === 'ROLLBACK_TURN',
      ),
      'USER_REQUEST_DIALOG debería enviar sendPlayerAction con la acción del botón pulsado',
    ).toBeTruthy()

    // fin: GAME_SELECT de prioridad
    await waitFrameAt(page, (f) => f.method === 'GAME_SELECT', 'GAME_SELECT final', 15_000, cursor)

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})
