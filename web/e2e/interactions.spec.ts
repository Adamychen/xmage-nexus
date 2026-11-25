import { fakeOnly } from './support/fake-mode'
import { test, expect } from './fixtures'
fakeOnly()
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { quickStartGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { allInteractionsScenario } from '../fixtures/scenarios/allInteractions'
import { parsedLen, waitFrame } from './support/frames'

const SHOTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots')

test('interacciones completas de MTG: GAME_ASK, GAME_CHOOSE_COLOR, GAME_CHOOSE_PILE, CardGrid (tutor) y Commander', { tag: '@interactions' }, async ({ page }) => {
  fs.mkdirSync(SHOTS_DIR, { recursive: true })

  await withFakeServer(() => allInteractionsScenario(), async () => {
    const { pageErrors } = await quickStartGame(page, {
      prefix: 'int',
      skipAsks: true,
    })

    let cursor = 0

    // ─────────────────────────────────────────────────────────────
    // 1. GAME_ASK (Pregunta binaria Sí/No, ej. Shockland)
    // ─────────────────────────────────────────────────────────────
    await waitFrame(page, (f) => f.method === 'GAME_ASK', 'GAME_ASK de Shockland', 15_000, cursor)
    const askDialog = page.getByTestId('board-order')
    await expect(askDialog, 'pregunta GAME_ASK visible').toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(300)
    fs.writeFileSync(path.join(SHOTS_DIR, 'interaction-01-game-ask.png'), await page.screenshot({ fullPage: true }))

    cursor = parsedLen(page)
    const yesButton = page.getByTestId('prompt-action')
    await expect(yesButton).toHaveText(/sí|yes|confirmar/i)
    await yesButton.click()

    // ─────────────────────────────────────────────────────────────
    // 2. GAME_CHOOSE_COLOR / GAME_CHOOSE_CHOICE (Selector de color)
    // ─────────────────────────────────────────────────────────────
    await waitFrame(page, (f) => f.method === 'GAME_CHOOSE_CHOICE', 'GAME_CHOOSE_CHOICE de color', 15_000, cursor)
    const greenBtn = page.locator('.feedback-dialog .feedback-options').getByRole('button', { name: /green|verde/i }).first()
    await expect(greenBtn, 'selector de color visible').toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(300)
    fs.writeFileSync(path.join(SHOTS_DIR, 'interaction-02-choose-color.png'), await page.screenshot({ fullPage: true }))

    cursor = parsedLen(page)
    await greenBtn.click()

    // ─────────────────────────────────────────────────────────────
    // 3. GAME_CHOOSE_PILE (Elección de pila, ej. Fact or Fiction)
    // ─────────────────────────────────────────────────────────────
    await waitFrame(page, (f) => f.method === 'GAME_CHOOSE_PILE', 'GAME_CHOOSE_PILE de Fact or Fiction', 15_000, cursor)
    const pileDialog = page.locator('.pile-dialog')
    await expect(pileDialog, 'diálogo visual de piles visible').toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('pile-column-1').locator('.card-slot'), 'pila 1 con 3 cartas').toHaveCount(3)
    await expect(page.getByTestId('pile-column-2').locator('.card-slot'), 'pila 2 con 2 cartas').toHaveCount(2)
    await page.waitForTimeout(300)
    fs.writeFileSync(path.join(SHOTS_DIR, 'interaction-03-choose-pile.png'), await page.screenshot({ fullPage: true }))

    cursor = parsedLen(page)
    await page.getByTestId('pile-column-1').locator('[data-testid="pile-choose-btn"]').click()

    // ─────────────────────────────────────────────────────────────
    // 4. GAME_TARGET con CardGrid (Tutor / Búsqueda en biblioteca)
    // ─────────────────────────────────────────────────────────────
    await waitFrame(page, (f) => f.method === 'GAME_TARGET' && !!f.data?.cardsView1, 'GAME_TARGET CardGrid tutor', 15_000, cursor)
    const cardGrid = page.locator('.card-grid')
    await expect(cardGrid, 'cuadrícula CardGrid visible').toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(300)
    fs.writeFileSync(path.join(SHOTS_DIR, 'interaction-04-tutor-card-grid.png'), await page.screenshot({ fullPage: true }))

    cursor = parsedLen(page)
    const lotusCard = cardGrid.locator('[data-card-id="c-lotus"]')
    await expect(lotusCard, 'Black Lotus en CardGrid').toBeVisible({ timeout: 10_000 })
    // Cards overlap in the Arena fan: click the exposed left slice of the card button.
    await cardGrid.locator('[data-arena-card="c-lotus"] .card-grid-cell').click({ position: { x: 30, y: 120 } })

    // ─────────────────────────────────────────────────────────────
    // 6. Zona de Comando: Comandante con Impuesto de Comandante (+2)
    // ─────────────────────────────────────────────────────────────
    await waitFrame(page, (f) => f.method === 'GAME_SELECT', 'GAME_SELECT de fase principal', 15_000, cursor)
    const commanderZone = page.locator('[data-testid="hand-bar"] [data-testid="hand-trailing"]').first()
    await expect(commanderZone, 'comandante con la mano (BRD-34)').toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(300)
    fs.writeFileSync(path.join(SHOTS_DIR, 'interaction-06-commander-cast-tax.png'), await page.screenshot({ fullPage: true }))

    // ─────────────────────────────────────────────────────────────
    // 7. Hover en Carta con Desglose de Palabras Clave (MTG Keywords)
    // ─────────────────────────────────────────────────────────────
    const keywordCard = page.locator('.board-zone .card-slot:has(.keyword-badges):visible').first()
    await keywordCard.hover()
    const floatingKeywords = page.locator('.floating-card-keywords')
    await expect(floatingKeywords, 'panel de keywords flotante en hover').toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(400)
    fs.writeFileSync(path.join(SHOTS_DIR, 'interaction-07-card-hover-keywords.png'), await page.screenshot({ fullPage: true }))

    // ─────────────────────────────────────────────────────────────
    // 8. Modal de Glosario y Wiki de MTG (Botón de Ayuda ❓)
    // ─────────────────────────────────────────────────────────────
    // Move mouse away to close hover
    await page.mouse.move(0, 0)
    await page.waitForTimeout(200)

    await page.locator('[data-testid="game-menu-btn"]').click()
    const fullscreenBtn = page.locator('[data-testid="game-menu-fullscreen"]')
    await expect(fullscreenBtn, 'botón de pantalla completa en el menú ⋯').toBeVisible({ timeout: 5_000 })

    const helpBtn = page.locator('[data-testid="game-menu-help"]')
    await expect(helpBtn, 'botón de ayuda/wiki').toBeVisible({ timeout: 5_000 })
    await helpBtn.click()

    const wikiModal = page.locator('.wiki-dialog')
    await expect(wikiModal, 'modal de wiki visible').toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(300)
    fs.writeFileSync(path.join(SHOTS_DIR, 'interaction-08-wiki-glossary-modal.png'), await page.screenshot({ fullPage: true }))

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})
