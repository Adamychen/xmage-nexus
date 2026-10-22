import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { dismissSetupWizard } from './support/start-game'
import { dismissInfoWindows } from './support/info-windows'
import type { Page } from '@playwright/test'

fakeOnly()

const HIDDEN_NAME = 'Hidden Gem'
const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1920x1080', width: 1920, height: 1080 },
] as const

function land(id: string, name: string) {
  return { id, name, parentId: id, cardTypes: ['Land'], tapped: false, manaValue: 0, expansionSetCode: '', cardNumber: '0' }
}

function creature(id: string, name: string) {
  return { id, name, parentId: id, cardTypes: ['Creature'], power: '2', toughness: '2', tapped: false, manaValue: 2, expansionSetCode: '', cardNumber: '0' }
}

function faceDownPermanent(id: string) {
  return { id, name: HIDDEN_NAME, parentId: id, cardTypes: ['Creature'], power: '2', toughness: '2', tapped: false, faceDown: true, manaValue: 0, expansionSetCode: '', cardNumber: '0' }
}

function fourPlayerGame() {
  const mkPlayer = (id: string, name: string, controlled: boolean, battlefield: Record<string, unknown>, handCount = 0) => ({
    playerId: id,
    name,
    life: 40,
    controlled,
    isActive: controlled,
    hasPriority: controlled,
    isHuman: controlled,
    defeated: false,
    left: false,
    battlefield,
    handCount,
    libraryCount: 40,
    counters: [],
    commandList: [{ id: `cmd-${id}`, name: `Commander ${name}`, mageObjectType: 'COMMANDER' }],
    designationNames: [],
    manaPool: { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 },
    timers: {},
  })
  return {
    players: [
      mkPlayer('p1', 'Alice', true, {
        'me-land-1': land('me-land-1', 'Forest'),
        'me-land-2': land('me-land-2', 'Island'),
        'me-c-1': creature('me-c-1', 'Grizzly Bears'),
      }, 2),
      mkPlayer('p2', 'Bob', false, {
        'bob-land-1': land('bob-land-1', 'Swamp'),
        'bob-c-1': creature('bob-c-1', 'Llanowar Elves'),
      }, 3),
      mkPlayer('p3', 'Carol', false, {
        'carol-land-1': land('carol-land-1', 'Plains'),
        'carol-c-1': creature('carol-c-1', 'Serra Angel'),
        'carol-hidden-1': faceDownPermanent('carol-hidden-1'),
      }, 3),
      mkPlayer('p4', 'Dave', false, { 'dave-land-1': land('dave-land-1', 'Mountain') }, 0),
    ],
    myPlayerId: 'p1',
    myHand: {
      'h-1': { id: 'h-1', name: 'Island', parentId: 'h-1', manaValue: 0, expansionSetCode: '', cardNumber: '0' },
      'h-2': { id: 'h-2', name: 'Counterspell', parentId: 'h-2', manaValue: 2, expansionSetCode: '', cardNumber: '0' },
    },
    opponentHands: {
      Carol: { 'oh-1': { id: 'oh-1', name: 'Island', parentId: 'oh-1', manaValue: 0, expansionSetCode: '', cardNumber: '0' } },
    },
    watchedHands: {},
    turn: 4,
    phase: 'PRECOMBAT_MAIN',
    step: 'PRECOMBAT_MAIN',
    activePlayerId: 'p1',
    activePlayerName: 'Alice',
    priorityPlayerName: 'Alice',
    stack: {},
    combat: [],
    canPlayObjects: {},
    revealed: [],
    exiles: {},
  }
}

function asSpectator(game: ReturnType<typeof fourPlayerGame>) {
  return {
    ...game,
    myPlayerId: null,
    myHand: {},
    players: game.players.map((p) => ({ ...p, controlled: false, isActive: false, hasPriority: false, isHuman: false })),
  }
}

