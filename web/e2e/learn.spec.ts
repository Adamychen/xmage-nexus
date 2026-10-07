import { fakeOnly } from './support/fake-mode'
import { TABLE } from '../fixtures/table-names'
import { test, expect } from './fixtures'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { learnScenario, LESSON_ID } from '../fixtures/scenarios/learn'
import { parsedLen, waitFrameAt, parseSent, sentOf } from './support/frames'

fakeOnly()

const SHOTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots')

test('LEARN: elegir una Lesson del sideboard (Eyetwitch muerte → learn) @learn', async ({ page }) => {
  fs.mkdirSync(SHOTS_DIR, { recursive: true })

  await withFakeServer(() => learnScenario(), async () => {
    await startGame(page, {
      prefix: 'learn',
      tableName: TABLE.learn,
      skipAsks: true, // el helper no auto-contesta: el SÍ del learn lo da el test
    })

    let cursor = 0

    // 1. GAME_ASK chooseUse del LearnEffect — responder SÍ en la AskBar
    await waitFrameAt(page, (f) => f.method === 'GAME_ASK', 'GAME_ASK learn', 15_000, cursor)
    cursor = parsedLen(page)
    const askBar = page.locator('.ask-prompt-bar').filter({ hasText: /Lesson/i })
    await expect(askBar).toBeVisible({ timeout: 15_000 })
    await page.screenshot({ path: path.join(SHOTS_DIR, 'learn-ask.png'), fullPage: true })
    await askBar.getByRole('button', { name: /sí|yes/i }).click()

    // 2. GAME_TARGET "Select a Lesson card" (forma real del overload Cards:
    //    targets null + possibleTargets en options + cardsView1 con la Lesson).
    //    Debe renderizar el CardGrid con la Lesson seleccionable.
    await waitFrameAt(page, (f) => f.method === 'GAME_TARGET', 'GAME_TARGET lesson', 15_000, cursor)
    cursor = parsedLen(page)
    const grid = page.locator('.card-grid-dialog')
    await expect(grid).toBeVisible({ timeout: 15_000 })
    await expect(grid).toContainText('Environmental Sciences')

    // El clic sobre la celda debe enviar sendPlayerUUID con el id REAL de la
    // Lesson (mismo camino que un humano: CardGrid → sendSingle → sendPlayerUUID).
    await page.evaluate((id) => {
      const el = Array.from(document.querySelectorAll('.card-grid-cell')).find(
        (e) => e.querySelector(`[data-card-id="${id}"]`) ?? e.innerHTML.includes(id),
      ) as HTMLElement | undefined
      if (!el) throw new Error('celda de la Lesson no encontrada en el CardGrid')
      el.click()
    }, LESSON_ID)

    await expect
      .poll(() => parseSent(sentOf(page)).some((s) => s.action === 'sendPlayerUUID' && String(s.args?.value) === LESSON_ID), {
        timeout: 10_000,
      })
      .toBe(true)

    await page.screenshot({ path: path.join(SHOTS_DIR, 'learn-picked.png'), fullPage: true })
  })
})