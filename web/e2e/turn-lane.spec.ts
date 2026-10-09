import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { dismissSetupWizard } from './support/start-game'
import type { Page } from '@playwright/test'

fakeOnly()

function mkPlayer(id: string, name: string, controlled: boolean, opts: { active?: boolean; priority?: boolean } = {}) {
  return {
    playerId: id,
    name,
    life: 20,
    controlled,
    isActive: !!opts.active,
    hasPriority: !!opts.priority,
    isHuman: controlled,
    defeated: false,
    left: false,
    battlefield: {},
    handCount: 0,
    libraryCount: 50,
    counters: [],
    designationNames: [],
    manaPool: { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 },
    timers: {},
  }
}

function duel(activePlayerId: string, priorityPlayerId: string) {
  return {
    players: [
      mkPlayer('p1', 'Adamysz', true, { active: activePlayerId === 'p1', priority: priorityPlayerId === 'p1' }),
      mkPlayer('p2', 'Rivalmuygrande', false, { active: activePlayerId === 'p2', priority: priorityPlayerId === 'p2' }),
    ],
    myPlayerId: 'p1',
    myHand: {},
    turn: 4,
    phase: 'PRECOMBAT_MAIN',
    step: 'PRECOMBAT_MAIN',
    activePlayerId,
    activePlayerName: activePlayerId === 'p1' ? 'Adamysz' : 'Rivalmuygrande',
    priorityPlayerName: priorityPlayerId === 'p1' ? 'Adamysz' : 'Rivalmuygrande',
    stack: {},
    combat: [],
    canPlayObjects: {},
    opponentHands: {},
    watchedHands: {},
    revealed: [],
    exiles: {},
  }
}

// `boardLayoutManual` pins the layout: with three rivals and the automatic
// choice the board goes pod, and the walkway would not be the thing under test
async function pushGame(page: Page, view: unknown, layout = 'standard') {
  await page.evaluate(({ view, layout }) => {
    const store = (globalThis as unknown as { __mageStore?: { getState: () => Record<string, unknown>; setState: (s: unknown) => void } }).__mageStore
    const st = store?.getState() as { settings: Record<string, unknown> }
    store?.setState({ phase: 'game', settings: { ...st.settings, boardLayout: layout, boardLayoutManual: true }, game: view })
  }, { view, layout })
}

function channels(page: Page, selector: string) {
  return page.evaluate(({ sel }) => {
    const el = document.querySelector<HTMLElement>(sel)
    if (!el) return null
    const cs = getComputedStyle(el)
    const accent = getComputedStyle(el, '::before')
    return {
      cls: el.className,
      ring: cs.borderTopColor,
      glow: cs.boxShadow.slice(0, 46),
      fill: cs.backgroundImage.includes('linear-gradient'),
      accent: accent.content === 'none' ? null : accent.backgroundColor,
    }
  }, { sel: selector })
}

async function boot(page: Page) {
  await page.goto('/')
  await dismissSetupWizard(page)
  await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(400)
}

