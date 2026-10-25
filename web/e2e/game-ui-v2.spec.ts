import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { dismissSetupWizard } from './support/start-game'
import { richCommanderGame, showGame } from './support/rich-game'

fakeOnly()

const V1 = { gameUi: 'v1', boardLayout: 'arena', boardLayoutManual: true }
const V2 = { gameUi: 'v2', boardLayout: 'arena', boardLayoutManual: true }

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await dismissSetupWizard(page)
  await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(300)
})

test('the classic interface can still be chosen: strip and drawer, no dial @gameui', async ({ page }) => {
  await showGame(page, richCommanderGame(), V1)
  await expect(page.getByTestId('arena-board')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('game-strip')).toBeVisible()
  await expect(page.getByTestId('phase-dial')).toHaveCount(0)
  await expect(page.getByTestId('game-topbar')).toHaveCount(0)
})

test('v2 renders the top bar, phase dial and dial action button @gameui', async ({ page }, testInfo) => {
  await showGame(page, richCommanderGame(), V2)
  await expect(page.getByTestId('arena-board')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('game-topbar')).toBeVisible()
  await expect(page.getByTestId('game-strip')).toHaveCount(0)
  await expect(page.getByTestId('phase-dial')).toBeVisible()
  await expect(page.locator('.phase-dial-pip')).toHaveText(['UPK', 'DRW', 'M1', 'CMB', 'M2', 'END'])
  await expect(page.getByTestId('phase-bar-step-PRECOMBAT_MAIN')).toHaveAttribute('data-active', 'true')
  await expect(page.locator('.pz-bottom-row .pp-stats .resource-chip .chip-icon')).toHaveCount(3)
  await expect(page.getByTestId('pp-pool')).toBeVisible()
  await expect(page.locator('.action-button-container--dial .big-action-btn')).toBeVisible()
  await page.waitForTimeout(500)
  await page.screenshot({ path: testInfo.outputPath('v2-quiet.png') })
})

const LONG_NAME = 'BlackMagicWxyz'

function waitingForLongName(): Record<string, unknown> {
  const game = richCommanderGame() as { players: Array<Record<string, unknown>>; priorityPlayerName: string }
  const me = game.players.find((p) => p.controlled)!
  me.hasPriority = false
  const mira = game.players.find((p) => p.playerId === 'p-mira')!
  mira.name = LONG_NAME
  mira.hasPriority = true
  mira.priorityTimeLeftSecs = 433
  game.priorityPlayerName = LONG_NAME
  return game
}

async function dialCentreFit(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const btn = document.querySelector<HTMLElement>('.action-button-container--dial .big-action-btn')!
    const b = btn.getBoundingClientRect()
    const cx = b.left + b.width / 2
    const cy = b.top + b.height / 2
    const radius = Math.min(b.width, b.height) / 2
    const clipped = (node: Node, rect: DOMRect): DOMRect | null => {
      let l = rect.left
      let t = rect.top
      let r = rect.right
      let bt = rect.bottom
      for (let p = node.parentElement; p && p !== btn; p = p.parentElement) {
        const o = getComputedStyle(p)
        if (o.overflowX === 'visible' && o.overflowY === 'visible') continue
        const pb = p.getBoundingClientRect()
        l = Math.max(l, pb.left)
        t = Math.max(t, pb.top)
        r = Math.min(r, pb.right)
        bt = Math.min(bt, pb.bottom)
      }
      return r > l && bt > t ? new DOMRect(l, t, r - l, bt - t) : null
    }
    const outside: string[] = []
    const broken: string[] = []
    const overflowing: string[] = []
    const lines: string[] = []
    const walker = document.createTreeWalker(btn, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent ?? ''
      for (const m of text.matchAll(/\S+/g)) {
        const range = document.createRange()
        range.setStart(n, m.index!)
        range.setEnd(n, m.index! + m[0].length)
        const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0)
        if (rects.length === 0) continue
        const tops = rects.map((r) => r.top).filter((top, i, all) => all.findIndex((o) => Math.abs(o - top) < 2) === i)
        if (tops.length > 1) broken.push(m[0])
        for (const rect of rects) {
          const vis = clipped(n, rect)
          if (!vis) continue
          lines.push(`${m[0]}@${Math.round(vis.top - b.top)}`)
          const corners = [[vis.left, vis.top], [vis.right, vis.top], [vis.left, vis.bottom], [vis.right, vis.bottom]]
          if (corners.some(([x, y]) => Math.hypot(x - cx, y - cy) > radius + 0.5)) outside.push(m[0])
        }
      }
    }
    for (const el of btn.querySelectorAll<HTMLElement>('.action-btn-content, .action-btn-content *')) {
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.display === 'inline' || el.classList.contains('action-btn-name')) continue
      if (el.scrollWidth > el.clientWidth + 1) overflowing.push(el.className.toString())
    }
    const name = btn.querySelector<HTMLElement>('.action-btn-name')
    return {
      outside,
      broken,
      overflowing,
      lines,
      nameTruncated: name ? name.scrollWidth > name.clientWidth + 1 : null,
      nameFit: name ? `${name.scrollWidth}/${name.clientWidth}` : '',
      nameText: name?.textContent ?? null,
      title: btn.title,
      label: btn.querySelector('.action-btn-label')?.textContent?.trim() ?? '',
    }
  })
}

