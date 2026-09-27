import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'
import { test, expect } from './fixtures'
import { startGame } from './support/start-game'
import { combatScenario } from '../fixtures/scenarios/combat'
import { withFakeServer } from './support/fake-backend'

test('combat strikes: attackers lunge when combat damage resolves, not when they are declared', { tag: '@combat' }, async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __strikeLog: Array<{ step: string; ghosts: number }>; __combatOrder: string[] }
    w.__strikeLog = []
    w.__combatOrder = []
    const lastLife = new Map<string, string>()
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver((mutations) => {
        for (const m of mutations) {
          const target = m.target instanceof HTMLElement ? m.target : m.target.parentElement
          const bar = target?.closest<HTMLElement>('.player-info-bar')
          if (bar && m.type === 'attributes' && target?.classList.contains('took-damage')) w.__combatOrder.push('hit')
          if (bar) {
            const id = bar.dataset.playerId ?? ''
            const text = bar.querySelector('.life-value')?.textContent ?? ''
            if (lastLife.has(id) && lastLife.get(id) !== text) w.__combatOrder.push('life')
            lastLife.set(id, text)
          }
          if (m.type !== 'childList') continue
          m.addedNodes.forEach((n) => {
            if (!(n instanceof HTMLElement) || !n.classList.contains('combat-strike-ghost')) return
            const store = (window as unknown as { __mageStore?: { getState(): { game: { step?: string } | null } } }).__mageStore
            w.__strikeLog.push({ step: String(store?.getState().game?.step ?? ''), ghosts: document.querySelectorAll('.combat-strike-ghost').length })
          })
        }
      }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] })
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

    await expect.poll(() => page.evaluate(() => (window as unknown as { __combatOrder: string[] }).__combatOrder.includes('life')), { timeout: 5_000 }).toBe(true)
    const order = await page.evaluate(() => (window as unknown as { __combatOrder: string[] }).__combatOrder)
    expect(order.indexOf('hit'), `life must drop on the hit, not before the lunge: ${order.join(',')}`).toBeGreaterThanOrEqual(0)
    expect(order.indexOf('hit'), `life must drop on the hit, not before the lunge: ${order.join(',')}`).toBeLessThan(order.indexOf('life'))

    await expect.poll(() => page.locator('.combat-strike-ghost').count(), { timeout: 5_000 }).toBe(0)
    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})
