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

/**
 * What the walkway shows and whether it fits, read from the live layout.
 * Seats are counted inside `.tor-seats-flow` only: the hidden clones under
 * `[data-measure]` repeat the names to measure them and are not the row.
 */
function laneState(page: Page) {
  return page.evaluate(() => {
    const lane = document.querySelector<HTMLElement>('[data-testid="turn-lane"]')
    const band = document.querySelector<HTMLElement>('.board-shell-divider')
    const center = document.querySelector<HTMLElement>('.game-strip-center')
    const strip = document.querySelector<HTMLElement>('.game-strip')
    if (!lane || !band || !center || !strip) return { missing: true as const }
    const l = lane.getBoundingClientRect()
    const c = center.getBoundingClientRect()
    const b = band.getBoundingClientRect()
    const row = lane.querySelector<HTMLElement>('.tor-seats-flow')
    const seats = Array.from(row?.querySelectorAll<HTMLElement>('.tor-seat') ?? [])
    return {
      missing: false as const,
      fit: lane.dataset.laneFit ?? null,
      laneW: Math.round(l.width),
      centerW: Math.round(c.width),
      fitsWidth: l.right <= c.right + 1,
      fitsBand: l.bottom <= b.bottom + 1,
      stripOverflows: strip.scrollWidth > strip.clientWidth,
      // the row, not the pill: the hidden ruler inside the walkway is allowed to
      // be wider than the pill, and counting it would read as an overflow
      rowOverflows: !!row && row.scrollWidth > row.clientWidth + 1,
      // the three rulers, logged every pass: when a platform resolves a wider
      // --font-ui these numbers move, and the fit must move with them
      clones: Object.fromEntries(Array.from(lane.querySelectorAll<HTMLElement>('[data-lane-measure]')).map((c) => [c.dataset.laneMeasure ?? '?', Math.round(c.scrollWidth * 10) / 10])),
      seats: seats.map((s) => {
        const name = s.querySelector<HTMLElement>('.tor-seat-name')
        return {
          name: name?.textContent ?? null,
          shown: name !== null && s.offsetParent !== null,
          clipped: !!name && name.scrollWidth > name.clientWidth + 1,
          active: s.classList.contains('is-active'),
        }
      }),
    }
  })
}

// The contract, at every width and under either font: the walkway either shows
// the names whole or gives up the seat that carries no information. A truncated
// name is not a state it can be in, and neither is a row wider than its band.
async function expectNoTruncation(page: Page, label: string) {
  for (const width of [1600, 1280, 900]) {
    await page.setViewportSize({ width, height: 800 })
    await page.waitForTimeout(300)
    const state = await laneState(page)
    console.log(`LANE-${label}@${width} ` + JSON.stringify(state))
    expect(state.missing).toBe(false)
    expect(state.fitsWidth).toBe(true)
    expect(state.fitsBand).toBe(true)
    expect(state.stripOverflows).toBe(false)
    expect(state.rowOverflows).toBe(false)
    const shown = state.seats.filter((s) => s.shown)
    expect(shown.length).toBeGreaterThan(0)
    // either the whole row, or the active seat alone: never a cut name
    expect(shown.length === state.seats.length || shown.length === 1).toBe(true)
    for (const s of shown) expect(s.clipped).toBe(false)
    expect(shown.some((s) => s.active)).toBe(true)
  }
}

// Starve the band: the walkway's container is the middle strip, so clamping it
// is how the narrow-window and uiScale>1 cases look from the inside. 240px is
// below the natural row width (~283px measured), which is the region where a
// fixed budget used to truncate the name instead of degrading.
async function starveBand(page: Page, px: number | null) {
  await page.evaluate((width) => {
    document.getElementById('lane-starve')?.remove()
    if (width === null) return
    const style = document.createElement('style')
    style.id = 'lane-starve'
    style.textContent = `.game-strip-center { max-width: ${width}px !important }`
    document.head.append(style)
  }, px)
  await page.waitForTimeout(300)
}

test('the 1v1 walkway never truncates a name, narrow or wide font @board', async ({ page }) => {
  await boot(page)
  await pushGame(page, duel('p2', 'p2'))
  await expect(page.locator('[data-testid="turn-lane"]')).toBeVisible({ timeout: 10_000 })

  await page.setViewportSize({ width: 1600, height: 800 })
  await page.waitForTimeout(300)
  await expectNoTruncation(page, 'DEFAULT')

  // A face wider than anything the app ships against: CI's Ubuntu resolves
  // system-ui to something in this class (100.8px for the 14-char name against
  // this machine's 94.9px), and the guard has to catch that from a Mac.
  await page.addStyleTag({ content: ':root { --font-ui: monospace !important; }' })
  await page.waitForTimeout(300)
  await expectNoTruncation(page, 'WIDE')

  // Where it used to break: not enough band for the row. Under both fonts the
  // walkway must give up the quiet seat rather than cut a name, and the fit
  // must actually move off 'full' — otherwise this pass proves nothing.
  for (const font of ['DEFAULT', 'WIDE'] as const) {
    if (font === 'DEFAULT') {
      // back to the narrow face for the second half of the matrix: the style tag
      // is appended after the monospace one, and the later !important wins
      await page.addStyleTag({ content: ':root { --font-ui: "Segoe UI", system-ui, sans-serif !important; }' })
    }
    await starveBand(page, 240)
    for (const width of [1600, 1280, 900]) {
      await page.setViewportSize({ width, height: 800 })
      await page.waitForTimeout(300)
      const state = await laneState(page)
      console.log(`LANE-STARVED-${font}@${width} ` + JSON.stringify(state))
      expect(state.missing).toBe(false)
      expect(state.rowOverflows).toBe(false)
      // the walkway noticed: 240px of band is under the row's natural width
      expect(state.fit).not.toBe('full')
      const shown = state.seats.filter((s) => s.shown)
      expect(shown.length).toBeGreaterThan(0)
      expect(shown.length === state.seats.length || shown.length === 1).toBe(true)
      for (const s of shown) expect(s.clipped).toBe(false)
      expect(shown.some((s) => s.active)).toBe(true)
    }
    await starveBand(page, null)
  }
  await page.screenshot({ path: '/tmp/turn-lane-wide.png' })
})

test('turn and priority paint at the same time @board', async ({ page }) => {
  await boot(page)
  await pushGame(page, duel('p2', 'p2'))
  await expect(page.locator('[data-testid="game-board"]')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(250)

  const both = await channels(page, '.player-info-bar.opp')
  console.log('CHANNEL-BOTH ' + JSON.stringify(both))
  // the priority ring (rose border, a hue away from the turn gold) is still there...
  expect(both?.ring).toContain('255, 93, 115')
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
    const seats = Array.from(document.querySelectorAll<HTMLElement>('.turn-order-ring.lane .tor-seats-flow .tor-seat'))
    return seats.map((s) => ({ name: s.querySelector('.tor-seat-name')?.textContent, active: s.dataset.active === 'true' }))
  })
  console.log('LANE-RIVAL ' + JSON.stringify(rivalPlaying))
  expect(rivalPlaying[0]?.active).toBe(true)
  expect(rivalPlaying[1]?.name).toBe('Adamysz')

  await pushGame(page, duel('p1', 'p1'))
  await page.waitForTimeout(250)
  const minePlaying = await page.evaluate(() => {
    const seats = Array.from(document.querySelectorAll<HTMLElement>('.turn-order-ring.lane .tor-seats-flow .tor-seat'))
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