for (const font of ['default', 'monospace'] as const) {
  test(`BRD-14: the dial centre holds "Waiting for" a 14-character name and its clock inside the circle, wrapping only between words (${font} font) @gameui`, async ({ page }, testInfo) => {
    if (font === 'monospace') await page.addStyleTag({ content: ':root { --font-ui: monospace !important; --font-display: monospace !important }' })
    await showGame(page, waitingForLongName(), V2)
    await expect(page.locator('.action-button-container--dial .big-action-btn.action-waiting')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.action-button-container--dial .action-waiting-left')).toBeVisible()
    await page.waitForTimeout(400)
    const fit = await dialCentreFit(page)
    expect(fit.label).toContain(LONG_NAME)
    expect(fit.nameText).toBe(LONG_NAME)
    expect(fit.title).toContain(LONG_NAME)
    expect(fit.broken, `no word broken across lines: ${fit.lines.join(' ')}`).toEqual([])
    expect(fit.outside, `no text past the circle: ${fit.lines.join(' ')}`).toEqual([])
    expect(fit.overflowing, 'no text box overflows').toEqual([])
    if (font === 'default') expect(fit.nameTruncated, `a 14-character name fits whole (${fit.nameFit})`).toBe(false)
    await page.getByTestId('phase-dial').screenshot({ path: testInfo.outputPath(`brd14-waiting-${font}.png`) })
  })
}

test('BRD-14: a name too long for the centre is cut with an ellipsis and stays whole in the tooltip @gameui', async ({ page }) => {
  const game = waitingForLongName() as { players: Array<Record<string, unknown>>; priorityPlayerName: string }
  const huge = 'WWWWWWWWWWWWWWWWWWWWWWWW'
  game.players.find((p) => p.playerId === 'p-mira')!.name = huge
  game.priorityPlayerName = huge
  await showGame(page, game, V2)
  await expect(page.locator('.action-button-container--dial .big-action-btn.action-waiting')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(300)
  const fit = await dialCentreFit(page)
  expect(fit.nameTruncated).toBe(true)
  expect(await page.locator('.action-button-container--dial .action-btn-name').evaluate((el) => getComputedStyle(el).textOverflow)).toBe('ellipsis')
  expect(fit.title).toContain(huge)
  expect(fit.broken).toEqual([])
  expect(fit.outside).toEqual([])
})

test.describe('BRD-14 dock corner', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('BRD-14: the bigger dial keeps its pips clear of the centre and fits its corner without covering the hand or the side panel @gameui', async ({ page }, testInfo) => {
    await showGame(page, richCommanderGame(), V2)
    await expect(page.locator('.action-button-container--dial .big-action-btn.action-priority')).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(400)
    const pass = await dialCentreFit(page)
    expect(pass.broken, pass.lines.join(' ')).toEqual([])
    expect(pass.outside, pass.lines.join(' ')).toEqual([])
    await page.getByTestId('phase-dial').screenshot({ path: testInfo.outputPath('brd14-pass.png') })
    const layout = async () =>
      page.evaluate(() => {
        const core = document.querySelector('.action-button-container--dial .big-action-btn')!.getBoundingClientRect()
        const cx = core.left + core.width / 2
        const cy = core.top + core.height / 2
        const pips = [...document.querySelectorAll('.phase-dial-pip')].map((p) => (p as HTMLElement).getBoundingClientRect())
        const centres = pips.map((p) => ({ x: p.left + p.width / 2, y: p.top + p.height / 2, r: p.width / 2 }))
        const intoCore = centres.filter((p) => Math.hypot(p.x - cx, p.y - cy) < core.width / 2 + p.r)
        const crowded = centres.slice(1).filter((p, i) => Math.hypot(p.x - centres[i].x, p.y - centres[i].y) < p.r + centres[i].r)
        const parts = [core, ...pips]
        const hit = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1
        const hand = [...document.querySelectorAll('[data-testid="hand-bar"] [data-card-id], [data-testid="hand-rail"] [data-card-id]')].map((c) => c.getBoundingClientRect()).filter((r) => r.width > 0)
        const panel = document.querySelector('[data-testid="side-panel"]')?.getBoundingClientRect() ?? null
        const vw = window.innerWidth
        const vh = window.innerHeight
        return {
          intoCore: intoCore.length,
          crowded: crowded.length,
          handCards: hand.length,
          coversHand: parts.some((p) => hand.some((h) => hit(p, h))),
          coversPanel: !!panel && panel.width > 0 && parts.some((p) => hit(p, panel)),
          inside: parts.every((p) => p.left >= -1 && p.top >= -1 && p.right <= vw + 1 && p.bottom <= vh + 1),
        }
      })
    const closed = await layout()
    expect(closed.intoCore, 'no pip overlaps the centre').toBe(0)
    expect(closed.crowded, 'pips keep their spacing').toBe(0)
    expect(closed.handCards).toBeGreaterThan(0)
    expect(closed.coversHand, 'the dial does not cover the hand').toBe(false)
    expect(closed.inside, 'the dial stays inside the window').toBe(true)
    await page.getByTestId('drawer-tab-log').click()
    await expect(page.getByTestId('side-panel')).toBeVisible()
    await page.waitForTimeout(600)
    const open = await layout()
    expect(open.coversHand, 'the dial does not cover the hand with the panel open').toBe(false)
    expect(open.coversPanel, 'the dial does not cover the side panel').toBe(false)
    expect(open.inside).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('brd14-corner-panel.png') })
  })
})

