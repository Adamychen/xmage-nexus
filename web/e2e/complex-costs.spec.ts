import { test, expect } from './fixtures'
import { FAKE_MODE } from './dual'

test.skip(!FAKE_MODE, 'Solo fake: depende del guion determinista del FixtureServer.')
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { complexCostsScenario } from '../fixtures/scenarios/complexCosts'
import { parsedLen, waitFrame } from './support/frames'
import { SIM_PLAYER_ID } from '../fixtures/humanGameConstants'

const SHOTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots')

test('costes complejos de MTG: Maná Pirexiano, Kicker, Split Cards, Aventuras/MDFC y Convoke @spells', async ({ page }) => {
  fs.mkdirSync(SHOTS_DIR, { recursive: true })

  await withFakeServer(() => complexCostsScenario(), async () => {
    const { pageErrors, helper } = await startGame(page, {
      prefix: 'cst',
      tableName: 'complex-costs-test',
      deck: 'Mage Web advanced',
      simDeck: 'Mage Web advanced',
      skipAsks: true,
    })

    let cursor = 0

    // ─────────────────────────────────────────────────────────────
    // 1. Maná Pirexiano ({U/P}): Pagar 2 vidas con GAME_ASK
    // ─────────────────────────────────────────────────────────────
    await waitFrame(page, (f) => f.method === 'GAME_ASK' && /gitaxian/i.test(String(f.data?.message ?? '')), 'GAME_ASK de Gitaxian Probe', 15_000, cursor)
    const phyrexianDialog = page.locator('.feedback-dialog')
    await expect(phyrexianDialog, 'diálogo de maná pirexiano visible').toBeVisible({ timeout: 15_000 })
    await expect(phyrexianDialog.locator('.mana-badge.mana-phyrexian.mana-u'), 'símbolo de maná pirexiano').toBeVisible({ timeout: 5_000 })
    await page.waitForTimeout(300)
    fs.writeFileSync(path.join(SHOTS_DIR, 'complex-costs-01-phyrexian-mana.png'), await page.screenshot({ fullPage: true }))

    cursor = parsedLen(page)
    const payLifeBtn = phyrexianDialog.getByRole('button', { name: /sí|yes|confirmar/i }).first()
    await payLifeBtn.click()

    // ─────────────────────────────────────────────────────────────
    // 2. Kicker / Estímulo Adicional ({4}): GAME_ASK y resolución con 4 de daño
    // ─────────────────────────────────────────────────────────────
    await waitFrame(page, (f) => f.method === 'GAME_ASK' && /burst|kicker|estímulo/i.test(String(f.data?.message ?? '')), 'GAME_ASK de Kicker', 15_000, cursor)
    const kickerDialog = page.locator('.feedback-dialog')
    await expect(kickerDialog, 'diálogo de Kicker visible').toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(300)
    fs.writeFileSync(path.join(SHOTS_DIR, 'complex-costs-02-kicker-prompt.png'), await page.screenshot({ fullPage: true }))

    cursor = parsedLen(page)
    const payKickerBtn = kickerDialog.getByRole('button', { name: /sí|yes|confirmar/i }).first()
    await payKickerBtn.click()

    // Objetivo del Burst Lightning (oponente)
    await waitFrame(page, (f) => f.method === 'GAME_TARGET', 'GAME_TARGET de Burst Lightning', 15_000, cursor)
    const targetingBar = page.locator('.targeting-bar')
    await expect(targetingBar, 'barra de targeting visible').toBeVisible({ timeout: 10_000 })
    cursor = parsedLen(page)
    expect(await helper.playCard(SIM_PLAYER_ID), 'objetivo Burst Lightning a SIM').toBeTruthy()

    // ─────────────────────────────────────────────────────────────
    // 3. Cartas Dobles / Split Cards / Fuse: GAME_CHOOSE_ABILITY
    // ─────────────────────────────────────────────────────────────
    await waitFrame(page, (f) => f.method === 'GAME_CHOOSE_ABILITY' && /fire \/\/ ice/i.test(String(f.data?.message ?? '')), 'GAME_CHOOSE_ABILITY de Fire // Ice', 15_000, cursor)
    const splitDialog = page.locator('.feedback-dialog')
    await expect(splitDialog, 'diálogo de cartas dobles visible').toBeVisible({ timeout: 15_000 })
    await expect(splitDialog.getByRole('button', { name: /lanzar ice/i }), 'opción de lanzar Ice').toBeVisible({ timeout: 10_000 })
    await expect(splitDialog.getByRole('button', { name: /fusión|fuse/i }), 'opción de lanzar con Fuse').toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(300)
    fs.writeFileSync(path.join(SHOTS_DIR, 'complex-costs-03-split-card-choice.png'), await page.screenshot({ fullPage: true }))

    cursor = parsedLen(page)
    const iceBtn = splitDialog.getByRole('button', { name: /lanzar ice/i }).first()
    await iceBtn.click()

    // ─────────────────────────────────────────────────────────────
    // 4. Aventura / MDFC: GAME_CHOOSE_ABILITY (Criatura vs Aventura)
    // ─────────────────────────────────────────────────────────────
    await waitFrame(page, (f) => f.method === 'GAME_CHOOSE_ABILITY' && /bonecrusher|stomp/i.test(String(f.data?.message ?? '')), 'GAME_CHOOSE_ABILITY de Aventura', 15_000, cursor)
    const adventureDialog = page.locator('.feedback-dialog')
    await expect(adventureDialog, 'diálogo de Aventura visible').toBeVisible({ timeout: 15_000 })
    await expect(adventureDialog.getByRole('button', { name: /lanzar stomp/i }), 'opción de lanzar Aventura Stomp').toBeVisible({ timeout: 10_000 })
    await expect(adventureDialog.getByRole('button', { name: /bonecrusher giant/i }), 'opción de lanzar Criatura').toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(300)
    fs.writeFileSync(path.join(SHOTS_DIR, 'complex-costs-04-adventure-mdfc-choice.png'), await page.screenshot({ fullPage: true }))

    cursor = parsedLen(page)
    const stompBtn = adventureDialog.getByRole('button', { name: /lanzar stomp/i }).first()
    await stompBtn.click()

    // ─────────────────────────────────────────────────────────────
    // 5. Convoke / Improvise: GAME_PLAY_MANA y girar criaturas
    // ─────────────────────────────────────────────────────────────
    await waitFrame(page, (f) => f.method === 'GAME_GET_AMOUNT' && /chord of calling/i.test(String(f.data?.message ?? '')), 'GAME_GET_AMOUNT de Chord of Calling', 15_000, cursor)
    cursor = parsedLen(page)
    const amountInput = page.locator('.feedback-amount input')
    await amountInput.fill('1')
    await page.locator('.feedback-amount button.primary').click()

    await waitFrame(page, (f) => f.method === 'GAME_PLAY_MANA', 'GAME_PLAY_MANA de Convoke', 15_000, cursor)
    const manaBar = page.locator('.mana-prompt-bar')
    await expect(manaBar, 'barra de pago de maná con soporte Convoke').toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(400)
    fs.writeFileSync(path.join(SHOTS_DIR, 'complex-costs-05-convoke-creature-tap.png'), await page.screenshot({ fullPage: true }))

    cursor = parsedLen(page)
    // Gira las criaturas con Convoke vía helper
    await helper.playCard('creature-elvish-mystic')
    await helper.playCard('creature-llanowar-elves')

    const finishManaBtn = manaBar.getByRole('button', { name: /acción especial/i }).first()
    await finishManaBtn.click()

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})
