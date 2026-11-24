import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { dismissSetupWizard } from './support/start-game'
import { richCommanderGame, showGame } from './support/rich-game'

fakeOnly()

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await dismissSetupWizard(page)
  await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(300)
})

const LOG = ['Turn 7 Adam', 'Tobias attacks Adam with Edgar Markov', 'Edgar Markov deals 4 damage to Adam', 'Korvold, Fae-Cursed King deals 7 damage to Cathar Commando']

test('STK-1, STK-2: the stack draws every object on the board, and the grip pushes it aside @gameui', async ({ page }, testInfo) => {
  const stack = [
    { id: 's-fow', name: 'Force of Will', controllerId: 'p-mira', targets: ['s-pact'] },
    { id: 's-pact', name: 'Pact of Negation', controllerId: 'p-adam', targets: ['s-cs'] },
    { id: 's-cs', name: 'Counterspell', controllerId: 'p-mira', targets: ['s-bolt'] },
    { id: 's-bolt', name: 'Lightning Bolt', controllerId: 'p-adam', targets: ['tobias-edgar'] },
    { id: 's-rs', name: 'Rhystic Study', controllerId: 'p-mira', ability: true, targets: ['p-adam'], rules: ['Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.'] },
  ]
  await showGame(page, richCommanderGame({ stack }))
  const zone = page.getByTestId('stack-zone')
  await expect(zone).toBeVisible({ timeout: 10_000 })
  const cards = zone.locator('.stack-card')
  await expect(cards, 'five objects, five cards').toHaveCount(5)
  await expect(cards.first(), 'the one that resolves next is in front').toHaveClass(/is-top/)
  await expect(zone.getByTestId('stack-bubble-tab'), 'and its bubble says whose it is').toContainText('Mira')
  await expect(page.locator('.action-btn-label').first()).toContainText(/resolve/i)
  await page.waitForTimeout(600)
  await page.screenshot({ path: testInfo.outputPath('stack-cascade.png') })

  await page.getByTestId('stack-push').click()
  await expect(zone).toHaveClass(/is-pushed/)
  await page.waitForTimeout(600)
  await page.screenshot({ path: testInfo.outputPath('stack-pushed.png') })

  await page.getByTestId('stack-push').click()
  await expect(zone).not.toHaveClass(/is-pushed/)
  await expect(cards, 'bringing it back keeps every object on it').toHaveCount(5)
})

test('TGT-11: an attack arrow is one colour, with nothing marching @gameui', async ({ page }) => {
  const game = richCommanderGame({ step: 'DECLARE_BLOCKERS' }) as { players: Array<Record<string, any>>; combat: unknown[]; activePlayerId: string }
  game.activePlayerId = 'p-tobias'
  game.combat = [{ attackers: { 'tobias-edgar': game.players[2].battlefield['tobias-edgar'] }, blockers: {}, defenderId: 'p-adam' }]
  await showGame(page, game)
  const arrow = page.locator('.arrow-group[data-arrow-from="tobias-edgar"][data-arrow-to="p-adam"] .arrow-path')
  await expect(arrow).toHaveCount(1, { timeout: 10_000 })
  await expect(arrow, 'one colour the whole way, not a gradient').not.toHaveCSS('stroke', /url\(/)
  await expect(arrow, 'no ladder of dashes').toHaveCSS('stroke-dasharray', 'none')
  await expect(page.locator('.arrow-group[data-arrow-from="tobias-edgar"] .arrow-shadow'), 'a dark seam under the beam').toHaveCount(1)
})

test('HND-7: the hand column gives way to the fan while the chat and log panel is open @gameui', async ({ page }) => {
  await showGame(page, richCommanderGame(), { handRail: true, cardRender: 'rendered' })
  await expect(page.getByTestId('hand-rail')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('hand-bar')).toHaveCount(0)
  await page.getByTestId('chatlog-toggle-log').click()
  await expect(page.getByTestId('chatlog-panel')).toBeVisible()
  await expect(page.getByTestId('hand-bar')).toBeVisible()
  await expect(page.getByTestId('hand-rail')).toHaveCount(0)
  await page.getByTestId('chatlog-toggle-log').click()
  await expect(page.getByTestId('hand-rail')).toBeVisible()
})

test('PNL-3: with the side panel on, the log shows at least fifteen events at 1440x900 @gameui', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const lines = [
    'Adam plays Forest',
    'Adam plays Swamp',
    'Mira casts Counterspell',
    'Tobias casts Lightning Bolt targeting Adam',
    'Adam casts Pact of Negation',
    'Tobias attacks Adam with Edgar Markov',
    'Edgar Markov deals 4 damage to Adam',
    'Adam loses 4 life',
    'Mira gains 2 life',
    'Adam draws a card',
    'Mira draws a card',
    'Tobias discards Island',
    'Adam casts Sol Ring',
    'Mira plays Island',
    'Tobias activates ability of Lotus Petal',
    'Mira casts Ninja of the Deep Hours',
    'Adam attacks with Korvold, Fae-Cursed King',
    'Mira blocks Korvold, Fae-Cursed King with Ninja of the Deep Hours',
    'Adam casts Grave Pact',
    'Tobias casts Sol Ring',
  ]
  await showGame(page, richCommanderGame(), { boardSpotlight: true }, lines)
  await expect(page.getByTestId('spotlight-board')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('chatlog-toggle-log').click()
  await expect(page.getByTestId('chatlog-panel')).toHaveAttribute('data-tab', 'log')
  const list = page.locator('.action-feed-list')
  await expect(list.locator('[data-type]')).toHaveCount(lines.length)
  const fullyVisible = await list.evaluate((el) => {
    const box = el.getBoundingClientRect()
    return [...el.querySelectorAll('[data-type]')].filter((row) => {
      const r = row.getBoundingClientRect()
      return r.top >= box.top && r.bottom <= box.bottom && r.left >= box.left && r.right <= box.right
    }).length
  })
  expect(fullyVisible, 'events fully inside the visible log at 1440x900').toBeGreaterThanOrEqual(15)
  await page.mouse.move(0, 0)
  await page.waitForTimeout(300)
  await page.screenshot({ path: testInfo.outputPath('pnl3-log.png') })
})

async function handOverBattlefield(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const rect = (el: Element) => {
      const r = el.getBoundingClientRect()
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    }
    const zone = document.querySelector('.arena-board > .zone-bottom')!
    const shell = document.querySelector('.board-shell')!.getBoundingClientRect()
    const board = [...zone.querySelectorAll('.bz-band .card-slot')].map((el) => ({ name: el.textContent?.slice(0, 16) ?? '', ...rect(el) }))
    const hand = [...document.querySelectorAll('.hand-bar .hand-card')].map(rect).map((r) => ({ ...r, bottom: Math.min(r.bottom, shell.bottom) })).filter((r) => r.bottom > r.top)
    const handTop = Math.min(...hand.map((r) => r.top))
    const boardBottom = Math.max(...board.map((r) => r.bottom))
    const overlapping = board.filter((b) => hand.some((h) => b.left < h.right - 1 && b.right > h.left + 1 && b.top < h.bottom - 1 && b.bottom > h.top + 1)).map((b) => b.name)
    return { board, hand: hand.length, handTop, boardBottom, overlapping, zoneBottom: zone.getBoundingClientRect().bottom }
  })
}