test('v2 stack deck: top card, tabs, expand and collapse @gameui', async ({ page }, testInfo) => {
  const stack = [
    { id: 's-fow', name: 'Force of Will', controllerId: 'p-mira', targets: ['s-pact'] },
    { id: 's-pact', name: 'Pact of Negation', controllerId: 'p-adam', targets: ['s-cs'] },
    { id: 's-cs', name: 'Counterspell', controllerId: 'p-mira', targets: ['s-bolt'] },
    { id: 's-bolt', name: 'Lightning Bolt', controllerId: 'p-adam', targets: ['tobias-edgar'] },
    { id: 's-rs', name: 'Rhystic Study', controllerId: 'p-mira', ability: true, targets: ['p-adam'], rules: ['Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.'] },
  ]
  await showGame(page, richCommanderGame({ stack }), V2)
  const deck = page.getByTestId('stack-deck')
  await expect(deck).toBeVisible({ timeout: 10_000 })
  await expect(deck).toHaveAttribute('data-state', 'collapsed')
  await expect(page.getByTestId('stack-count')).toHaveText('5')
  await expect(page.getByTestId('stack-deck-top')).toContainText('Mira')
  await expect(page.locator('.stack-deck-tab')).toHaveCount(4)
  await expect(page.locator('.action-btn-label').first()).toContainText(/resolve/i)
  await page.waitForTimeout(600)
  await page.screenshot({ path: testInfo.outputPath('v2-stack-collapsed.png') })

  await page.getByTestId('stack-deck-toggle').click()
  await expect(deck).toHaveAttribute('data-state', 'open')
  await expect(page.locator('.stack-trow')).toHaveCount(5)
  await page.waitForTimeout(600)
  await page.screenshot({ path: testInfo.outputPath('v2-stack-open.png') })

  await page.getByTestId('stack-deck-toggle').click()
  await expect(deck).toHaveAttribute('data-state', 'collapsed')
})

test('v2 side panel opens from the top bar and pushes the board @gameui', async ({ page }, testInfo) => {
  await showGame(page, richCommanderGame(), V2)
  await expect(page.getByTestId('game-topbar')).toBeVisible({ timeout: 10_000 })
  const board = page.getByTestId('arena-board')
  const before = await board.boundingBox()
  await page.getByTestId('drawer-tab-commander').click()
  await expect(page.getByTestId('side-panel')).toBeVisible()
  await expect(page.getByTestId('side-panel')).toHaveAttribute('data-tab', 'commander')
  await page.waitForTimeout(600)
  const after = await board.boundingBox()
  expect(after!.width).toBeLessThan(before!.width - 300)
  await page.screenshot({ path: testInfo.outputPath('v2-panel.png') })
  await page.getByTestId('side-panel-tab-log').click()
  await expect(page.getByTestId('side-panel')).toHaveAttribute('data-tab', 'log')
  await page.getByTestId('drawer-tab-log').click()
  await expect(page.getByTestId('side-panel')).toHaveCount(0)
})

test('v2 portraits show the hand count, mechanic chips and commander damage @gameui', async ({ page }, testInfo) => {
  await showGame(page, richCommanderGame(), V2)
  await expect(page.getByTestId('arena-board')).toBeVisible({ timeout: 10_000 })
  const counts = page.getByTestId('pp-hand-count')
  await expect(counts).toHaveCount(4)
  await expect(counts.filter({ hasText: '5' })).toHaveCount(1)
  await expect(counts.filter({ hasText: '3' })).toHaveCount(1)
  const mira = page.locator('.player-info-bar[data-player-id="p-mira"]')
  await expect(mira.getByTestId('commander-chip')).toHaveCount(2)
  await expect(mira.locator('.commander-chip.tone-lethal')).toContainText('21/21')
  await expect(mira.locator('.commander-chip.tone-normal')).toContainText('6/21')
  await expect(page.locator('.player-info-bar[data-player-id="p-adam"]').getByTestId('commander-chip')).toHaveCount(2)
  await expect(page.locator('.player-info-bar[data-player-id="p-tobias"] .badge-monarch .badge-label')).toBeVisible()
  await expect(page.locator('.player-info-bar[data-player-id="p-ilse"] .badge-initiative .badge-label')).toBeVisible()
  await page.waitForTimeout(500)
  await page.screenshot({ path: testInfo.outputPath('v2-portraits.png') })
})

test('HND-9: v2 hand badge opens a visible hand and announces card count changes @gameui', async ({ page }, testInfo) => {
  const game = richCommanderGame() as { players: Array<Record<string, unknown>>; opponentHands: Record<string, unknown> }
  const mira = game.players.find((p) => p.playerId === 'p-mira') as Record<string, unknown>
  mira.handCount = 5
  game.opponentHands = { Mira: { k1: { id: 'k1', name: 'Counterspell', manaValue: 2, expansionSetCode: 'lea', cardNumber: '1' } } }
  await showGame(page, game, V2)
  const portrait = page.locator('.player-info-bar[data-player-id="p-mira"]')
  const badge = portrait.getByTestId('pp-hand-count')
  await expect(badge).toBeVisible({ timeout: 10_000 })
  await expect(badge).toHaveClass(/is-viewable/)
  await expect(badge).toContainText('1/5')
  await expect(page.getByTestId('opp-hand-stack')).toHaveCount(0)
  await badge.click()
  await expect(page.getByTestId('hand-viewer')).toBeVisible()
  await page.keyboard.press('Escape')

  mira.handCount = 4
  await showGame(page, game, V2)
  await expect(portrait.getByTestId('count-flash').first()).toHaveText('-1')
  await page.waitForTimeout(500)
  await page.screenshot({ path: testInfo.outputPath('v2-hand-badge.png'), clip: { x: 0, y: 40, width: 700, height: 140 } })
})

