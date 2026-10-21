import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { dismissSetupWizard } from './support/start-game'

fakeOnly()

test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })

function perm(id: string, name: string, types: string[], extra: Record<string, unknown> = {}) {
  return { id, name, cardTypes: types, subTypes: [], superTypes: [], rules: [], manaValue: 1, expansionSetCode: '', cardNumber: '0', tapped: false, ...extra }
}

const land = (id: string, name: string, tapped: boolean) => perm(id, name, ['LAND'], { tapped, subTypes: [name] })
const artifact = (id: string, name: string) => perm(id, name, ['ARTIFACT'])
const creature = (id: string, name: string, tapped = false) => perm(id, name, ['CREATURE'], { tapped, power: '2', toughness: '2' })

function player(id: string, name: string, battlefield: Record<string, unknown>, controlled = false) {
  return {
    playerId: id, name, life: 20, controlled, isActive: id === 'p2', hasPriority: id === 'p2', isHuman: true,
    defeated: false, left: false, battlefield, handCount: 5, libraryCount: 60, counters: [],
    commandList: [], designationNames: [], manaPool: { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 }, timers: {},
  }
}

function entries(list: Array<Record<string, unknown>>) {
  return Object.fromEntries(list.map((p) => [p.id as string, p]))
}

function threePlayerGame() {
  return {
    players: [
      player('p1', 'NovaGlow', entries([
        ...Array.from({ length: 6 }, (_, i) => land(`n${i}`, 'Island', false)),
        creature('nc1', 'Namor'),
      ]), true),
      player('p2', 'Jeeves', entries([
        ...Array.from({ length: 10 }, (_, i) => artifact(`j${i}`, `Relic ${i}`)),
        artifact('j10', 'Map'), artifact('j11', 'Map 2'),
        creature('jc1', 'Mister Negative'), creature('jc2', 'Shark'), creature('jc3', 'Shark'),
      ])),
      player('p3', 'Jay0707', entries([
        ...Array.from({ length: 3 }, (_, i) => land(`ji${i}`, 'Island', true)),
        ...Array.from({ length: 3 }, (_, i) => land(`jf${i}`, 'Forest', true)),
        land('jl1', 'Tendershoot Bridge', false), land('jl2', 'Seat of the Synod', false), land('jl3', 'Island Full', false),
        artifact('ja1', 'Everflowing Chalice'), artifact('ja2', 'Sol Ring'), artifact('ja3', 'Thought Vessel'),
        artifact('ja4', 'Mind Stone'), artifact('ja5', 'Lumbering Worldwagon'), artifact('ja6', 'Thunderous Velocipede'),
        creature('jc1', 'Kami'), creature('jc2', 'Guardian Sphinx'), creature('jc3', 'Chief of the Foundry'), creature('jc4', 'Aerith'),
      ])),
    ],
    myPlayerId: 'p1',
    myHand: {},
    turn: 42, phase: 'PRECOMBAT_MAIN', step: 'PRECOMBAT_MAIN', activePlayerId: 'p2', activePlayerName: 'Jeeves', priorityPlayerName: 'Jeeves',
    stack: {}, combat: [], canPlayObjects: {}, opponentHands: {}, watchedHands: {}, revealed: [], exiles: {},
  }
}

const VIEWPORTS: Array<[number, number]> = []
for (let w = 1500; w <= 2560; w += 53) for (const h of [900, 1080, 1250, 1440]) VIEWPORTS.push([w, h])

// Each block mounts the page once (~10 s) and sweeps its viewports in order, like the
// original loop, so the sweep spreads across workers instead of one 3-minute test.
const BAND_FIT_BLOCKS = 8
const BAND_FIT_BLOCK_SIZE = Math.ceil(VIEWPORTS.length / BAND_FIT_BLOCKS)

for (let block = 0; block < BAND_FIT_BLOCKS; block++) {
  const slice = VIEWPORTS.slice(block * BAND_FIT_BLOCK_SIZE, (block + 1) * BAND_FIT_BLOCK_SIZE)
  if (slice.length === 0) continue
  const label = `${slice[0][0]}x${slice[0][1]}-${slice[slice.length - 1][0]}x${slice[slice.length - 1][1]}`
  test(`classic bands settle on one fit at every viewport ${label} instead of flipping @board`, async ({ page }) => {
    test.setTimeout(300_000)
    await page.setViewportSize({ width: slice[0][0], height: slice[0][1] })
    await page.goto('/')
    await dismissSetupWizard(page)
    await page.evaluate((gameView) => {
      const store = (globalThis as any).__mageStore
      const st = store.getState()
      store.setState({ phase: 'game', settings: { ...st.settings, cardStyle: 'classic', cardRender: 'rendered' }, game: gameView })
    }, threePlayerGame())
    await expect(page.locator('.board-zone .card-slot').first()).toBeVisible({ timeout: 10_000 })
    await expect.poll(() => page.evaluate(() => [...document.images].every((img) => img.complete)), { timeout: 20_000 }).toBe(true)

    const flipping: string[] = []
    for (const [w, h] of slice) {
      await page.setViewportSize({ width: w, height: h })
      const flips = await page.evaluate(() => new Promise<Record<string, number>>((resolve) => {
        const bands = [...document.querySelectorAll<HTMLElement>('.board-zone .bz-band')]
        const key = (b: HTMLElement) => `${b.closest('.board-zone')?.getAttribute('data-player-name')}:${b.classList.contains('permanents-band') ? 'permanents' : 'creatures'}`
        const state = (b: HTMLElement) => `${b.style.getPropertyValue('--card-w')}|${b.getAttribute('data-band-lines') ?? ''}`
        const snapshot = () => bands.map(state).join(',')
        const settleFrames = 30
        const settleCapMs = 5000
        const started = performance.now()
        let calm = 0
        let before = snapshot()
        const settle = () => {
          const now = snapshot()
          calm = now === before ? calm + 1 : 0
          before = now
          if (calm >= settleFrames || performance.now() - started > settleCapMs) observe()
          else requestAnimationFrame(settle)
        }
        const last = new Map(bands.map((b) => [b, state(b)]))
        const out: Record<string, number> = {}
        let frames = 0
        const observe = () => {
          for (const b of bands) last.set(b, state(b))
          frames = 0
          requestAnimationFrame(tick)
        }
        const tick = () => {
          for (const b of bands) {
            const s = state(b)
            if (s !== last.get(b)) out[key(b)] = (out[key(b)] ?? 0) + 1
            last.set(b, s)
          }
          if (++frames < 60) requestAnimationFrame(tick)
          else resolve(out)
        }
        requestAnimationFrame(settle)
      }))
      for (const [k, n] of Object.entries(flips)) flipping.push(`${w}x${h} ${k} ${n}`)
    }
    expect(flipping, 'no band changes its fit while nothing on the board changes').toEqual([])
  })
}