test('the 1v1 walkway fills the middle gap without overflowing the band @board', async ({ page }) => {
  await boot(page)
  await pushGame(page, duel('p2', 'p2'))
  await expect(page.locator('[data-testid="game-board"]')).toBeVisible({ timeout: 10_000 })

  const lane = page.locator('[data-testid="turn-lane"]')
  await expect(lane).toBeVisible()

  for (const width of [1600, 1280, 900]) {
    await page.setViewportSize({ width, height: 800 })
    await page.waitForTimeout(250)
    const fit = await page.evaluate(() => {
      const lane = document.querySelector<HTMLElement>('[data-testid="turn-lane"]')
      const band = document.querySelector<HTMLElement>('.board-shell-divider')
      const center = document.querySelector<HTMLElement>('.game-strip-center')
      const strip = document.querySelector<HTMLElement>('.game-strip')
      if (!lane || !band || !center || !strip) return { missing: true }
      const l = lane.getBoundingClientRect()
      const c = center.getBoundingClientRect()
      const b = band.getBoundingClientRect()
      return {
        lane: { w: Math.round(l.width), h: Math.round(l.height) },
        band: { h: Math.round(b.height) },
        center: { w: Math.round(c.width), right: Math.round(c.right) },
        laneRight: Math.round(l.right),
        fitsWidth: l.right <= c.right + 1,
        fitsBand: l.bottom <= b.bottom + 1,
        stripOverflows: (strip as HTMLElement).scrollWidth > (strip as HTMLElement).clientWidth,
      }
    })
    const clipped = await page.evaluate(() => {
      const lane = document.querySelector<HTMLElement>('[data-testid="turn-lane"]')
      if (!lane) return { missing: true }
      const seats = Array.from(lane.querySelectorAll<HTMLElement>('.tor-seat'))
      return {
        scrollOver: lane.scrollWidth > lane.clientWidth,
        visibleSeats: Array.from(lane.querySelectorAll<HTMLElement>('.tor-seat')).filter((s) => s.offsetParent !== null).length,
        seats: seats.map((s) => ({
          name: s.querySelector('.tor-seat-name')?.textContent,
          nameClipped: (() => {
            const n = s.querySelector<HTMLElement>('.tor-seat-name')
            return !!n && n.scrollWidth > n.clientWidth + 1
          })(),
          hasBadge: !!s.querySelector('[data-testid="tor-active-badge"]'),
        })),
      }
    })
    console.log(`LANE-FIT@${width} ` + JSON.stringify({ ...fit, ...clipped }))
    await page.screenshot({ path: `/tmp/turn-lane-${width}.png` })
    expect(fit).toMatchObject({ fitsWidth: true, fitsBand: true, stripOverflows: false })
    // no clipping at any width: the 14-char name is shown whole at 1600/1280
    expect(clipped.scrollOver).toBe(false)
    // at 900 the band is too narrow for two slots: it keeps the active seat
    expect(clipped.visibleSeats).toBe(width === 900 ? 1 : 2)
    expect(clipped.seats.filter((s: { nameClipped: boolean }) => s.nameClipped).length).toBe(0)
  }
})

