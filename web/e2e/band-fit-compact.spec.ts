import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { dismissSetupWizard } from './support/start-game'

fakeOnly()

// Real (non-overlay) scrollbars: a band that overflows loses their height, which
// is what made compact bands flip between two fits every frame on desktop browsers.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })

function perm(id: string, name: string, types: string[], extra: Record<string, unknown> = {}) {
  return { id, name, cardTypes: types, subTypes: [], superTypes: [], rules: [], manaValue: 1, expansionSetCode: '', cardNumber: '0', tapped: false, ...extra }
}

const land = (id: string, name: string, tapped: boolean, set = '') => perm(id, name, ['LAND'], { tapped, subTypes: [name], expansionSetCode: set })
const creature = (id: string, name: string, tapped: boolean) => perm(id, name, ['CREATURE'], { tapped, power: '2', toughness: '2' })

function player(id: string, name: string, battlefield: Record<string, unknown>) {
  return {
    playerId: id, name, life: 30, controlled: false, isActive: id === 'p1', hasPriority: id === 'p1', isHuman: true,
    defeated: false, left: false, battlefield, handCount: 5, libraryCount: 70, counters: [],
    commandList: [{ id: `cmd-${id}`, name: `Commander ${name}`, mageObjectType: 'COMMANDER' }],
    designationNames: [], manaPool: { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 }, timers: {},
  }
}

function entries(list: Array<Record<string, unknown>>) {
  return Object.fromEntries(list.map((p) => [p.id as string, p]))
}

function spectatedPod() {
  return {
    players: [
      player('p1', 'Mordekai', entries([
        perm('m1', 'Spectator Token', ['ARTIFACT'], { tapped: true }),
        land('m2', 'Command Tower', false),
        land('m3', 'Plains', true),
        land('m4', 'Forest', true),
        land('m5', 'Mountain', true),
        land('m6', 'Forest', true, 'X'),
        creature('mc1', 'Kutzil', true), creature('mc2', 'Reflection', true), creature('mc3', 'Arwen', true),
        creature('mc4', 'Silverblade', true), creature('mc5', 'Duskana', false),
      ])),
      player('p2', 'Lyruhara', entries([
        ...Array.from({ length: 9 }, (_, i) => land(`l${i}`, `Dual ${i}`, i % 2 === 0)),
        creature('lc1', 'Marina', false), creature('lc2', 'Mesa', false),
      ])),
      player('p3', 'LEXinvents', entries([
        ...Array.from({ length: 5 }, (_, i) => land(`x${i}`, `Plains ${i}`, true)),
        perm('xa', 'Mace', ['ARTIFACT']), creature('xc', 'Aang', false),
      ])),
      player('p4', 'shinva', entries([
        ...[1, 2, 3, 4].map((i) => land(`s${i}`, 'Swamp', false)),
        land('s5', 'Forest', false),
        land('s6', 'Viridescent Bog', false),
        land('s7', 'Forest', false, 'X'),
        land('s8', 'Slitherbore Pathway', false),
        creature('sc1', 'Sidisi', true), creature('sc2', 'Vile Entomber', true), creature('sc3', 'Massacre Wurm', false),
      ])),
    ],
    myPlayerId: 'spectator',
    myHand: {},
    turn: 12, phase: 'PRECOMBAT_MAIN', step: 'PRECOMBAT_MAIN', activePlayerId: 'p1', activePlayerName: 'Mordekai', priorityPlayerName: 'Mordekai',
    stack: {}, combat: [], canPlayObjects: {}, opponentHands: {}, watchedHands: {}, revealed: [], exiles: {},
  }
}

test('compact bands settle on one fit instead of flipping every frame when they wrap at full size @board', async ({ page }) => {
  await page.setViewportSize({ width: 1615, height: 1329 })
  await page.goto('/')
  await dismissSetupWizard(page)
  await page.evaluate((gameView) => {
    const store = (globalThis as any).__mageStore
    const st = store.getState()
    store.setState({ phase: 'game', settings: { ...st.settings, cardStyle: 'compact', tapStyle: 'tilted' }, game: gameView })
  }, spectatedPod())
  await expect(page.locator('.board-zone .card-slot.is-compact').first()).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(800)

  const probe = await page.evaluate(() => new Promise<{ flips: Record<string, number>; overflowing: string[] }>((resolve) => {
    const bands = [...document.querySelectorAll<HTMLElement>('.board-zone .bz-band')]
    const key = (b: HTMLElement) => `${b.closest('.board-zone')?.getAttribute('data-player-name')}:${b.classList.contains('permanents-band') ? 'permanents' : 'creatures'}`
    const state = (b: HTMLElement) => `${b.style.getPropertyValue('--card-w')}|${b.getAttribute('data-band-lines') ?? ''}`
    const last = new Map(bands.map((b) => [b, state(b)]))
    const flips: Record<string, number> = {}
    let frames = 0
    const tick = () => {
      for (const b of bands) {
        const s = state(b)
        if (s !== last.get(b)) flips[key(b)] = (flips[key(b)] ?? 0) + 1
        last.set(b, s)
      }
      if (++frames < 90) requestAnimationFrame(tick)
      else resolve({ flips, overflowing: bands.filter((b) => b.scrollWidth > b.clientWidth + 2).map(key) })
    }
    requestAnimationFrame(tick)
  }))

  await page.screenshot({ path: test.info().outputPath('band-fit-compact.png') })
  expect(probe.flips, 'no band changes its fit while nothing on the board changes').toEqual({})
  expect(probe.overflowing, 'bands that fit wrapped at full size do not overflow').toEqual([])
})