test('BRD-17: v2 log ticker shows one line, expands to the latest actions, and opens the log panel @gameui', async ({ page }) => {
  await showGame(page, richCommanderGame(), V2, ['Adam plays Forest', 'Adam plays Swamp', 'Mira casts Counterspell', 'Tobias casts Lightning Bolt targeting Adam', 'Adam casts Pact of Negation'])
  const ticker = page.getByTestId('log-ticker')
  await expect(ticker).toBeVisible({ timeout: 10_000 })
  await expect(ticker).toHaveCSS('position', 'absolute')
  await expect(page.getByTestId('log-ticker-line')).toHaveCount(1)
  const line = page.getByTestId('log-ticker-line').locator('.log-ticker-text')
  const oneLine = await line.evaluate((el) => {
    const lh = parseFloat(getComputedStyle(el).lineHeight)
    return { h: el.getBoundingClientRect().height, lh, clipped: el.scrollWidth > el.clientWidth, ellipsis: getComputedStyle(el).textOverflow }
  })
  expect(oneLine.h, 'a single line of text').toBeLessThanOrEqual(oneLine.lh + 1)
  expect(oneLine.ellipsis).toBe('ellipsis')
  const collapsedH = (await ticker.boundingBox())!.height

  await page.getByTestId('log-ticker-toggle').click()
  await expect(page.getByTestId('log-ticker-line')).toHaveCount(4)
  await expect(page.getByTestId('side-panel')).toHaveCount(0)
  expect((await ticker.boundingBox())!.height).toBeGreaterThan(collapsedH * 2)
  await page.reload()
  await dismissSetupWizard(page)
  await showGame(page, richCommanderGame(), V2, ['Adam plays Forest', 'Adam plays Swamp', 'Mira casts Counterspell', 'Tobias casts Lightning Bolt targeting Adam', 'Adam casts Pact of Negation'])
  await expect(page.getByTestId('log-ticker-line'), 'the expanded state survives a reload').toHaveCount(4)
  await ticker.click()
  await expect(page.getByTestId('side-panel')).toHaveAttribute('data-tab', 'log')
})

test('v2 combat ledger lists the damage of the combat and totals per player @gameui', async ({ page }, testInfo) => {
  const log = [
    'Turn 7 Adam',
    'Tobias attacks Adam with Edgar Markov',
    'Edgar Markov deals 4 damage to Adam',
    'Vampire deals 1 damage to Adam',
    'Vampire deals 1 damage to Adam',
    'Korvold, Fae-Cursed King deals 7 damage to Cathar Commando',
  ]
  await showGame(page, richCommanderGame({ step: 'COMBAT_DAMAGE' }), V2, log)
  const ledger = page.getByTestId('combat-ledger')
  await expect(ledger).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('combat-ledger-row')).toHaveCount(3)
  await expect(page.getByTestId('combat-ledger-total')).toContainText('Adam')
  await expect(page.getByTestId('combat-ledger-total')).toContainText('6')
  await page.waitForTimeout(500)
  await page.screenshot({ path: testInfo.outputPath('v2-ledger.png') })
  await ledger.getByRole('button').click()
  await expect(ledger).toHaveCount(0)
})

test('v2 mechanic chips open the mechanics tab of the side panel @gameui', async ({ page }) => {
  await showGame(page, richCommanderGame(), V2)
  await expect(page.getByTestId('arena-board')).toBeVisible({ timeout: 10_000 })
  await page.locator('.player-info-bar[data-player-id="p-tobias"] .badge-monarch').click()
  await expect(page.getByTestId('side-panel')).toHaveAttribute('data-tab', 'mechanics')
  await expect(page.getByTestId('mechanics-overview')).toBeVisible()
  await expect(page.getByTestId('mech-ring')).toContainText('Adam')
  await expect(page.getByTestId('mech-dungeon')).toContainText('Lost Mine of Phandelver')
  await expect(page.getByTestId('mech-table-state')).toContainText('Tobias')
})

test('v2 arrows take the seat colour of their source and stay thin and dashed @gameui', async ({ page }) => {
  const game = richCommanderGame({ step: 'DECLARE_BLOCKERS' }) as { players: Array<Record<string, any>>; combat: unknown[]; activePlayerId: string }
  game.activePlayerId = 'p-tobias'
  game.combat = [{ attackers: { 'tobias-edgar': game.players[2].battlefield['tobias-edgar'] }, blockers: {}, defenderId: 'p-adam' }]
  await showGame(page, game, V2)
  const arrow = page.locator('.arrow-group--v2[data-arrow-from="tobias-edgar"][data-arrow-to="p-adam"] .arrow-path')
  await expect(arrow).toHaveCount(1, { timeout: 10_000 })
  await expect(arrow).toHaveAttribute('style', /--seat-2/)
  await expect(arrow).toHaveCSS('stroke-width', '2.2px')
  await expect(page.locator('.arrow-shadow')).toHaveCount(0)
})

test('HND-7: v2 hand column gives way to the fan while the side panel is open @gameui', async ({ page }) => {
  await showGame(page, richCommanderGame(), { ...V2, handRail: true, cardRender: 'rendered' })
  await expect(page.getByTestId('hand-rail')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('hand-bar')).toHaveCount(0)
  await page.getByTestId('drawer-tab-log').click()
  await expect(page.getByTestId('side-panel')).toBeVisible()
  await expect(page.getByTestId('hand-bar')).toBeVisible()
  await expect(page.getByTestId('hand-rail')).toHaveCount(0)
  await page.getByTestId('drawer-tab-log').click()
  await expect(page.getByTestId('hand-rail')).toBeVisible()
})