test('turn and priority paint at the same time @board', async ({ page }) => {
  await boot(page)
  await pushGame(page, duel('p2', 'p2'))
  await expect(page.locator('[data-testid="game-board"]')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(250)

  const both = await channels(page, '.player-info-bar.opp')
  console.log('CHANNEL-BOTH ' + JSON.stringify(both))
  // the priority ring (orange border) is still there...
  expect(both?.ring).toContain('245, 165, 36')
  // ...and the two turn markers also paint. Before the fix they did not: the
  // turn claimed border-color/box-shadow, so with priority on the same bar the
  // rival's turn was invisible (fill false, accent null).
  expect(both?.fill).toBe(true)
  expect(both?.accent).toContain('226, 178, 74')
  await page.screenshot({ path: '/tmp/turn-1-rival-turn-and-priority.png' })

  await pushGame(page, duel('p2', 'p1'))
  await page.waitForTimeout(250)
  const rival = await channels(page, '.player-info-bar.opp')
  const mine = await channels(page, '.player-info-bar.my')
  const words = await page.evaluate(() => ({
    lane: document.querySelector<HTMLElement>('[data-testid="turn-lane"]')?.innerText.replace(/\n/g, ' ') ?? null,
    action: document.querySelector<HTMLElement>('.big-action-btn')?.innerText.replace(/\n/g, ' ') ?? null,
  }))
  console.log('CHANNEL-ANSWER ' + JSON.stringify({ rival, mine, words }))
  // rival keeps playing (turn fill) while I hold priority (green ring): both
  // channels on screen at once, in two different property families
  expect(rival?.fill).toBe(true)
  expect(mine?.ring).toContain('61, 220, 151')
  expect(mine?.fill).toBe(false)
  await page.screenshot({ path: '/tmp/turn-2-my-answer.png' })

  await pushGame(page, duel('p1', 'p1'))
  await page.waitForTimeout(250)
  const myTurn = await channels(page, '.player-info-bar.my')
  console.log('CHANNEL-MY-TURN ' + JSON.stringify(myTurn))
  expect(myTurn?.fill).toBe(true)
  expect(myTurn?.accent).toContain('226, 178, 74')
  await page.screenshot({ path: '/tmp/turn-3-my-turn.png' })
})

test('the marker changes side with the turn and keeps slot positions @board', async ({ page }) => {
  await boot(page)
  await pushGame(page, duel('p2', 'p2'))
  await expect(page.locator('[data-testid="game-board"]')).toBeVisible({ timeout: 10_000 })

  const rivalPlaying = await page.evaluate(() => {
    const seats = Array.from(document.querySelectorAll<HTMLElement>('.turn-order-ring.lane .tor-seat'))
    return seats.map((s) => ({ name: s.querySelector('.tor-seat-name')?.textContent, active: s.dataset.active === 'true' }))
  })
  console.log('LANE-RIVAL ' + JSON.stringify(rivalPlaying))
  expect(rivalPlaying[0]?.active).toBe(true)
  expect(rivalPlaying[1]?.name).toBe('Adamysz')

  await pushGame(page, duel('p1', 'p1'))
  await page.waitForTimeout(250)
  const minePlaying = await page.evaluate(() => {
    const seats = Array.from(document.querySelectorAll<HTMLElement>('.turn-order-ring.lane .tor-seat'))
    return seats.map((s) => ({ name: s.querySelector('.tor-seat-name')?.textContent, active: s.dataset.active === 'true' }))
  })
  console.log('LANE-MINE ' + JSON.stringify(minePlaying))
  expect(minePlaying[0]?.active).toBe(false)
  expect(minePlaying[1]?.active).toBe(true)
  expect(minePlaying.map((s) => s.name)).toEqual(rivalPlaying.map((s) => s.name))
})

test('the pod ring and the FFA switcher still render @board', async ({ page }) => {
  await boot(page)
  const pod = duel('p2', 'p2')
  pod.players.push(mkPlayer('p3', 'Carlos', false), mkPlayer('p4', 'Dana', false))
  await pushGame(page, pod, 'pod')
  await expect(page.locator('[data-testid="pod-board"]')).toBeVisible({ timeout: 10_000 })
  const ring = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-testid="turn-order-ring"]')
    return el ? { cls: el.className, seats: el.querySelectorAll('.tor-seat').length } : null
  })
  console.log('POD-RING ' + JSON.stringify(ring))
  expect(ring?.seats).toBe(4)
})

test('in FFA the walkway does not swallow the opponent switcher @board', async ({ page }) => {
  await boot(page)
  const ffa = duel('p2', 'p2')
  ffa.players.push(mkPlayer('p3', 'Carlos', false), mkPlayer('p4', 'Dana', false))
  await pushGame(page, ffa, 'standard')
  await expect(page.locator('[data-testid="game-board"]')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(300)
  const center = await page.evaluate(() => {
    const slot = document.querySelector<HTMLElement>('.game-strip-center')
    return {
      switcher: !!slot?.querySelector('.opponent-switcher-bar'),
      pills: slot?.querySelectorAll('.opp-pill').length ?? 0,
      lane: !!slot?.querySelector('[data-testid="turn-lane"]'),
      slotText: slot?.innerText.replace(/\n/g, ' ') ?? '',
    }
  })
  console.log('FFA-CENTER ' + JSON.stringify(center))
  expect(center.switcher).toBe(true)
  expect(center.pills).toBe(4) // three rivals + my own pill
  expect(center.lane).toBe(false)
})
