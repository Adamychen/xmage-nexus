import { test, expect, type Page } from '@playwright/test'

const PHONE = { width: 390, height: 844 }
const WIDE = { width: 1440, height: 900 }

async function openEntry(page: Page, id: string) {
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (route) => route.abort())
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('nexus_lang', 'en')
  })
  await page.goto('/#/gallery')
  await expect(page.locator('[data-gallery]')).toBeVisible({ timeout: 30_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.locator(`[data-gallery-entry="${id}"]`).click()
  await expect(page.locator(`[data-gallery-stage="${id}"]`)).toBeAttached({ timeout: 15_000 })
  await expect(page.getByTestId('tournament-bracket')).toBeVisible()
  await page.evaluate(() => {
    const side = document.querySelector('.gallery-sidebar') as HTMLElement | null
    if (side) side.style.display = 'none'
  })
}

function sideways(page: Page) {
  return page.evaluate(() => {
    const body = document.querySelector('.tournament-modal-scroll') as HTMLElement
    const panel = document.querySelector('.dlg-panel.tournament-modal') as HTMLElement
    return { body: body.scrollWidth - body.clientWidth, panel: panel.scrollWidth - panel.clientWidth }
  })
}

const ENTRIES = [
  'screen:tournament-inprogress',
  'screen:tournament-finished',
  'screen:tournament-waiting',
  'screen:tournament-elimination',
  'screen:tournament-elimination-finished',
]

test.describe('Tournament bracket layout', { tag: '@tournament' }, () => {
  for (const id of ENTRIES) {
    test(`TRN-19: ${id} has no sideways overflow in the dialog at 390 and 1440 px`, async ({ page }) => {
      await page.setViewportSize(PHONE)
      await openEntry(page, id)
      const phone = await sideways(page)
      expect(phone.body).toBeLessThanOrEqual(1)
      expect(phone.panel).toBeLessThanOrEqual(1)
      await page.setViewportSize(WIDE)
      const wide = await sideways(page)
      expect(wide.body).toBeLessThanOrEqual(1)
      expect(wide.panel).toBeLessThanOrEqual(1)
    })
  }

  test('TRN-19: on a phone the header, the rounds and the switch are visible and one section at a time is shown', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await openEntry(page, 'screen:tournament-inprogress')
    await expect(page.getByTestId('tournament-header')).toBeVisible()
    await expect(page.getByTestId('bracket-switch')).toBeVisible()
    await expect(page.getByTestId('bracket-rounds-section')).toBeVisible()
    await expect(page.getByTestId('bracket-standings-section')).toHaveCount(0)
    const header = await page.getByTestId('tournament-header').boundingBox()
    const chips = await page.locator('.trn-chips .ui-chip').evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().right))
    expect(header).not.toBeNull()
    for (const right of chips) expect(right).toBeLessThanOrEqual(header!.x + header!.width + 1)
    await page.getByTestId('switch-standings').click()
    await expect(page.getByTestId('bracket-standings-section')).toBeVisible()
    await expect(page.getByTestId('bracket-rounds-section')).toHaveCount(0)
    await expect(page.getByTestId('standings-table')).toBeVisible()
  })

  test('TRN-19: on a wide screen the standings sit beside the rounds without scrolling', async ({ page }) => {
    await page.setViewportSize(WIDE)
    await openEntry(page, 'screen:tournament-inprogress')
    await expect(page.getByTestId('bracket-switch')).toHaveCount(0)
    const rounds = await page.getByTestId('bracket-rounds-section').boundingBox()
    const standings = await page.getByTestId('bracket-standings-section').boundingBox()
    expect(rounds && standings).toBeTruthy()
    expect(Math.abs(rounds!.y - standings!.y)).toBeLessThan(2)
    expect(standings!.x).toBeGreaterThan(rounds!.x)
  })

  test('TRN-13: the elimination entry draws the tree as three columns and a champion box on a wide screen', async ({ page }) => {
    await page.setViewportSize(WIDE)
    await openEntry(page, 'screen:tournament-elimination')
    const rounds = page.getByTestId('tree-round')
    await expect(rounds).toHaveCount(3)
    const titles = await rounds.locator('h4').allTextContents()
    expect(titles).toEqual(['Quarterfinal', 'Semifinal', 'Final'])
    const boxes = await rounds.evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect()))
    expect(boxes[0].left).toBeLessThan(boxes[1].left)
    expect(boxes[1].left).toBeLessThan(boxes[2].left)
    expect(Math.abs(boxes[0].top - boxes[2].top)).toBeLessThan(2)
    await expect(page.getByTestId('tree-champion-box')).toHaveText('Champion: to be decided')
    await expect(page.getByTestId('tournament-no-rounds')).toHaveCount(0)
  })

  test('TRN-13: at 1440 px the elimination tree spans the dialog, its four columns fit without sideways scroll, and the standings sit below it', async ({ page }) => {
    await page.setViewportSize(WIDE)
    await openEntry(page, 'screen:tournament-elimination')
    const tree = page.getByTestId('elimination-tree')
    const treeBox = await tree.boundingBox()
    const dialogBox = await page.locator('.dlg-panel.tournament-modal').boundingBox()
    expect(treeBox && dialogBox).toBeTruthy()
    expect(treeBox!.width).toBeGreaterThan(dialogBox!.width * 0.85)
    expect(await tree.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
    const champion = await page.getByTestId('tree-champion').boundingBox()
    expect(champion!.x + champion!.width).toBeLessThanOrEqual(treeBox!.x + treeBox!.width + 1)
    const standings = await page.getByTestId('bracket-standings-section').boundingBox()
    expect(standings!.y).toBeGreaterThanOrEqual(treeBox!.y + treeBox!.height - 1)
  })

  test('TRN-13: at 1440 px both semifinals are drawn, each centred between the two quarterfinals that feed it', async ({ page }) => {
    await page.setViewportSize(WIDE)
    await openEntry(page, 'screen:tournament-elimination')
    const centres = async (round: number) => (await page.getByTestId('tree-round').nth(round).getByTestId('tree-slot').evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect()
        return r.top + r.height / 2
      }),
    ))
    const quarter = await centres(0)
    const semi = await centres(1)
    expect(semi).toHaveLength(2)
    expect(Math.abs(semi[0] - (quarter[0] + quarter[1]) / 2)).toBeLessThan(2)
    expect(Math.abs(semi[1] - (quarter[2] + quarter[3]) / 2)).toBeLessThan(2)
    const dialogBox = await page.locator('.dlg-panel.tournament-modal').boundingBox()
    const cards = await page.getByTestId('tree-round').nth(1).locator('.trn-match').evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().toJSON()))
    expect(cards).toHaveLength(2)
    for (const card of cards) expect(card.left).toBeGreaterThanOrEqual(dialogBox!.x)
  })

  test('TRN-13: the elimination tree on a phone is a list per round with no sideways scroll', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await openEntry(page, 'screen:tournament-elimination-finished')
    await expect(page.getByTestId('elimination-tree')).toHaveClass(/is-stacked/)
    await expect(page.getByTestId('tree-round')).toHaveCount(3)
    await expect(page.getByTestId('tree-champion-name')).toHaveText('alice')
    const tree = await page.getByTestId('elimination-tree').evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(tree).toBeLessThanOrEqual(1)
  })

  test('TRN-18: the construction entry shows the countdown, a progress bar and who is ready instead of an empty box', async ({ page }) => {
    await page.setViewportSize(WIDE)
    await openEntry(page, 'screen:tournament-waiting')
    await expect(page.getByTestId('construct-countdown')).toHaveText(/^\d+:\d{2}$/)
    await expect(page.getByTestId('construct-total')).toHaveText('left of 10:00')
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '600')
    await expect(page.getByTestId('construct-ready')).toHaveText('3 of 8 ready')
    await expect(page.getByTestId('construct-player')).toHaveCount(8)
    await expect(page.getByTestId('tournament-no-rounds')).toHaveCount(0)
    await expect(page.getByRole('tablist')).toHaveCount(0)
  })

  test('TRN-18: the finished Swiss entry shows its podium above the standings and the Finished chip', async ({ page }) => {
    await page.setViewportSize(WIDE)
    await openEntry(page, 'screen:tournament-finished')
    await expect(page.getByTestId('tournament-state')).toHaveText('Finished')
    const places = page.getByTestId('podium-place')
    await expect(places).toHaveCount(3)
    await expect(places.first().locator('.trn-podium-name')).toHaveText('alice')
    await expect(page.getByTestId('tournament-dates')).toContainText('From ')
  })
})
