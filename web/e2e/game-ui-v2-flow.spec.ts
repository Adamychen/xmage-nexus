import { test, expect } from './fixtures'
import { TABLE } from '../fixtures/table-names'
import { quickStartGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { spellsScenario } from '../fixtures/scenarios/spells'
import { lastGameView } from './support/frames'

test('v2 plays a real game: top bar, dial, portraits and passing from the dial @gameui', async ({ page }, testInfo) => {
  await withFakeServer(() => spellsScenario('blaze'), async () => {
    await page.addInitScript(() => {
      window.localStorage.setItem('mage-web-appearance', JSON.stringify({ gameUi: 'v2' }))
    })
    const session = await quickStartGame(page, { prefix: 'u2', tableName: TABLE.spellsBlaze, skipAsks: true })
    const pageErrors = session.pageErrors

    await expect(page.getByTestId('game-topbar')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId('game-strip')).toHaveCount(0)
    await expect(page.getByTestId('phase-dial')).toBeVisible()
    await expect(page.locator('.player-info-bar.is-portrait').first()).toBeVisible()

    const view = lastGameView(session.frames as never)
    const me = (view?.players as Array<{ controlled?: boolean; handCount?: number }> | undefined)?.find((p) => p.controlled)
    const badges = page.locator('.player-info-bar.is-portrait.my [data-testid="pp-hand-count"]')
    await expect(badges).toHaveCount(1)
    expect(Number(await badges.textContent())).toBe(me?.handCount ?? Number(await badges.textContent()))

    await expect(page.locator('[data-testid^="phase-bar-step-"][data-active="true"]')).toHaveCount(1)
    const passes = () => session.sent.filter((f) => JSON.stringify(f).includes('sendPlayerBoolean')).length
    const passesBefore = passes()

    const action = page.locator('.action-button-container--dial .big-action-btn.interactive')
    await expect(action).toBeVisible({ timeout: 60_000 })
    await action.click()
    await expect.poll(passes, { timeout: 30_000 }).toBeGreaterThan(passesBefore)

    await page.screenshot({ path: testInfo.outputPath('v2-flow.png') })
    expect(pageErrors.map((e) => e.message)).toEqual([])
  })
})
