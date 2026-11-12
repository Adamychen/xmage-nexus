import { fakeOnly } from './support/fake-mode'
import { test, expect } from './fixtures'
fakeOnly()
import type { Page } from '@playwright/test'
import { combatHumanAttackScenario, combatHumanBlockScenario } from '../fixtures/scenarios/combatHuman'
import { withFakeServer } from './support/fake-backend'
import { quickStartGame } from './support/start-game'
import { framesOf, parseFrames, parseSent, sentOf } from './support/frames'
import { waitScene } from './support/scene'

function sentUUIDs(page: Page, id: string): number {
  return parseSent(sentOf(page)).filter((s) => s.action === 'sendPlayerUUID' && String(s.args?.value) === id).length
}

function emptyDeclarations(page: Page, key: 'possibleAttackers' | 'possibleBlockers'): number {
  return parseFrames(framesOf(page)).filter((f) => {
    const list = (f.data?.options as Record<string, unknown> | undefined)?.[key]
    return f.method === 'GAME_SELECT' && Array.isArray(list) && list.length === 0
  }).length
}

async function clickCard(page: Page, id: string): Promise<void> {
  await page.locator(`[data-card-id="${id}"]`).first().click()
}

const mainButton = (page: Page) => page.locator('.big-action-btn').first()

test('CMB-1: a declared attacker is removed by clicking it again, as many times as the player wants', { tag: '@combat' }, async ({ page }) => {
  await withFakeServer(() => combatHumanAttackScenario(), async () => {
    const { pageErrors } = await quickStartGame(page, { prefix: 'cbu', skipCombat: true })
    const combat = await waitScene(page, 'combat', (c) => c.active && c.mode === 'attack', 'attack window', 25_000)
    const id = combat.selectable[0]

    for (let round = 1; round <= 2; round++) {
      await clickCard(page, id)
      await waitScene(page, 'combat', (c) => c.chosen.includes(id), `attacker declared (${round})`)
      await clickCard(page, id)
      await expect.poll(() => sentUUIDs(page, id), { message: `second click sends the UUID (${round})` }).toBe(round * 2)
      await waitScene(page, 'combat', (c) => c.active && !c.chosen.includes(id), `attacker removed (${round})`)
      await expect(page.locator(`[data-card-id="${id}"].attacking`)).toHaveCount(0)
    }
    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})

test('CMB-1, CMB-12: once every attacker is declared the window stays open, an attacker can still be removed, and only the confirm ends it', { tag: '@combat' }, async ({ page }) => {
  await withFakeServer(() => combatHumanAttackScenario(), async () => {
    const { pageErrors } = await quickStartGame(page, { prefix: 'cbw', skipCombat: true })
    const combat = await waitScene(page, 'combat', (c) => c.active && c.mode === 'attack', 'attack window', 25_000)
    const ids = [...combat.selectable]
    for (const id of ids) {
      await clickCard(page, id)
      await waitScene(page, 'combat', (c) => c.chosen.includes(id), `attacker ${id} declared`)
    }
    await expect.poll(() => emptyDeclarations(page, 'possibleAttackers'), { message: 'the server lists nobody left to pick' }).toBe(1)
    await expect(page.getByRole('button', { name: 'Confirmar atacantes', exact: true }).first()).toBeVisible()
    await expect(mainButton(page)).toContainText(/Confirmar atacantes/i)

    await clickCard(page, ids[0])
    await waitScene(page, 'combat', (c) => c.active && !c.chosen.includes(ids[0]), 'attacker removed from a full declaration')
    await clickCard(page, ids[0])
    await waitScene(page, 'combat', (c) => c.chosen.includes(ids[0]), 'attacker declared again')
    await expect.poll(() => emptyDeclarations(page, 'possibleAttackers')).toBe(2)
    await expect(mainButton(page)).toContainText(/Confirmar atacantes/i)

    await page.getByRole('button', { name: 'Confirmar atacantes', exact: true }).first().click()
    await expect(page.locator('.player-info-bar.opp .life-value')).toHaveText('19', { timeout: 20_000 })
    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})

test('CMB-1, CMB-12: once every blocker is declared the window stays open and a blocker can still be removed', { tag: '@combat' }, async ({ page }) => {
  await withFakeServer(() => combatHumanBlockScenario(), async () => {
    const { pageErrors } = await quickStartGame(page, { prefix: 'cbv', skipCombat: true })
    const combat = await waitScene(page, 'combat', (c) => c.active && c.mode === 'block', 'block window', 25_000)
    const ids = [...combat.selectable]
    for (const id of ids) {
      await clickCard(page, id)
      await waitScene(page, 'combat', (c) => c.chosen.includes(id), `blocker ${id} declared`)
    }
    await expect.poll(() => emptyDeclarations(page, 'possibleBlockers'), { message: 'the server lists nobody left to pick' }).toBe(1)
    await expect(page.getByRole('button', { name: 'Confirmar bloqueadores', exact: true }).first()).toBeVisible()
    await expect(mainButton(page)).toContainText(/Confirmar bloqueadores/i)

    const id = ids[0]
    const before = sentUUIDs(page, id)
    await clickCard(page, id)
    await expect.poll(() => sentUUIDs(page, id), { message: 'clicking the blocker again sends its UUID' }).toBe(before + 1)
    await waitScene(page, 'combat', (c) => c.active && !c.chosen.includes(id), 'blocker removed')
    await expect(page.locator(`[data-card-id="${id}"].blocking`)).toHaveCount(0)
    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})