async function loadSpotlight(page: Page, options: { gameUi?: 'v1' | 'v2'; spotlight?: boolean; spectator?: boolean } = {}) {
  const { gameUi = 'v2', spotlight = true, spectator = false } = options
  await page.goto('/')
  await dismissSetupWizard(page)
  await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(400)
  await page.evaluate(({ gameView, gameUi, spotlight }: { gameView: object; gameUi: 'v1' | 'v2'; spotlight: boolean }) => {
    const store = (globalThis as unknown as { __mageStore?: { getState: () => Record<string, any>; setState: (s: unknown) => void } }).__mageStore
    const st = store?.getState() as { settings: Record<string, unknown> }
    store?.setState({
      phase: 'game',
      gameId: 'g1',
      settings: { ...st.settings, boardLayout: 'arena', gameUi, boardFill: true, boardSpotlight: spotlight },
      game: gameView,
    })
  }, { gameView: spectator ? asSpectator(fourPlayerGame()) : fourPlayerGame(), gameUi, spotlight })
  if (spotlight) {
    await expect(page.getByTestId('spotlight-board')).toBeVisible({ timeout: 10_000 })
  } else {
    await expect(page.getByTestId('arena-board')).toBeVisible({ timeout: 10_000 })
  }
}

async function mainSeat(page: Page): Promise<string | null> {
  return page.getByTestId('spotlight-main').getAttribute('data-main-seat')
}

async function ringOrder(page: Page): Promise<string[]> {
  return page.locator('[data-testid^="tor-seat-"]').evaluateAll((els: Element[]) =>
    els.map((el: Element) => (el.getAttribute('data-testid') ?? '').replace('tor-seat-', '')),
  )
}

async function rect(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((el: Element) => {
    const r = el.getBoundingClientRect()
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
  })
}

async function panelWidth(page: Page): Promise<number> {
  return (await rect(page, '[data-testid="spotlight-panel"]')).width
}

async function copyScale(page: Page, id: string): Promise<number> {
  return Number(await page.getByTestId(`spotlight-copy-${id}`).getAttribute('data-scale'))
}

async function clickCopy(page: Page, id: string) {
  const box = await page.getByTestId(`spotlight-copy-${id}`).boundingBox()
  if (!box) throw new Error(`copy ${id} not visible`)
  await page.getByTestId(`spotlight-copy-${id}`).click({ position: { x: box.width / 2, y: 8 } })
}

function intersects(a: { left: number; top: number; right: number; bottom: number }, b: { left: number; top: number; right: number; bottom: number }): boolean {
  return a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5
}

async function pileReport(page: Page, scope: string) {
  return page.evaluate((scope: string) => {
    const box = (el: Element) => {
      const r = el.getBoundingClientRect()
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    }
    const corner = document.querySelector(`${scope} [data-testid="pile-corner"]`)
    const zone = document.querySelector(`${scope} .board-zone`)
    if (!corner || !zone) return null
    return {
      corner: box(corner),
      zone: box(zone),
      kids: Array.from(document.querySelectorAll(`${scope} .bz-status-row > *`)).map(box),
      hand: Array.from(document.querySelectorAll('[data-testid="hand-bar"] .hand-card-slot')).map(box),
    }
  }, scope)
}

async function expectPilesFlush(page: Page, scope: string) {
  const report = await pileReport(page, scope)
  expect(report).not.toBeNull()
  const { corner, zone, kids, hand } = report!
  expect(hand.filter((card) => intersects(corner, card))).toEqual([])
  for (const kid of kids) expect(intersects(corner, kid)).toBe(false)
  if (Math.abs(corner.bottom - zone.bottom) <= 2) return
  const height = corner.bottom - corner.top
  const atRest = { left: corner.left, right: corner.right, top: zone.bottom - height, bottom: zone.bottom }
  const blocking = hand.filter((card) => intersects(atRest, card))
  expect(blocking.length, 'a corner lifted off the bottom edge must clear a hand card it would overlap').toBeGreaterThan(0)
  expect(corner.bottom).toBeLessThanOrEqual(Math.min(...blocking.map((card) => card.top)) + 2)
}

async function cornerOverlaps(page: Page): Promise<string[]> {
  const corner = await rect(page, '[data-testid="spotlight-main"] [data-testid="pile-corner"]')
  const others = await page.evaluate(() => {
    const grab = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel))
      .filter((el) => !el.closest('.bz-pile-corner') && el.getBoundingClientRect().width > 0)
      .map((el) => {
        const r = el.getBoundingClientRect()
        return { sel, left: r.left, top: r.top, right: r.right, bottom: r.bottom }
      })
    return [
      ...grab('.spotlight-board .card-slot'),
      ...grab('.spotlight-board .bz-status-row > *'),
      ...grab('[data-testid="hand-bar"] .hand-card-slot'),
      ...grab('.hand-switch-btn'),
    ]
  })
  return others.filter((o: { sel: string; left: number; top: number; right: number; bottom: number }) => intersects(corner, o)).map((o: { sel: string }) => o.sel)
}

