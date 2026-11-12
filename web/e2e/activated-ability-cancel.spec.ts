import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { quickStartGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { framesOf, lastGameView, myBattlefield, opponentPlayer, parseFrames, parseSent, sentOf, waitFrame } from './support/frames'
import { SIM_PLAYER_ID } from '../fixtures/scenarios/humanGame'
import { abilityCancelScenario, ROD_ID } from '../fixtures/scenarios/abilityCancel'

fakeOnly()

const declines = (page: Page) =>
  parseSent(sentOf(page)).filter((s) => s.action === 'sendPlayerBoolean' && s.args?.value === false).length

async function tappedOnMyBoard(page: Page): Promise<string[]> {
  const view = lastGameView(parseFrames(framesOf(page)))
  return Object.entries(myBattlefield(view)).filter(([, p]) => p.tapped === true).map(([id]) => id)
}

async function activateRod(page: Page): Promise<void> {
  const rod = page.locator(`.player-zone .card-slot[data-card-id="${ROD_ID}"]`)
  await expect(rod).toBeVisible({ timeout: 30_000 })
  await expect(rod).toHaveClass(/playable/, { timeout: 15_000 })
  await rod.click()
  await waitFrame(page, (f) => f.method === 'GAME_CHOOSE_ABILITY', 'ability picker of Rod of Ruin')
}

/** The activation was abandoned and the board is the one before it: priority back, nothing tapped, no damage. */
async function expectBackToPriority(page: Page, declinesBefore: number): Promise<void> {
  await expect.poll(() => declines(page), { timeout: 10_000 }).toBeGreaterThan(declinesBefore)
  await expect(page.locator('[data-prompt-method]')).toHaveCount(0, { timeout: 10_000 })
  const view = lastGameView(parseFrames(framesOf(page)))
  expect(Object.values(myBattlefield(view)).filter((p) => p.tapped === true), 'nothing stays tapped').toEqual([])
  expect(opponentPlayer(view)?.life, 'the ability did not resolve').toBe(20)
  await expect(page.locator('.player-zone .card-slot[data-tapped="1"]'), 'the board shows nothing tapped').toHaveCount(0, { timeout: 10_000 })
  await expect(page.locator(`.player-zone .card-slot[data-card-id="${ROD_ID}"]`)).toHaveClass(/playable/, { timeout: 10_000 })
}

test.describe('Cancelling an activated ability', { tag: '@ability-cancel' }, () => {
  test('PRM-13: the ability picker has a Cancel button that abandons the activation', async ({ page }) => {
    await withFakeServer(abilityCancelScenario, async () => {
      const { pageErrors, helper } = await quickStartGame(page, { prefix: 'abc' })
      helper.paused = true
      await activateRod(page)
      const dialog = page.locator('.feedback-dialog')
      await expect(dialog).toBeVisible()
      const before = declines(page)
      await dialog.getByRole('button', { name: /^(Cancel|Cancelar)$/ }).click()
      await expectBackToPriority(page, before)
      expect(pageErrors).toEqual([])
    })
  })

  test('PRM-13: Escape cancels at the ability picker, the target and the payment', async ({ page }) => {
    await withFakeServer(abilityCancelScenario, async () => {
      const { pageErrors, helper } = await quickStartGame(page, { prefix: 'abe' })
      helper.paused = true

      await activateRod(page)
      await expect(page.locator('.feedback-dialog')).toBeVisible()
      let before = declines(page)
      await page.keyboard.press('Escape')
      await expectBackToPriority(page, before)

      await activateRod(page)
      await page.locator('.feedback-dialog .feedback-choice-card').first().click()
      await waitFrame(page, (f) => f.method === 'GAME_TARGET', 'target of Rod of Ruin')
      const bar = page.locator('.targeting-bar')
      await expect(bar).toBeVisible()
      await expect(bar.getByRole('button', { name: /^(Cancel|Cancelar)$/ })).toBeVisible()
      before = declines(page)
      await page.keyboard.press('Escape')
      await expectBackToPriority(page, before)

      await activateRod(page)
      await page.locator('.feedback-dialog .feedback-choice-card').first().click()
      await waitFrame(page, (f) => f.method === 'GAME_TARGET', 'target of Rod of Ruin')
      expect(await helper.playCard(SIM_PLAYER_ID), 'target the Sim').toBeTruthy()
      await waitFrame(page, (f) => f.method === 'GAME_PLAY_MANA', 'payment of Rod of Ruin')
      await expect(page.locator('.mana-prompt-bar')).toBeVisible()
      expect(await helper.playCard('land-0'), 'tap one Mountain').toBeTruthy()
      await expect.poll(() => tappedOnMyBoard(page), { timeout: 10_000 }).toContain('land-0')
      await expect(page.locator('.player-zone .card-slot[data-card-id="land-0"]')).toHaveAttribute('data-tapped', '1')
      before = declines(page)
      await page.keyboard.press('Escape')
      await expectBackToPriority(page, before)

      expect(pageErrors).toEqual([])
    })
  })
})
