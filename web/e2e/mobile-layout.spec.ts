import { test, expect, type Page } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { dismissSetupWizard } from './support/start-game'
import { richCommanderGame, showGame } from './support/rich-game'

fakeOnly()

test.use({ viewport: { width: 390, height: 844 } })

const V1 = { gameUi: 'v1', boardLayout: 'arena', boardLayoutManual: true }
const V2 = { gameUi: 'v2', boardLayout: 'arena', boardLayoutManual: true }

interface Box { left: number; right: number; top: number; bottom: number }

async function boxesOf(page: Page, selector: string): Promise<Box[]> {
  return page.locator(selector).evaluateAll((els) =>
    els
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })),
  )
}

function intersects(a: Box, b: Box): boolean {
  return a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5
}

async function openGame(page: Page, settings: Record<string, unknown>): Promise<void> {
  await page.goto('/')
  await dismissSetupWizard(page)
  await showGame(page, richCommanderGame(), settings)
  await expect(page.getByTestId('arena-board')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(400)
}

async function expectNoPageOverflow(page: Page): Promise<void> {
  const sizes = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
  expect(sizes.sw).toBeLessThanOrEqual(sizes.cw)
}

test.describe('phone-width layout @mobile', () => {
  test('v1: player chips stay inside their cells and the phase bar stays inside the viewport', async ({ page }) => {
    await openGame(page, V1)
    await expectNoPageOverflow(page)
    const vw = await page.evaluate(() => document.documentElement.clientWidth)

    const cells = await boxesOf(page, '.arena-opp-cell')
    const chips = await boxesOf(page, '.arena-opp-cell .player-info-bar')
    expect(chips.length).toBeGreaterThan(0)
    for (const chip of chips) {
      expect(chip.left).toBeGreaterThanOrEqual(-0.5)
      expect(chip.right).toBeLessThanOrEqual(vw + 0.5)
      const cell = cells.find((c) => chip.top >= c.top - 1 && chip.bottom <= c.bottom + 1 && chip.left >= c.left - 1 && chip.left <= c.right)
      if (cell) expect(chip.right).toBeLessThanOrEqual(cell.right + 1)
    }

    const bar = page.locator('.phase-bar')
    const barBox = await bar.boundingBox()
    expect(barBox!.x).toBeGreaterThanOrEqual(-0.5)
    expect(barBox!.x + barBox!.width).toBeLessThanOrEqual(vw + 0.5)
    const barOverflows = await bar.evaluate((el) => el.scrollWidth > el.clientWidth + 1)
    if (barOverflows) {
      expect(await bar.evaluate((el) => ['auto', 'scroll'].includes(getComputedStyle(el).overflowX))).toBe(true)
    }
  })

  test('v2: the turn title and the phase dial do not overlap the player chips or the local name and life', async ({ page }) => {
    await openGame(page, V2)
    await expectNoPageOverflow(page)
    const vw = await page.evaluate(() => document.documentElement.clientWidth)

    const title = await boxesOf(page, '[data-testid="game-status"]')
    const chips = await boxesOf(page, '.player-info-bar')
    expect(title.length).toBeGreaterThan(0)
    for (const t of title) for (const c of chips) expect(intersects(t, c)).toBe(false)

    const pips = await boxesOf(page, '.phase-dial-pip')
    expect(pips.length).toBe(6)
    const localText = await boxesOf(page, '.pz-bottom-row .player-name, .pz-bottom-row .life-value')
    expect(localText.length).toBeGreaterThan(0)
    for (const p of pips) for (const t of localText) expect(intersects(p, t)).toBe(false)
    for (const p of pips) {
      expect(p.left).toBeGreaterThanOrEqual(-0.5)
      expect(p.right).toBeLessThanOrEqual(vw + 0.5)
    }
  })
})
