import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { quickStartGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import {
  ARENA_CARDS,
  ARENA_SURVEIL_ANSWERED,
  ARENA_SURVEIL_ANSWERS,
  BOTTOM_ORDER,
  FOREIGN_TARGET,
  TOP_ORDER,
  arenaSurveilScenario,
} from '../fixtures/scenarios/arenaSurveil'
fakeOnly()

const [ELVES, BOLT, COUNTER, RITUAL] = ARENA_CARDS.map((c) => c.id as string)
const FOREIGN_UI = '.feedback-dialog, .card-grid, .card-grid-dialog'

async function grabPoint(page: Page, id: string): Promise<{ x: number; y: number }> {
  const point = await page.evaluate((cardId) => {
    const face = document.querySelector<HTMLElement>(`.arena-fan-lane > [data-arena-card="${cardId}"] .arena-fan-card`)
    if (!face) return null
    const r = face.getBoundingClientRect()
    for (let fy = 0.5; fy < 0.95; fy += 0.1) {
      for (let fx = 0.05; fx < 0.95; fx += 0.05) {
        const x = r.left + r.width * fx
        const y = r.top + r.height * fy
        const hit = document.elementFromPoint(x, y)?.closest('[data-arena-card]')
        if (hit?.getAttribute('data-arena-card') === cardId) return { x, y }
      }
    }
    return null
  }, id)
  if (!point) throw new Error(`no visible point on arena card ${id}`)
  return point
}

async function centerOf(page: Page, selector: string): Promise<{ x: number; y: number }> {
  const box = await page.locator(selector).first().boundingBox()
  if (!box) throw new Error(`no box for ${selector}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function settleFans(page: Page): Promise<void> {
  await expect(page.locator('.arena-fan.is-dealing')).toHaveCount(0)
  await page.mouse.move(1, 1)
}

async function dragCard(page: Page, id: string, to: { x: number; y: number }): Promise<void> {
  await settleFans(page)
  const from = await grabPoint(page, id)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 12, from.y - 12, { steps: 4 })
  await page.mouse.move(to.x, to.y, { steps: 16 })
  await page.mouse.up()
}

async function clickCard(page: Page, id: string): Promise<void> {
  await settleFans(page)
  const at = await grabPoint(page, id)
  await page.mouse.click(at.x, at.y)
}

async function zoneIds(page: Page, zone: 'top' | 'away'): Promise<string[]> {
  return page.locator(`[data-arena-zone="${zone}"] .arena-fan-lane > [data-arena-card]`).evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-arena-card') ?? ''))
}

async function watchForeignUi(page: Page): Promise<void> {
  await page.evaluate((selector) => {
    const w = window as unknown as { __arenaForeignSeen: string[]; __arenaForeignObserver?: MutationObserver }
    w.__arenaForeignSeen = []
    const check = () => {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) w.__arenaForeignSeen.push(el.className)
      }
    }
    check()
    w.__arenaForeignObserver = new MutationObserver(check)
    w.__arenaForeignObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] })
  }, FOREIGN_UI)
}

async function foreignUiSeen(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const w = window as unknown as { __arenaForeignSeen: string[]; __arenaForeignObserver?: MutationObserver }
    w.__arenaForeignObserver?.disconnect()
    return w.__arenaForeignSeen
  })
}

test.describe('Arena surveil and scry', { tag: '@prompts' }, () => {
  test('PRM-18: a surveil arranged by drag is answered as one chain with no other prompt shown', async ({ page }) => {
    await withFakeServer(() => arenaSurveilScenario('surveil'), async () => {
      const { pageErrors } = await quickStartGame(page, { prefix: 'asv', skipAsks: true })
      const overlay = page.getByTestId('arena-library-prompt')
      await expect(overlay).toBeVisible()
      await expect.poll(() => zoneIds(page, 'top')).toEqual([ELVES, BOLT, COUNTER])

      await dragCard(page, BOLT, await centerOf(page, '[data-arena-zone="away"] .arena-fan-lane'))
      await expect.poll(() => zoneIds(page, 'away')).toEqual([BOLT])
      await dragCard(page, COUNTER, await centerOf(page, '[data-arena-zone="top"] .arena-fan-back'))
      await expect.poll(() => zoneIds(page, 'top')).toEqual([COUNTER, ELVES])

      await watchForeignUi(page)
      await page.getByTestId('arena-library-done').click()
      await expect.poll(() => ARENA_SURVEIL_ANSWERS.length, { timeout: 5000 }).toBe(3)
      await expect(overlay).toBeHidden({ timeout: 5000 })
      await page.waitForTimeout(300)
      expect(ARENA_SURVEIL_ANSWERS).toEqual([BOLT, false, ELVES])
      expect(ARENA_SURVEIL_ANSWERED[2]).toBe(TOP_ORDER)
      expect(await foreignUiSeen(page)).toEqual([])
      expect(pageErrors).toEqual([])
    })
  })

  test('PRM-18: a scry answers the bottom order before the top order', async ({ page }) => {
    await withFakeServer(() => arenaSurveilScenario('scry'), async () => {
      const { pageErrors } = await quickStartGame(page, { prefix: 'asc', skipAsks: true })
      const overlay = page.getByTestId('arena-library-prompt')
      await expect(overlay).toBeVisible()
      await expect.poll(() => zoneIds(page, 'top')).toEqual([ELVES, BOLT, COUNTER, RITUAL])

      await clickCard(page, BOLT)
      await expect.poll(() => zoneIds(page, 'away')).toEqual([BOLT])
      await clickCard(page, RITUAL)
      await expect.poll(() => zoneIds(page, 'away')).toEqual([BOLT, RITUAL])
      await expect.poll(() => zoneIds(page, 'top')).toEqual([ELVES, COUNTER])

      await watchForeignUi(page)
      await page.getByTestId('arena-library-done').click()
      await expect.poll(() => ARENA_SURVEIL_ANSWERS.length, { timeout: 5000 }).toBe(5)
      await expect(overlay).toBeHidden({ timeout: 5000 })
      expect(ARENA_SURVEIL_ANSWERS).toEqual([BOLT, RITUAL, false, BOLT, COUNTER])
      const bottom = ARENA_SURVEIL_ANSWERED.indexOf(BOTTOM_ORDER)
      const top = ARENA_SURVEIL_ANSWERED.indexOf(TOP_ORDER)
      expect(bottom).toBeGreaterThan(-1)
      expect(top).toBeGreaterThan(bottom)
      expect(await foreignUiSeen(page)).toEqual([])
      expect(pageErrors).toEqual([])
    })
  })

  test('PRM-18: a foreign prompt after the pick is shown normally and never answered', async ({ page }) => {
    await withFakeServer(() => arenaSurveilScenario('foreign'), async () => {
      const { pageErrors } = await quickStartGame(page, { prefix: 'asf', skipAsks: true })
      const overlay = page.getByTestId('arena-library-prompt')
      await expect(overlay).toBeVisible()
      await clickCard(page, COUNTER)
      await expect.poll(() => zoneIds(page, 'away')).toEqual([COUNTER])

      await page.getByTestId('arena-library-done').click()
      const dialog = page.locator('.feedback-dialog')
      await expect(dialog).toBeVisible({ timeout: 5000 })
      await expect(dialog).toContainText(FOREIGN_TARGET)
      await expect(overlay).toBeHidden()
      await page.waitForTimeout(800)
      expect(ARENA_SURVEIL_ANSWERS).toEqual([COUNTER, false])
      await expect(dialog).toBeVisible()
      expect(pageErrors).toEqual([])
    })
  })
})