for (const vp of [{ width: 1920, height: 1080 }, { width: 1600, height: 900 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
  test.describe(`hand over battlefield ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp })

    test(`BRD-16: the resting hand never covers my battlefield, and hovering a hand card lifts it without moving the board @gameui`, async ({ page }, testInfo) => {
      await showGame(page, richCommanderGame(), {}, LOG)
      await expect(page.getByTestId('hand-bar')).toBeVisible({ timeout: 10_000 })
      await page.mouse.move(2, 400)
      let prev = ''
      await expect.poll(async () => {
        const now = JSON.stringify((await handOverBattlefield(page)).board.map((b) => [Math.round(b.left), Math.round(b.top)]))
        const settled = now === prev
        prev = now
        return settled
      }, { message: 'the board settles (BRD-21)', intervals: [500], timeout: 10_000 }).toBe(true)

      const rest = await handOverBattlefield(page)
      expect(rest.hand).toBeGreaterThan(0)
      expect(rest.board.length).toBeGreaterThan(0)
      expect(rest.overlapping, 'battlefield cards under the resting hand').toEqual([])
      expect(rest.handTop - rest.boardBottom, 'gap between the battlefield and the resting hand').toBeGreaterThanOrEqual(6)
      for (const b of rest.board) expect(b.bottom, `${b.name} stays inside my zone`).toBeLessThanOrEqual(rest.zoneBottom + 1)
      await page.screenshot({ path: testInfo.outputPath(`hand-rest-${vp.width}.png`) })

      const card = page.locator('.hand-bar .hand-card').first()
      await card.hover({ position: { x: 10, y: 24 } })
      await expect.poll(async () => (await handOverBattlefield(page)).handTop, { message: 'the hovered card rises', timeout: 2000 }).toBeLessThan(rest.handTop - 20)
      const hovered = await handOverBattlefield(page)
      expect(hovered.board.map((b) => [Math.round(b.left), Math.round(b.top)]), 'hover does not move the battlefield').toEqual(rest.board.map((b) => [Math.round(b.left), Math.round(b.top)]))
      const onTop = await card.evaluate((el) => {
        const r = el.getBoundingClientRect()
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 4)
        return !!hit && !!el.closest('.hand-card-slot')?.contains(hit)
      })
      expect(onTop, 'the lifted card is drawn above the battlefield').toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`hand-hover-${vp.width}.png`) })
    })
  })
}
