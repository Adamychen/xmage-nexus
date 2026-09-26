import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'
import { test, expect } from './fixtures'
import { startGame } from './support/start-game'
import { combatScenario } from '../fixtures/scenarios/combat'
import { withFakeServer } from './support/fake-backend'

test('combat strikes: attackers lunge when combat damage resolves, not when they are declared', { tag: '@combat' }, async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __strikeLog: Array<{ step: string; ghosts: number }> }
    w.__strikeLog = []
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver((mutations) => {
        for (const m of mutations) {
          m.addedNodes.forEach((n) => {
            if (!(n instanceof HTMLElement) || !n.classList.contains('combat-strike-ghost')) return
            const store = (window as unknown as { __mageStore?: { getState(): { game: { step?: string } | null } } }).__mageStore
            w.__strikeLog.push({ step: String(store?.getState().game?.step ?? ''), ghosts: document.querySelectorAll('.combat-strike-ghost').length })
          })
        }
      }).observe(document.body, { childList: true, subtree: true })
    })
  })

  await withFakeServer(() => combatScenario(), async () => {
    const { pageErrors } = await startGame(page, {
      prefix: 'cs',
      tableName: TABLE.combat,
      deck: DECK.lands,
      simDeck: DECK.combatSim,
    })

    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __strikeLog: unknown[] }).__strikeLog.length), { timeout: 30_000 })
      .toBeGreaterThan(0)

    const log = await page.evaluate(() => (window as unknown as { __strikeLog: Array<{ step: string }> }).__strikeLog)
    const early = log.filter((e) => e.step === 'DECLARE_ATTACKERS' || e.step === 'DECLARE_BLOCKERS')
    expect(early, `strikes must not start before damage: ${JSON.stringify(log)}`).toEqual([])

    await expect.poll(() => page.locator('.combat-strike-ghost').count(), { timeout: 5_000 }).toBe(0)
    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})