test.describe('narrow window', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('v2 keeps the dial, the stack deck and the top bar inside a 1280x720 window @gameui', async ({ page }, testInfo) => {
    const stack = [
      { id: 's-cs', name: 'Counterspell', controllerId: 'p-mira', targets: ['s-bolt'] },
      { id: 's-bolt', name: 'Lightning Bolt', controllerId: 'p-adam', targets: ['tobias-edgar'] },
    ]
    await showGame(page, richCommanderGame({ stack }), V2)
    await expect(page.getByTestId('stack-deck')).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(600)
    const inside = await page.evaluate(() => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const ids = ['phase-dial', 'stack-deck', 'game-topbar']
      return ids.map((id) => {
        const r = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect()
        return { id, ok: r.left >= -1 && r.top >= -1 && r.right <= vw + 1 && r.bottom <= vh + 1 }
      })
    })
    for (const entry of inside) expect(entry.ok, `${entry.id} stays inside the window`).toBe(true)
    const gap = await page.evaluate(() => {
      const deck = document.querySelector('[data-testid="stack-deck"]')!.getBoundingClientRect()
      const dial = document.querySelector('[data-testid="phase-dial"]')!.getBoundingClientRect()
      return dial.top - deck.bottom
    })
    expect(gap, 'the stack deck ends above the phase dial').toBeGreaterThanOrEqual(0)
    await page.screenshot({ path: testInfo.outputPath('v2-1280.png') })
  })
})

test('v2 always uses the arena layout, whatever the board layout setting says @gameui', async ({ page }, testInfo) => {
  await showGame(page, richCommanderGame(), { gameUi: 'v2', boardLayout: 'pod', boardLayoutManual: true })
  await expect(page.getByTestId('arena-board')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('pod-board')).toHaveCount(0)
  await page.waitForTimeout(500)
  const vh = page.viewportSize()!.height
  const bars = page.locator('.arena-board .player-info-bar')
  expect(await bars.count()).toBeGreaterThan(0)
  for (let i = 0; i < (await bars.count()); i++) {
    const box = await bars.nth(i).boundingBox()
    expect(box!.y + box!.height).toBeLessThanOrEqual(vh + 1)
  }
  await page.screenshot({ path: testInfo.outputPath('v2-forced-arena.png') })
})

async function boardCardsUnderOverlays(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const visible = (el: Element): DOMRect | null => {
      const box = el.getBoundingClientRect()
      let l = box.left
      let t = box.top
      let r = box.right
      let b = box.bottom
      for (let p = el.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p)
        if (o.overflowX === 'visible' && o.overflowY === 'visible') continue
        const pb = p.getBoundingClientRect()
        l = Math.max(l, pb.left)
        t = Math.max(t, pb.top)
        r = Math.min(r, pb.right)
        b = Math.min(b, pb.bottom)
      }
      return r > l && b > t ? new DOMRect(l, t, r - l, b - t) : null
    }
    const cards = [...document.querySelectorAll('.arena-board .bz-band .card-slot, .arena-board .bz-commander .card-slot, .arena-board .bz-marquee .card-slot')]
    const overlays = [
      ...document.querySelectorAll('.arena-board .player-info-bar, [data-testid="log-ticker"], [data-testid="combat-ledger"], [data-testid="stack-deck"], [data-testid="game-dock"]'),
    ]
    const label = (el: Element) => el.getAttribute('data-testid') ?? el.className.toString().split(' ')[0]
    const hit: string[] = []
    for (const o of overlays) {
      const r = o.getBoundingClientRect()
      if (r.width === 0) continue
      for (const c of cards) {
        const b = visible(c)
        if (!b) continue
        if (b.left < r.right - 1 && b.right > r.left + 1 && b.top < r.bottom - 1 && b.bottom > r.top + 1) hit.push(`${label(o)} <- ${c.textContent?.slice(0, 20)}`)
      }
    }
    return { hit, cards: cards.length, overlays: overlays.length }
  })
}

const STACK = [
  { id: 's-cs', name: 'Counterspell', controllerId: 'p-mira', targets: ['s-bolt'] },
  { id: 's-bolt', name: 'Lightning Bolt', controllerId: 'p-adam', targets: ['tobias-edgar'] },
  { id: 's-rs', name: 'Rhystic Study', controllerId: 'p-mira', ability: true, targets: ['p-adam'], rules: ['Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.'] },
]
const LOG = ['Turn 7 Adam', 'Tobias attacks Adam with Edgar Markov', 'Edgar Markov deals 4 damage to Adam', 'Korvold, Fae-Cursed King deals 7 damage to Cathar Commando']

