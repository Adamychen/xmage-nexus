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

    const fbDialog = page.locator('.feedback-dialog')
    const anyDialog = page.locator('.feedback-dialog, .card-grid-dialog, .targeting-bar, .mana-prompt-bar')
    let cursor = 0

    async function step(method: string, expectedText?: string): Promise<void> {
      await waitFrameAt(page, (f) => f.method === method, method, 15_000, cursor)
      // refresca el cursor al índice del frame recién llegado para no re-matchear
      cursor = parsedLen(page)
      // el diálogo ya no muestra el método en crudo (título traducido); el frame
      // de arriba verifica el protocolo y aquí anclamos el prompt por su mensaje
      await expect(anyDialog).toContainText(expectedText ?? method, { timeout: 15_000 })
      await page.waitForTimeout(150)
      fs.writeFileSync(path.join(SHOTS_DIR, `prompts-${method}.png`), await page.screenshot({ fullPage: true }))
    }

    const options = () => fbDialog.locator('.feedback-options button')

    // El CardGrid se monta sobre un .feedback-backdrop que intercepta el clic de
    // Playwright (la celda queda "cubierta"); el clic raw por evaluate dispara el
    // onClick de React igual que en producción. Igual que en reveal.spec.ts.
    async function clickCardCell(text: string): Promise<void> {
      await page.evaluate((txt) => {
        const el = Array.from(document.querySelectorAll('.card-grid-cell')).find((e) =>
          e.textContent?.includes(txt),
        ) as HTMLElement | undefined
        el?.click()
      }, text)
    }

    async function confirmCardGrid(): Promise<void> {
      await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('.card-grid-dialog button')).find((e) =>
          /Confirmar/i.test(e.textContent ?? ''),
        ) as HTMLElement | undefined
        b?.click()
      })
    }

    // 1. GAME_SELECT_PLAYER (uuid)
    await step('GAME_SELECT_PLAYER', 'Choose a player')
    await options().filter({ hasText: SIM_NAME }).first().click()

    // 2. GAME_CHOOSE_STRING con opciones (string + lista)
    await step('GAME_CHOOSE_STRING', 'choose from the list')
    await options().filter({ hasText: /Black Lotus/i }).first().click()

    // 3. GAME_CHOOSE_STRING sin opciones (texto libre) — verifica el input arreglado
    await step('GAME_CHOOSE_STRING', 'free text')
    const freeInput = page.getByLabel('Texto libre')
    await expect(freeInput).toBeVisible({ timeout: 10_000 })
    await freeInput.fill('Blinkmoth Nexus')
    await fbDialog.getByRole('button', { name: /Enviar|Confirmar/i }).click()
    expect(
      parseSent(sentOf(page)).some(
        (s) => s.action === 'sendPlayerString' && String(s.args?.value) === 'Blinkmoth Nexus',
      ),
      'el texto libre debería enviarse como sendPlayerString',
    ).toBeTruthy()

    // 4. GAME_CHOOSE_NUMBER (integer)
    await step('GAME_CHOOSE_NUMBER', 'Choose a number')
    await resolveInteger(page, 3, 'CHOOSE_NUMBER')

    // 5. GAME_CHOOSE_ONE (string + options)
    await step('GAME_CHOOSE_ONE', 'Choose one')
    await options().first().click()

    // 6. GAME_CHOOSE_BETWEEN (string + options)
    await step('GAME_CHOOSE_BETWEEN', 'Choose between')
    await options().first().click()

    // 7. GAME_CHOOSE_MODE (uuid + choices)
    await step('GAME_CHOOSE_MODE', 'Choose a mode')
    await options().first().click()

    // 8. GAME_CHOOSE_CARDS (uuid + cardsView1, selección de 1) — renderiza en CardGrid
    await step('GAME_CHOOSE_CARDS', 'Choose a card')
    await clickCardCell('Mountain')
    expect(
      parseSent(sentOf(page)).some(
        (s) => s.action === 'sendPlayerUUID' && String(s.args?.value) === 'c-a',
      ),
      'GAME_CHOOSE_CARDS debería enviar sendPlayerUUID con la carta elegida',
    ).toBeTruthy()

    // 9. GAME_TARGET_PLAYER (uuid, eligir jugador)
    await step('GAME_TARGET_PLAYER', 'Choose a player')
    await options().filter({ hasText: SIM_NAME }).first().click()

    // 10. GAME_TARGET_AMOUNT (integer, dividir daño)
    await step('GAME_TARGET_AMOUNT', 'Distribute the damage')
    await resolveInteger(page, 2, 'TARGET_AMOUNT')

    // 11. GAME_SELECT_CARDS (uuid + cardsView1, multi-selección de 2) — renderiza en CardGrid
    await step('GAME_SELECT_CARDS', 'Select up to two cards')
    await clickCardCell('Mountain')
    await clickCardCell('Island')
    await confirmCardGrid()
    expect(
      parseSent(sentOf(page)).filter((s) => s.action === 'sendPlayerUUID').length >= 2,
      'GAME_SELECT_CARDS debería enviar al menos 2 sendPlayerUUID',
    ).toBeTruthy()

    // 12. GAME_PLAY_XMANA (boolean)
    await step('GAME_PLAY_XMANA', 'Pay X mana?')
    await fbDialog.getByRole('button', { name: /Confirmar|sí|yes/i }).click()

    // 13. USER_REQUEST_DIALOG (botones -> sendPlayerAction)
    await step('USER_REQUEST_DIALOG', '¿Qué quieres hacer?')
    await fbDialog.getByRole('button', { name: /Rebobinar/i }).click()
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
