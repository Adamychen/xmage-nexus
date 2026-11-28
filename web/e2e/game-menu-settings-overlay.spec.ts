import { fakeOnly } from './support/fake-mode'
import { test, expect } from './fixtures'
import { humanLeftScenario } from '../fixtures/scenarios/humanLeft'
import { withFakeServer } from './support/fake-backend'
import { quickStartGame, dismissSetupWizard } from './support/start-game'

fakeOnly()

test('DLG-11: Settings opened from the game menu paints over the overlay of a left seat', { tag: '@board' }, async ({ page }) => {
  await withFakeServer(() => humanLeftScenario(), async () => {
    await quickStartGame(page, { prefix: 'slo' })

    await expect(page.locator('.player-zone .zone-defeated-overlay')).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('eliminated-watch').click()

    await page.getByTestId('game-menu-btn').click()
    await page.getByTestId('game-menu-settings').click()
    await expect(page.getByTestId('settings-modal')).toBeVisible()

    // The overlay is pointer-events: none, so hit testing would skip it: make it hit-testable
    // to ask which element actually paints on top where the two overlap.
    await page.addStyleTag({ content: '.zone-defeated-overlay { pointer-events: auto !important; }' })

    const point = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="settings-modal"]')?.getBoundingClientRect()
      const overlay = document.querySelector('.player-zone .zone-defeated-overlay')?.getBoundingClientRect()
      if (!modal || !overlay) return null
      const left = Math.max(modal.left, overlay.left)
      const right = Math.min(modal.right, overlay.right)
      const top = Math.max(modal.top, overlay.top)
      const bottom = Math.min(modal.bottom, overlay.bottom)
      if (left >= right || top >= bottom) return null
      return { x: (left + right) / 2, y: (top + bottom) / 2 }
    })
    expect(point, 'the settings dialog must overlap the seat overlay in this viewport').not.toBeNull()

    const hitInsideSettings = await page.evaluate(({ x, y }) => {
      const hit = document.elementFromPoint(x, y)
      return !!hit?.closest('[data-testid="settings-modal"]')
    }, point!)
    expect(hitInsideSettings, 'the settings dialog must paint over the seat overlay').toBe(true)
  })
})

const seat = (id: string, name: string, controlled: boolean) => ({
  playerId: id, name, life: 40, controlled, isActive: controlled, hasPriority: controlled,
  isHuman: true, defeated: false, hasLeft: false, battlefield: {}, handCount: 0, libraryCount: 40,
  counters: [], commandList: [], designationNames: [],
  manaPool: { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 }, timers: {},
})

const onStack = (id: string, name: string) => ({
  id, name, parentId: id, cardTypes: ['Instant'], manaValue: 2, expansionSetCode: '', cardNumber: '0',
  rules: ['Counter target spell.'],
})

/**
 * DLG-15: the menu of the top strip is read over the stack, and the sheet that catches the click
 * outside covers the window. Both failed for the same reason: the strip's pill blurs its backdrop,
 * which traps everything inside it.
 */
test('DLG-15: the game menu opens over the stack and a click on the board closes it', { tag: '@board' }, async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/')
  await dismissSetupWizard(page)
  await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })
  await page.evaluate((game) => {
    const store = (globalThis as unknown as { __mageStore?: { getState: () => Record<string, any>; setState: (s: unknown) => void } }).__mageStore
    const st = store?.getState() as { settings: Record<string, unknown> }
    store?.setState({ phase: 'game', gameId: 'g1', settings: { ...st.settings, boardFill: true }, game })
  }, {
    players: [seat('p1', 'Alice', true), seat('p2', 'Bob', false)],
    myPlayerId: 'p1', myHand: {}, opponentHands: {}, watchedHands: {},
    turn: 5, phase: 'PRECOMBAT_MAIN', step: 'PRECOMBAT_MAIN', activePlayerId: 'p1',
    activePlayerName: 'Alice', priorityPlayerName: 'Alice',
    stack: { s1: onStack('s1', 'Counterspell'), s2: onStack('s2', 'Lightning Bolt'), s3: onStack('s3', 'Shock') },
    combat: [], canPlayObjects: {}, revealed: [], exiles: {},
  })
  await expect(page.getByTestId('stack-zone')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('game-menu-btn').click()
  await expect(page.getByTestId('game-menu')).toBeVisible()

  const hit = await page.evaluate(() => {
    const menu = document.querySelector('[data-testid="game-menu"]')!.getBoundingClientRect()
    const stack = document.querySelector('[data-testid="stack-zone"]')!.getBoundingClientRect()
    const left = Math.max(menu.left, stack.left)
    const right = Math.min(menu.right, stack.right)
    const top = Math.max(menu.top, stack.top)
    const bottom = Math.min(menu.bottom, stack.bottom)
    if (left >= right || top >= bottom) return null
    const el = document.elementFromPoint((left + right) / 2, (top + bottom) / 2)
    return { inMenu: !!el?.closest('[data-testid="game-menu"]'), tag: el ? `${el.tagName}.${el.className}`.slice(0, 80) : 'none' }
  })
  expect(hit, 'the menu must overlap the stack in this viewport').not.toBeNull()
  expect(hit!.inMenu, `the stack paints over the menu: ${hit!.tag}`).toBe(true)

  // The sheet that closes the menu belongs to the window, not to the pill it hangs from.
  const sheet = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="game-menu-overlay"]')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { w: Math.round(r.width), h: Math.round(r.height), win: { w: window.innerWidth, h: window.innerHeight } }
  })
  expect(sheet, 'the menu draws a sheet to catch the click outside').not.toBeNull()
  expect(sheet!.w, 'the sheet is as wide as the window').toBeGreaterThanOrEqual(sheet!.win.w - 1)
  expect(sheet!.h, 'the sheet is as tall as the window').toBeGreaterThanOrEqual(sheet!.win.h - 1)

  await page.mouse.click(300, 700)
  await expect(page.getByTestId('game-menu')).toHaveCount(0)
})