for (const vp of [{ width: 1600, height: 900 }, { width: 1280, height: 720 }]) {
  test.describe(`no overlap ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp })

    for (const scenario of ['quiet', 'combat', 'stack', 'stack-open', 'spectator-quiet', 'spectator-combat']) {
      test(`v2 no battlefield card touches a portrait, the log, the ledger, the stack or the dial: ${scenario} @gameui`, async ({ page }, testInfo) => {
        const base = scenario.replace('spectator-', '')
        const game =
          base === 'combat'
            ? richCommanderGame({ step: 'COMBAT_DAMAGE' })
            : base.startsWith('stack')
              ? richCommanderGame({ stack: STACK })
              : richCommanderGame()
        if (scenario.startsWith('spectator-')) {
          for (const p of (game as { players: Array<Record<string, unknown>> }).players) p.controlled = false
        }
        await showGame(page, game, V2, LOG)
        if (base === 'combat') await expect(page.getByTestId('combat-ledger')).toBeVisible({ timeout: 10_000 })
        else if (base === 'quiet') await expect(page.getByTestId('log-ticker')).toBeVisible({ timeout: 10_000 })
        else await expect(page.getByTestId('stack-deck')).toBeVisible({ timeout: 10_000 })
        if (scenario === 'stack-open') await page.getByTestId('stack-deck-toggle').click()
        await page.mouse.move(2, 400)
        await page.waitForTimeout(900)
        const result = await boardCardsUnderOverlays(page)
        expect(result.cards).toBeGreaterThan(0)
        expect(result.hit).toEqual([])
        const crossing = await page.evaluate(() => {
          const floor = document.querySelector('.arena-board > .board-shell-divider')!.getBoundingClientRect().bottom
          return ['log-ticker', 'combat-ledger']
            .map((id) => ({ id, rect: document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect() }))
            .filter((o) => o.rect && o.rect.width > 0 && o.rect.top < floor - 1)
            .map((o) => ({ id: o.id, top: o.rect!.top }))
        })
        expect(crossing, 'floating windows stay below the divider').toEqual([])
        await page.screenshot({ path: testInfo.outputPath(`v2-${scenario}-${vp.width}.png`) })
      })
    }
  })
}

async function commanderColumn(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const box = (sel: string) => {
      const r = document.querySelector(sel)?.getBoundingClientRect()
      return r && r.width > 0 ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null
    }
    const zone = document.querySelector<HTMLElement>('.arena-board > .zone-bottom')!
    return {
      dock: zone.dataset.commanderDock ?? null,
      boardCardW: parseFloat(zone.style.getPropertyValue('--card-w')),
      commander: box('.arena-board > .zone-bottom .pz-commander'),
      cards: [...document.querySelectorAll('.arena-board > .zone-bottom .pz-commander .card-slot')].map((c) => {
        const r = c.getBoundingClientRect()
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
      }),
      log: box('[data-testid="log-ticker"]'),
      portrait: box('.arena-board > .zone-bottom .pz-bottom-row'),
      divider: box('.arena-board > .board-shell-divider'),
      battlefield: box('.arena-board > .zone-bottom .creatures-band'),
    }
  })
}

type CommanderColumn = Awaited<ReturnType<typeof commanderColumn>>

function commanderPlacement(at: CommanderColumn): string[] {
  const cmd = at.commander!
  const column = [at.log, at.portrait].filter((r): r is NonNullable<typeof r> => r !== null)
  const anchorTop = Math.min(...column.map((r) => r.top))
  const columnRight = Math.max(...column.map((r) => r.right))
  const bad: string[] = []
  if (at.dock === 'column') {
    if (Math.abs(cmd.left - Math.min(...column.map((r) => r.left))) > 2) bad.push('not left-aligned with the column')
    if (cmd.bottom > anchorTop - 4) bad.push('not above the highest overlay of the column')
    if (cmd.bottom < anchorTop - 32) bad.push('floats up the column instead of sitting on its overlay')
    if (cmd.top < at.divider!.bottom) bad.push('crosses the divider')
    if (cmd.right > columnRight + 1) bad.push('wider than the column')
    if (cmd.right > at.battlefield!.left) bad.push('reaches the battlefield')
    const floor = Math.min(at.boardCardW, 56) - 1
    for (const c of at.cards) if (c.right - c.left < floor) bad.push(`card ${Math.round(c.right - c.left)}px wide, under ${floor}px`)
  } else if (cmd.left < columnRight) {
    bad.push('in-row commander overlaps the left column')
  }
  return bad
}

function commanderFillsColumn(at: CommanderColumn): string[] {
  const cmd = at.commander!
  const column = [at.log, at.portrait].filter((r): r is NonNullable<typeof r> => r !== null)
  const columnW = Math.max(...column.map((r) => r.right)) - Math.min(...column.map((r) => r.left))
  const roomAbove = cmd.top - at.divider!.bottom
  return roomAbove > 24 && columnW - (cmd.right - cmd.left) > 24 ? [`leaves ${Math.round(roomAbove)}px above and ${Math.round(columnW - (cmd.right - cmd.left))}px beside it`] : []
}

for (const vp of [{ width: 1920, height: 1080, docks: true }, { width: 1600, height: 900, docks: true }, { width: 1280, height: 720, docks: false }]) {
  test.describe(`commander column ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test(`BRD-15: v2 docks my command zone in the left column right above the last actions, as large as the room allows, following the log as it expands or collapses @gameui`, async ({ page }, testInfo) => {
      await showGame(page, richCommanderGame(), V2, LOG)
      await expect(page.getByTestId('log-ticker')).toHaveAttribute('data-expanded', '0', { timeout: 10_000 })
      await page.mouse.move(2, 400)
      await expect.poll(async () => (await commanderColumn(page)).dock, vp.docks ? 'the one-line log leaves room above it' : 'no room above even a one-line log: stays in the row').toBe(vp.docks ? 'column' : null)
      await expect.poll(async () => commanderPlacement(await commanderColumn(page))).toEqual([])
      const collapsed = await commanderColumn(page)
      expect(collapsed.cards.length).toBeGreaterThan(0)
      if (vp.docks) expect(commanderFillsColumn(collapsed), 'the commander fills the freed space').toEqual([])
      await page.screenshot({ path: testInfo.outputPath(`v2-commander-column-${vp.width}.png`) })

      await page.getByTestId('log-ticker-toggle').click()
      await expect(page.getByTestId('log-ticker')).toHaveAttribute('data-expanded', '1')
      expect(await page.getByTestId('log-ticker-line').count()).toBeGreaterThan(1)
      await expect.poll(async () => (await commanderColumn(page)).log!.top, 'the log expanded').toBeLessThan(collapsed.log!.top - 30)
      await expect.poll(async () => commanderPlacement(await commanderColumn(page)), 'the log expanded').toEqual([])
      const expanded = await commanderColumn(page)
      if (vp.docks && expanded.dock === 'column') expect(expanded.commander!.bottom - expanded.commander!.top).toBeLessThan(collapsed.commander!.bottom - collapsed.commander!.top)
      await page.screenshot({ path: testInfo.outputPath(`v2-commander-column-expanded-${vp.width}.png`) })

      await page.getByTestId('log-ticker-toggle').click()
      await expect.poll(async () => {
        const back = await commanderColumn(page)
        return back.dock === 'column' ? Math.round(back.commander!.bottom - back.commander!.top) : null
      }, 'collapsing the log gives the room back').toBe(vp.docks ? Math.round(collapsed.commander!.bottom - collapsed.commander!.top) : null)

      await page.getByTestId('log-ticker').evaluate((el) => { el.style.display = 'none' })
      await expect.poll(async () => (await commanderColumn(page)).dock, 'the log hidden: room above the portrait').toBe('column')
      await expect.poll(async () => commanderPlacement(await commanderColumn(page)), 'the log hidden').toEqual([])
    })
  })
}

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

    test(`BRD-16: v2 the resting hand never covers my battlefield, and hovering a hand card lifts it without moving the board @gameui`, async ({ page }, testInfo) => {
      await showGame(page, richCommanderGame(), V2, LOG)
      await expect(page.getByTestId('hand-bar')).toBeVisible({ timeout: 10_000 })
      await page.mouse.move(2, 400)
      await page.waitForTimeout(600)

      const rest = await handOverBattlefield(page)
      expect(rest.hand).toBeGreaterThan(0)
      expect(rest.board.length).toBeGreaterThan(0)
      expect(rest.overlapping, 'battlefield cards under the resting hand').toEqual([])
      expect(rest.handTop - rest.boardBottom, 'gap between the battlefield and the resting hand').toBeGreaterThanOrEqual(6)
      for (const b of rest.board) expect(b.bottom, `${b.name} stays inside my zone`).toBeLessThanOrEqual(rest.zoneBottom + 1)
      await page.screenshot({ path: testInfo.outputPath(`v2-hand-rest-${vp.width}.png`) })

      const card = page.locator('.hand-bar .hand-card').first()
      await card.hover({ position: { x: 10, y: 24 } })
      await page.waitForTimeout(500)
      const hovered = await handOverBattlefield(page)
      expect(hovered.handTop, 'the hovered card rises').toBeLessThan(rest.handTop - 20)
      expect(hovered.board.map((b) => [Math.round(b.left), Math.round(b.top)]), 'hover does not move the battlefield').toEqual(rest.board.map((b) => [Math.round(b.left), Math.round(b.top)]))
      const onTop = await card.evaluate((el) => {
        const r = el.getBoundingClientRect()
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 4)
        return !!hit && !!el.closest('.hand-card-slot')?.contains(hit)
      })
      expect(onTop, 'the lifted card is drawn above the battlefield').toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`v2-hand-hover-${vp.width}.png`) })
    })
  })
}

