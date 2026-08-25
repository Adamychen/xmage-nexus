import { test, expect } from './fixtures'
import { FAKE_MODE } from './dual'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsedLen, waitFrame, myBattlefield, gameViewOf } from './support/frames'
import { expectFeedbackDialog, payMana, waitPlayable } from './support/game-screen'
import { startGame } from './support/start-game'

// Solo modo real: verifica contra beta.xmage.today que el servidor emite
// `mutateView` en el PermanentView y que el web lo pinta como pila mutada.
test.skip(FAKE_MODE, 'Solo real (beta.xmage.today): el fake ya lo cubre mutate.spec.ts')

const SHOTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots')

test.setTimeout(600_000)

async function permanentIdByName(page: import('@playwright/test').Page, name: string): Promise<string | null> {
  return page.evaluate((n) => {
    const g = (window as any).__mageStore?.getState?.()?.game
    const bf = (g?.battlefield ?? {}) as Record<string, any>
    for (const [id, c] of Object.entries(bf)) {
      if (c?.name === n) return id
    }
    return null
  }, name)
}

async function waitPermanent(page: import('@playwright/test').Page, name: string, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await permanentIdByName(page, name)) return
    await page.waitForTimeout(250)
  }
  throw new Error(`timeout esperando permanente ${name} en el campo`)
}

test(
  'Mutate real en beta.xmage.today: pila mutada se pinta y mutateView llega del servidor',
  { tag: '@mutate-real' },
  async ({ page }) => {
    fs.mkdirSync(SHOTS_DIR, { recursive: true })
    const { frames, pageErrors, helper } = await startGame(page, {
      prefix: 'mut',
      tableName: 'mutate-real',
      deck: 'Mage Web mutate',
      simDeck: 'Mage Web AI lands',
      deckType: 'Constructed - Pioneer',
    })
    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])

    // --- Jugar una criatura base (preferimos Elvish Mystic; si no, Gemrazer) ---
    let baseId = await waitPlayable(page, 'Elvish Mystic', { timeoutMs: 90_000, minUntapped: 1 })
    let baseName = 'Elvish Mystic'
    if (!baseId) {
      baseId = await waitPlayable(page, 'Gemrazer', { timeoutMs: 90_000, minUntapped: 1 })
      baseName = 'Gemrazer'
    }
    if (!baseId) throw new Error('ninguna criatura base fue jugable en beta (¿maná/robo?)')
    expect(await helper.playCard(baseId), `jugar ${baseName} (base)`).toBeTruthy()
    await waitPermanent(page, baseName, 25_000)
    await page.screenshot({ path: path.join(SHOTS_DIR, 'mutate-real-01-base.png'), fullPage: true })

    // --- Mutar Gemrazer sobre la criatura base ---
    const gemId = await waitPlayable(page, 'Gemrazer', { timeoutMs: 150_000, minUntapped: 3 })
    if (!gemId) throw new Error('Gemrazer no fue jugable en beta')
    const cursor0 = parsedLen(page)
    expect(await helper.playCard(gemId), 'jugar Gemrazer').toBeTruthy()

    // 1) elección de modo Cast/Mutate
    await waitFrame(page, (f) => f.method === 'GAME_CHOOSE_ABILITY', 'modo Cast/Mutate de Gemrazer', 20_000, cursor0)
    await expectFeedbackDialog(page, 'Gemrazer')
    const mutateBtn = page
      .locator('.feedback-dialog .feedback-options')
      .getByRole('button', { name: /Mutate/i })
      .first()
    await expect(mutateBtn, 'botón Mutate').toBeVisible({ timeout: 15_000 })
    await mutateBtn.click()

    // 2) GAME_TARGET: elegir Elvish Mystic en mi campo (por WS, determinista)
    const cursor1 = parsedLen(page)
    await waitFrame(
      page,
      (f) => f.method === 'GAME_TARGET' && !/discard/i.test(String(f.data?.message ?? '')),
      'GAME_TARGET del mutate',
      20_000,
      cursor1,
    )
    const elvishId = await permanentIdByName(page, baseName)
    expect(elvishId, `id de ${baseName} en el campo`).toBeTruthy()
    expect(await helper.playCard(elvishId!), `target ${baseName}`).toBeTruthy()

    // 3) posible elección de orden de pila (encima/debajo)
    const cursor2 = parsedLen(page)
    try {
      await waitFrame(
        page,
        (f) =>
          (f.method === 'GAME_CHOOSE_ABILITY' || f.method === 'GAME_CHOOSE_CHOICE') &&
          !/discard/i.test(String(f.data?.message ?? '')),
        'orden de pila mutate',
        8_000,
        cursor2,
      )
      const topBtn = page
        .locator('.feedback-dialog .feedback-options')
        .getByRole('button', { name: /top/i })
        .first()
      if (await topBtn.isVisible().catch(() => false)) await topBtn.click()
      else await page.locator('.feedback-dialog .feedback-options').getByRole('button').first().click()
    } catch {
      // algunas versiones van directo al pago de maná
    }

    // 4) pagar maná
    await payMana(page, helper)

    // 5) esperar la permanente mutada en el campo
    await waitFrame(
      page,
      (f) => {
        const bf = myBattlefield(gameViewOf(f))
        return Object.values(bf).some((p: any) => p.mutated === true)
      },
      'permanente mutada en el campo',
      30_000,
      cursor0,
    )

    // --- Assertions de render ---
    const pile = page.locator('.player-zone .card-mutate-pile')
    await expect(pile, 'pila mutada visible').toBeVisible({ timeout: 15_000 })
    await expect(pile.locator('.mutated-badge'), 'badge mutado').toBeVisible()
    await expect(pile.locator('.mutate-part'), 'partes del mutate').toHaveCount(1)
    await page.screenshot({ path: path.join(SHOTS_DIR, 'mutate-real-02-mutated.png'), fullPage: true })

    // --- forma real de mutateView (anti-drift) ---
    const mv = await page.evaluate(() => {
      const g = (window as any).__mageStore?.getState?.()?.game
      const bf = (g?.battlefield ?? {}) as Record<string, any>
      for (const c of Object.values(bf)) {
        if (c?.mutated && c?.mutateView) return c.mutateView
      }
      return null
    })
    console.log('REAL_MUTATEVIEW', JSON.stringify(mv)?.slice(0, 1000))
    expect(
      mv && typeof mv === 'object' && Object.keys(mv as object).length >= 1,
      'mutateView real presente en el cliente',
    ).toBeTruthy()

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  },
)