for (const vp of VIEWPORTS) {
  test.describe(vp.name, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test('BRD-6: the main board fills the board area and every other seat is a copy in the panel @spotlight', async ({ page }) => {
      await loadSpotlight(page)
      expect(await mainSeat(page)).toBe('p1')
      const ring = await ringOrder(page)
      const me = ring.indexOf('p1')
      const expected = [...ring.slice(me + 1), ...ring.slice(0, me)]
      const copies = await page.locator('[data-testid^="spotlight-copy-"]').evaluateAll((els) =>
        els.map((el) => el.getAttribute('data-copy-player')),
      )
      expect(copies).toEqual(expected)
      expect(copies).toHaveLength(3)
      for (const id of copies) expect(await copyScale(page, id!)).toBeLessThan(1)
      const body = await rect(page, '.spotlight-body')
      const main = await rect(page, '[data-testid="spotlight-main"]')
      expect(Math.abs(main.bottom - body.bottom)).toBeLessThanOrEqual(2)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    })

    test('BRD-6: a copy keeps the main area proportions @spotlight', async ({ page }) => {
      await loadSpotlight(page)
      const main = await rect(page, '[data-testid="spotlight-main"]')
      const frame = await rect(page, '[data-testid="spotlight-copy-p2"] .spotlight-copy-frame')
      const mainRatio = main.width / main.height
      const copyRatio = frame.width / frame.height
      expect(Math.abs(copyRatio - mainRatio) / mainRatio).toBeLessThanOrEqual(0.01)
    })

    test('BRD-6: with the switch off the opponents row is drawn @spotlight', async ({ page }) => {
      await loadSpotlight(page, { spotlight: false })
      await expect(page.getByTestId('arena-board')).toBeVisible()
      await expect(page.getByTestId('spotlight-board')).toHaveCount(0)
      await expect(page.locator('.arena-opp-cell')).toHaveCount(3)
    })

    test('BRD-6: no visible player name is clipped in the main board @spotlight', async ({ page }) => {
      await loadSpotlight(page)
      await page.addStyleTag({ content: ':root { --font-ui: monospace !important; }' })
      await page.waitForTimeout(300)
      const clipped = await page.locator('[data-testid="spotlight-main"] .player-name').evaluateAll((els) =>
        els.filter((el) => el.getBoundingClientRect().width > 0 && el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent),
      )
      expect(clipped).toEqual([])
    })

    test('BRD-7: clicking a copy brings that board to the main area and the old main board to the panel @spotlight', async ({ page }) => {
      await loadSpotlight(page)
      await clickCopy(page, 'p2')
      await expect(page.getByTestId('spotlight-main')).toHaveAttribute('data-main-seat', 'p2')
      await expect(page.getByTestId('spotlight-copy-p1')).toBeVisible()
      await expect(page.getByTestId('spotlight-copy-p2')).toHaveCount(0)
    })

    test('BRD-7: the own pill and copy bring the own board back @spotlight', async ({ page }) => {
      await loadSpotlight(page)
      await clickCopy(page, 'p3')
      await expect(page.getByTestId('spotlight-main')).toHaveAttribute('data-main-seat', 'p3')
      await clickCopy(page, 'p1')
      await expect(page.getByTestId('spotlight-main')).toHaveAttribute('data-main-seat', 'p1')
      await clickCopy(page, 'p4')
      await expect(page.getByTestId('spotlight-main')).toHaveAttribute('data-main-seat', 'p4')
      await page.getByTestId('tor-seat-p1').click()
      await expect(page.getByTestId('spotlight-main')).toHaveAttribute('data-main-seat', 'p1')
      await expect(page.getByTestId('tor-seat-p1')).toHaveAttribute('aria-pressed', 'true')
    })

    test('BRD-7: a spectator clicks a copy and a pill to change the main board @spotlight', async ({ page }) => {
      await loadSpotlight(page, { spectator: true })
      await expect(page.getByTestId('hand-bar')).toHaveCount(0)
      expect(await mainSeat(page)).toBe('p4')
      const copies = await page.locator('[data-testid^="spotlight-copy-"]').evaluateAll((els) =>
        els.map((el) => el.getAttribute('data-copy-player')),
      )
      expect(copies).toEqual(['p3', 'p2', 'p1'])
      await clickCopy(page, 'p2')
      await expect(page.getByTestId('spotlight-main')).toHaveAttribute('data-main-seat', 'p2')
      await expect(page.getByTestId('spotlight-copy-p4')).toBeVisible()
      await page.getByTestId('tor-seat-p3').click()
      await expect(page.getByTestId('spotlight-main')).toHaveAttribute('data-main-seat', 'p3')
      await expect(page.getByTestId('tor-seat-p3')).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByTestId('spotlight-copy-p3')).toHaveCount(0)
    })

    test('BRD-7: the own hand stays centred under the main area whatever board is main @spotlight', async ({ page }) => {
      await loadSpotlight(page)
      for (const seat of ['p1', 'p2', 'p3']) {
        if (seat === 'p1') await page.getByTestId('tor-seat-p1').click()
        else await clickCopy(page, seat)
        await expect(page.getByTestId('spotlight-main')).toHaveAttribute('data-main-seat', seat)
        const main = await rect(page, '[data-testid="spotlight-main"]')
        const panel = await rect(page, '[data-testid="spotlight-panel"]')
        const hand = await rect(page, '[data-testid="hand-bar"]')
        const cx = (hand.left + hand.right) / 2
        expect(cx).toBeGreaterThanOrEqual(main.left)
        expect(cx).toBeLessThanOrEqual(main.right)
        expect(intersects(hand, panel)).toBe(false)
      }
    })

    test('BRD-7: a hidden opponent card never shows face up, in the main area or a copy @spotlight', async ({ page }) => {
      await loadSpotlight(page)
      const visibleText = () => page.evaluate(() => document.body.innerText)
      expect(await visibleText()).not.toContain(HIDDEN_NAME)
      await clickCopy(page, 'p3')
      await expect(page.getByTestId('spotlight-main')).toHaveAttribute('data-main-seat', 'p3')
      expect(await page.locator('[data-testid="spotlight-main"] .card-slot.face-down').count()).toBeGreaterThan(0)
      expect(await visibleText()).not.toContain(HIDDEN_NAME)
      await clickCopy(page, 'p1')
      expect(await visibleText()).not.toContain(HIDDEN_NAME)
    })

    test('BRD-6: an opponent hand in the main area is a stack of backs that never sits under the own hand bar (classic interface) @spotlight', async ({ page }) => {
      await loadSpotlight(page, { gameUi: 'v1' })
      await clickCopy(page, 'p3')
      await expect(page.getByTestId('spotlight-main')).toHaveAttribute('data-main-seat', 'p3')
      const stack = page.getByTestId('spotlight-main').locator('[data-testid="opp-hand-stack"]')
      await expect(stack).toHaveAttribute('data-count', '2')
      const handCards = await page.locator('[data-testid="hand-bar"] .hand-card-slot').evaluateAll((els) =>
        els.map((el) => {
          const b = el.getBoundingClientRect()
          return { left: b.left, top: b.top, right: b.right, bottom: b.bottom }
        }),
      )
      expect(handCards.length).toBeGreaterThan(0)
      for (const zone of await page.locator('[data-testid="spotlight-main"] .hand-zone').all()) {
        const r = await zone.evaluate((el) => {
          const b = el.getBoundingClientRect()
          return { left: b.left, top: b.top, right: b.right, bottom: b.bottom }
        })
        for (const card of handCards) expect(intersects(r, card)).toBe(false)
      }
      await expect(stack).toBeVisible()
    })

    for (const gameUi of ['v2', 'v1'] as const) {
      test(`BRD-11: the phase strip is above the main area and the panel (${gameUi}) @spotlight`, async ({ page }) => {
        await loadSpotlight(page, { gameUi })
        const strip = await rect(page, gameUi === 'v2' ? '[data-testid="game-topbar"]' : '[data-testid="game-strip"]')
        const main = await rect(page, '[data-testid="spotlight-main"]')
        const panel = await rect(page, '[data-testid="spotlight-panel"]')
        expect(strip.bottom).toBeLessThanOrEqual(main.top + 1)
        expect(strip.bottom).toBeLessThanOrEqual(panel.top + 1)
      })
    }

    test('BRD-12: every board shows library, graveyard and exile as cards in its corner, clicking one opens the viewer @spotlight', async ({ page }) => {
      await loadSpotlight(page)
      await expect(page.getByTestId('pile-corner')).toHaveCount(4)
      for (const pile of ['library', 'graveyard', 'exile']) {
        await expect(page.getByTestId(`pile-corner`).locator(`[data-testid="pile-card-${pile}"]`)).toHaveCount(4)
      }
      await page.locator('[data-testid="spotlight-main"] [data-testid="pile-card-graveyard"]').click()
      await expect(page.locator('.pile-overlay').first()).toBeVisible()
      await dismissInfoWindows(page)
    })

    for (const gameUi of ['v2', 'v1'] as const) {
      for (const main of ['own', 'opponent'] as const) {
        test(`BRD-12: the pile corner overlaps no card, no status row and no hand (${gameUi}, ${main} board main) @spotlight`, async ({ page }) => {
          await loadSpotlight(page, { gameUi })
          if (main === 'opponent') await clickCopy(page, 'p2')
          await expect(page.getByTestId('spotlight-main')).toHaveAttribute('data-main-seat', main === 'own' ? 'p1' : 'p2')
          await expect.poll(() => cornerOverlaps(page)).toEqual([])
        })
      }
    }

    for (const board of ['own main', 'opponent main', 'spectator main', 'copy'] as const) {
      test(`BRD-12: the piles sit flush with the bottom edge of their board, beside the status row (${board}) @spotlight`, async ({ page }) => {
        await loadSpotlight(page, { spectator: board === 'spectator main' })
        if (board === 'opponent main') await clickCopy(page, 'p2')
        const scope = board === 'copy' ? '[data-testid="spotlight-copy-p2"]' : '[data-testid="spotlight-main"]'
        await expectPilesFlush(page, scope)
      })
    }

    test('BRD-8: a copy rings while the prompt can target a card on its board @spotlight', async ({ page }) => {
      await loadSpotlight(page)
      await page.evaluate(() => {
        const store = (globalThis as unknown as { __mageStore?: { setState: (s: unknown) => void } }).__mageStore
        store?.setState({
          feedback: {
            method: 'GAME_TARGET',
            gameId: 'g1',
            title: '',
            message: 'Choose target creature',
            sourceName: 'Test',
            min: 1,
            max: 1,
            options: [{ id: 'carol-c-1', name: 'Serra Angel' }],
          },
        })
      })
      await expect(page.getByTestId('spotlight-copy-p3')).toHaveClass(/target-zone/)
      await expect(page.getByTestId('spotlight-copy-p2')).not.toHaveClass(/target-zone/)
    })

    test('BRD-13: dragging the panel edge widens the panel and the copies rescale; the width survives a reload of the setting @spotlight', async ({ page }) => {
      await loadSpotlight(page)
      const widthBefore = await panelWidth(page)
      const scaleBefore = await copyScale(page, 'p2')
      const handle = await rect(page, '[data-testid="spotlight-panel-handle"]')
      const cx = (handle.left + handle.right) / 2
      const cy = (handle.top + handle.bottom) / 2
      await page.mouse.move(cx, cy)
      await page.mouse.down()
      await page.mouse.move(cx - 120, cy, { steps: 12 })
      await page.mouse.up()
      await expect.poll(() => panelWidth(page)).toBeGreaterThan(widthBefore + 20)
      await expect.poll(() => copyScale(page, 'p2')).toBeGreaterThanOrEqual(scaleBefore)
      const slot = await rect(page, '[data-testid="spotlight-copy-p2"]')
      const frame = await rect(page, '[data-testid="spotlight-copy-p2"] .spotlight-copy-frame')
      expect(frame.right).toBeLessThanOrEqual(slot.right + 1)
      expect(frame.bottom).toBeLessThanOrEqual(slot.bottom + 1)
      const saved = await page.evaluate(() => {
        const store = (globalThis as unknown as { __mageStore?: { getState: () => Record<string, any> } }).__mageStore
        return store?.getState().settings.boardSpotlightPanel as number
      })
      expect(saved).toBeGreaterThan(22)
      await page.reload()
      await dismissSetupWizard(page)
      const reloaded = await page.evaluate(() => {
        const store = (globalThis as unknown as { __mageStore?: { getState: () => Record<string, any> } }).__mageStore
        return store?.getState().settings.boardSpotlightPanel as number
      })
      expect(reloaded).toBe(saved)
    })
  })
}