test('v2 mana pool keeps every mana type and its label readable @gameui', async ({ page }, testInfo) => {
  const game = richCommanderGame() as { players: Array<Record<string, unknown>> }
  const me = game.players.find((p) => p.controlled) as Record<string, unknown>
  me.manaPool = { white: 1, blue: 3, black: 2, red: 2, green: 1, colorless: 2 }
  await showGame(page, game, V2)
  const pool = page.getByTestId('pp-pool')
  await expect(pool).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(500)
  const box = await pool.boundingBox()
  const inner = await pool.locator('.mana-inline').boundingBox()
  expect(inner!.x + inner!.width).toBeLessThanOrEqual(box!.x + box!.width + 1)
  const pips = pool.locator('.mana-inline-pip')
  expect(await pips.count()).toBe(6)
  for (let i = 0; i < 6; i++) {
    const b = await pips.nth(i).boundingBox()
    expect(b!.x + b!.width).toBeLessThanOrEqual(box!.x + box!.width)
    expect(b!.x).toBeGreaterThanOrEqual(inner!.x - 1)
    expect(b!.y).toBeGreaterThanOrEqual(inner!.y - 1)
    expect(b!.y + b!.height).toBeLessThanOrEqual(inner!.y + inner!.height + 1)
  }
  const overflow = await pool.locator('.mana-inline').evaluate((el) => el.scrollHeight - el.clientHeight)
  expect(overflow).toBeLessThanOrEqual(1)
  const counts = await pool.locator('.mana-inline-count').evaluateAll((els) => els.map((el) => el.scrollWidth - el.clientWidth))
  expect(counts.every((d) => d <= 1)).toBe(true)
  await expect(pool.locator('.resource-pool-label')).toHaveCount(0)
  await pool.screenshot({ path: testInfo.outputPath('v2-pool.png') })
})

for (const layout of ['pod', 'arena']) {
  test(`v2 with board layout ${layout}: last actions and the combat ledger stay inside the board and off the player boxes @gameui`, async ({ page }, testInfo) => {
    const log = [
      'Turn 7 Adam',
      'Tobias attacks Adam with Edgar Markov',
      'Edgar Markov deals 4 damage to Adam',
      'Vampire deals 1 damage to Adam',
      'Korvold, Fae-Cursed King deals 7 damage to Cathar Commando',
    ]
    await showGame(page, richCommanderGame({ step: 'COMBAT_DAMAGE' }), { gameUi: 'v2', boardLayout: layout, boardLayoutManual: true }, log)
    const ledger = page.getByTestId('combat-ledger')
    await expect(ledger).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('log-ticker')).toBeHidden()
    await page.mouse.move(2, 400)
    await page.waitForTimeout(600)
    await page.screenshot({ path: testInfo.outputPath(`v2-${layout}-ledger.png`) })
    const lb = (await ledger.boundingBox())!
    const vp = page.viewportSize()!
    expect(lb.x).toBeGreaterThanOrEqual(0)
    expect(lb.y + lb.height).toBeLessThanOrEqual(vp.height)
    for (const bar of await page.locator('.player-info-bar').all()) {
      const b = await bar.boundingBox()
      if (!b) continue
      const overlap = lb.x < b.x + b.width && lb.x + lb.width > b.x && lb.y < b.y + b.height && lb.y + lb.height > b.y
      expect(overlap, 'ledger covers a player box').toBe(false)
    }
    await ledger.getByRole('button').click()
    const ticker = page.getByTestId('log-ticker')
    await expect(ticker).toBeVisible()
    await page.waitForTimeout(300)
    const tb = (await ticker.boundingBox())!
    expect(tb.y + tb.height).toBeLessThanOrEqual(vp.height)
    for (const bar of await page.locator('.player-info-bar').all()) {
      const b = await bar.boundingBox()
      if (!b) continue
      const overlap = tb.x < b.x + b.width && tb.x + tb.width > b.x && tb.y < b.y + b.height && tb.y + tb.height > b.y
      expect(overlap, 'log ticker covers a player box').toBe(false)
    }
    await page.screenshot({ path: testInfo.outputPath(`v2-${layout}-ticker.png`) })
  })
}

test('v2 rewind sits on the left of the phase dial and the two do not overlap @gameui', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await showGame(page, richCommanderGame(), { ...V2, boardRewind: true })
  await expect(page.getByTestId('phase-dial')).toBeVisible({ timeout: 10_000 })
  for (const [id, step] of [[1, 'UPKEEP'], [2, 'DRAW']] as const) {
    await page.evaluate(
      ({ gameView, id }) => {
        const store = (globalThis as unknown as { __mageStore: { handleMessage: (m: unknown) => void } }).__mageStore
        store.handleMessage({ type: 'event', method: 'GAME_UPDATE', messageId: id, objectId: 'g-v2', data: { gameView } })
      },
      { gameView: richCommanderGame({ step }), id },
    )
  }
  const rewind = page.getByTestId('rewind-open')
  const dial = page.getByTestId('phase-dial')
  await expect(rewind).toBeVisible()
  await page.waitForTimeout(400)
  const r = (await rewind.boundingBox())!
  const d = (await dial.boundingBox())!
  expect(r.x + r.width).toBeLessThanOrEqual(d.x)
  expect(r.x + r.width / 2).toBeLessThan(d.x + d.width / 2)
  const pips = page.locator('.phase-dial-pip')
  for (let i = 0; i < (await pips.count()); i++) {
    const p = (await pips.nth(i).boundingBox())!
    expect(p.x + p.width).toBeLessThanOrEqual(1280)
  }
  await page.screenshot({ path: testInfo.outputPath('v2-rewind-left.png') })
})

test('tapping an untapped land in v2 flies a mana particle into the pool @gameui', async ({ page }) => {
  const game = richCommanderGame()
  const me = (game.players as Array<{ playerId: string; battlefield: Record<string, Record<string, unknown>> }>).find((p) => p.playerId === 'p-adam')
  if (me) me.battlefield['adam-l1'] = { ...me.battlefield['adam-l1'], rules: ['{T}: Add {B}.'], controllerId: 'p-adam' }
  await showGame(page, game, V2)
  await expect(page.getByTestId('arena-board')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('[data-card-id="adam-l1"]')).toHaveAttribute('data-tapped', '0')
  await page.waitForTimeout(1200)
  await page.evaluate(() => {
    const w = window as unknown as { __manaLanded?: boolean }
    w.__manaLanded = false
    new MutationObserver(() => {
      if (document.querySelector('.mana-pool-landed')) w.__manaLanded = true
    }).observe(document.body, { subtree: true, attributes: true, childList: true, attributeFilter: ['class'] })
  })

  const tapped = richCommanderGame()
  const tappedMe = (tapped.players as Array<{ playerId: string; battlefield: Record<string, Record<string, unknown>> }>).find((p) => p.playerId === 'p-adam')
  if (tappedMe) tappedMe.battlefield['adam-l1'] = { ...tappedMe.battlefield['adam-l1'], rules: ['{T}: Add {B}.'], controllerId: 'p-adam', tapped: true }
  await showGame(page, tapped, V2)

  const flight = await page.waitForFunction(() => {
    const particle = document.querySelector<HTMLElement>('.mana-particle')
    const pool = document.querySelector<HTMLElement>('.pp-pool [data-testid="resource-pool"]')
    if (!particle || !pool) return null
    const r = particle.getBoundingClientRect()
    const p = pool.getBoundingClientRect()
    const dx = parseFloat(particle.style.getPropertyValue('--particle-dx'))
    const dy = parseFloat(particle.style.getPropertyValue('--particle-dy'))
    return {
      startInside: r.width > 0,
      endX: parseFloat(particle.style.left) + dx,
      endY: parseFloat(particle.style.top) + dy,
      poolLeft: p.left, poolRight: p.right, poolTop: p.top, poolBottom: p.bottom,
    }
  }, undefined, { polling: 'raf', timeout: 2000 })
  const box = await flight.jsonValue() as { startInside: boolean; endX: number; endY: number; poolLeft: number; poolRight: number; poolTop: number; poolBottom: number }
  expect(box.startInside).toBe(true)
  expect(box.endX).toBeGreaterThanOrEqual(box.poolLeft)
  expect(box.endX).toBeLessThanOrEqual(box.poolRight)
  expect(box.endY).toBeGreaterThanOrEqual(box.poolTop)
  expect(box.endY).toBeLessThanOrEqual(box.poolBottom)

  await page.waitForFunction(() => (window as unknown as { __manaLanded?: boolean }).__manaLanded === true, undefined, { polling: 'raf', timeout: 5000 })
})
