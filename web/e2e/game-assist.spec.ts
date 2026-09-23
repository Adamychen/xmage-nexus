import { fakeOnly } from './support/fake-mode'
import { test, expect } from './fixtures'
import { DECK } from '../fixtures/deck-names'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { makeBaseScenario } from '../fixtures/fake'
import { makeCard, makeGameView, makePlayer, makePermanent } from '../src/__fixtures__/gameViews'
import {
  GAME_ID, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_NAME, SIM_PLAYER_ID, TABLE_ID,
} from '../fixtures/humanGameConstants'
import type { CardView, GameView, PermanentView } from '../src/net/types'
import type { Page } from '@playwright/test'
import { parseSent, sentOf } from './support/frames'

fakeOnly()

const RECAP_TABLE = 'turn-recap-test'

const knight = makePermanent({ id: 'rc-knight', name: 'Savannah Lions', power: '2', toughness: '1', cardTypes: ['CREATURE'], controlled: true })
const wall = makePermanent({ id: 'rc-wall', name: 'Wall of Stone', power: '0', toughness: '8', cardTypes: ['CREATURE'], controlled: true })
const bears = makePermanent({ id: 'rc-bears', name: 'Grizzly Bears', power: '2', toughness: '2', cardTypes: ['CREATURE'] })
const forest = makePermanent({ id: 'rc-forest', name: 'Forest', cardTypes: ['LAND'] })
const elves = makePermanent({ id: 'rc-elves', name: 'Llanowar Elves', power: '1', toughness: '1', cardTypes: ['CREATURE'] })

interface Opts {
  mine: boolean
  turn: number
  myLife?: number
  myBf?: Record<string, PermanentView>
  simBf?: Record<string, PermanentView>
  myGrave?: Record<string, CardView>
  stack?: Record<string, CardView>
  attackers?: string[]
}

function recapView(o: Opts): GameView {
  return makeGameView({
    players: [
      makePlayer({
        playerId: HUMAN_PLAYER_ID, name: HUMAN_NAME, controlled: true, isHuman: true,
        isActive: o.mine, hasPriority: o.mine, life: o.myLife ?? 20,
        battlefield: o.myBf ?? { [knight.id!]: knight, [wall.id!]: wall },
        graveyard: o.myGrave ?? {},
      }),
      makePlayer({ playerId: SIM_PLAYER_ID, name: SIM_NAME, isActive: !o.mine, hasPriority: !o.mine, battlefield: o.simBf ?? { [bears.id!]: bears } }),
    ],
    myPlayerId: HUMAN_PLAYER_ID,
    myHand: { 'rc-mountain': makeCard({ name: 'Mountain', parentId: 'rc-mountain', cardTypes: ['Land'] }) },
    activePlayerId: o.mine ? HUMAN_PLAYER_ID : SIM_PLAYER_ID,
    activePlayerName: o.mine ? HUMAN_NAME : SIM_NAME,
    priorityPlayerName: o.mine ? HUMAN_NAME : SIM_NAME,
    phase: 'PRECOMBAT_MAIN',
    step: 'PRECOMBAT_MAIN',
    turn: o.turn,
    stack: o.stack ?? {},
    combat: (o.attackers ? [{ attackers: o.attackers, blockers: [], defenders: [HUMAN_PLAYER_ID] }] : []) as never,
  })
}

function recapScenario() {
  const view = recapView({ mine: true, turn: 1 })
  return makeBaseScenario({ tableId: TABLE_ID, tableName: RECAP_TABLE, gameId: GAME_ID, gameView: view })
}

async function push(page: Page, view: GameView, method = 'GAME_UPDATE') {
  await page.evaluate(
    ({ gameView, gameId, method }) => {
      const store = (window as unknown as { __mageStore?: { handleMessage: (m: unknown) => void } }).__mageStore
      if (!store) throw new Error('no __mageStore')
      store.handleMessage({ type: 'event', method, messageId: Date.now(), objectId: gameId, data: { gameView } })
    },
    { gameView: view, gameId: GAME_ID, method },
  )
}

async function playOpponentTurn(page: Page) {
  const simBf = { [bears.id!]: bears, [forest.id!]: forest }
  await push(page, recapView({ mine: false, turn: 2 }))
  await push(page, recapView({ mine: false, turn: 2, simBf }))
  await push(page, recapView({ mine: false, turn: 2, simBf, stack: { 'rc-spell': makeCard({ id: 'rc-spell', name: 'Llanowar Elves', controllerId: SIM_PLAYER_ID }) } }))
  const full = { ...simBf, [elves.id!]: elves }
  await push(page, recapView({ mine: false, turn: 2, simBf: full, attackers: [bears.id!] }))
  await push(page, recapView({ mine: false, turn: 2, simBf: full, myLife: 18, myBf: { [wall.id!]: wall }, myGrave: { [knight.id!]: knight } }))
  await push(page, recapView({ mine: true, turn: 3, simBf: full, myLife: 18, myBf: { [wall.id!]: wall }, myGrave: { [knight.id!]: knight } }))
}

test('turn recap: strip summarises the opponent turn and marks new permanents @gamefeel', async ({ page }) => {
  await withFakeServer(recapScenario, async () => {
    const { pageErrors } = await startGame(page, { prefix: 'recap', tableName: RECAP_TABLE, deck: DECK.advanced, skipAsks: true })
    await expect(page.locator('.game-board')).toBeVisible({ timeout: 20_000 })

    await playOpponentTurn(page)

    const strip = page.getByTestId('turn-recap')
    await expect(strip).toBeVisible()
    await expect(page.getByTestId('turn-recap-summary')).toContainText('Llanowar Elves')
    await expect(page.getByTestId('turn-recap-summary')).toContainText('Grizzly Bears')
    await expect(page.getByTestId('turn-recap-departure')).toHaveAttribute('data-dest', 'graveyard')
    await expect(page.locator(`.card-slot[data-card-id="${elves.id}"]`)).toHaveAttribute('data-recap', 'new')
    await expect(page.locator(`.card-slot[data-card-id="${forest.id}"]`)).toHaveAttribute('data-recap', 'new')
    await page.screenshot({ path: 'test-results/turn-recap.png' })

    await strip.getByRole('button').click()
    await expect(strip).toBeHidden()
    await expect(page.locator('.card-slot[data-recap]')).toHaveCount(0)

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})

test('waiting state: the action button names who holds priority and counts up @gamefeel', async ({ page }) => {
  await withFakeServer(recapScenario, async () => {
    const { pageErrors } = await startGame(page, { prefix: 'wait', tableName: RECAP_TABLE, deck: DECK.advanced, skipAsks: true })
    await expect(page.locator('.game-board')).toBeVisible({ timeout: 20_000 })

    await push(page, recapView({ mine: false, turn: 2 }))
    const btn = page.locator('.big-action-btn.action-waiting')
    await expect(btn).toContainText(SIM_NAME)
    await expect(page.getByTestId('waiting-clock')).toBeVisible()
    await expect.poll(async () => Number(await page.getByTestId('waiting-clock').getAttribute('data-elapsed')), { timeout: 5_000 }).toBeGreaterThanOrEqual(2)
    await page.screenshot({ path: 'test-results/waiting-state.png' })

    await push(page, recapView({ mine: true, turn: 3 }))
    await expect(page.getByTestId('waiting-clock')).toHaveCount(0)

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})

test('P/T tint, summoning sickness and entered-this-turn glow @gamefeel', async ({ page }) => {
  await withFakeServer(recapScenario, async () => {
    const { pageErrors } = await startGame(page, { prefix: 'ptm', tableName: RECAP_TABLE, deck: DECK.advanced, skipAsks: true })
    await expect(page.locator('.game-board')).toBeVisible({ timeout: 20_000 })

    const base = (v: number) => ({ baseValue: v, modifiedBaseValue: v, boostedValue: v, cardValue: String(v) }) as never
    const pumped = { ...knight, power: '4', toughness: '3', originalPower: base(2), originalToughness: base(1) }
    const shrunk = { ...wall, toughness: '5', originalPower: base(0), originalToughness: base(8) }
    const goblin = makePermanent({ id: 'rc-goblin', name: 'Raging Goblin', power: '1', toughness: '1', cardTypes: ['CREATURE'], controlled: true, summoningSickness: true, originalPower: base(1), originalToughness: base(1) })
    await push(page, recapView({ mine: true, turn: 1, myBf: { [knight.id!]: pumped, [wall.id!]: shrunk } }))
    await push(page, recapView({ mine: true, turn: 1, myBf: { [knight.id!]: pumped, [wall.id!]: shrunk, [goblin.id!]: goblin } }))

    const slot = (id: string) => page.locator(`.card-slot[data-card-id="${id}"]`)
    await expect(slot(knight.id!).locator('.pt-value').first()).toHaveAttribute('data-trend', 'up')
    await expect(slot(wall.id!).locator('.pt-value').nth(1)).toHaveAttribute('data-trend', 'down')
    await expect(slot(goblin.id!)).toHaveAttribute('data-entered', 'turn')
    await expect(slot(goblin.id!).locator('.sickness-badge')).toBeVisible()
    await expect(slot(knight.id!)).not.toHaveAttribute('data-entered', 'turn')
    await expect.poll(() => page.locator('.flying-card-item, .flight-hidden, .entering').count(), { timeout: 10_000 }).toBe(0)
    const box = (await slot(knight.id!).boundingBox())!
    await page.screenshot({ path: 'test-results/pt-marks.png', clip: { x: box.x - 20, y: box.y - 20, width: 420, height: box.height + 40 } })

    await push(page, recapView({ mine: false, turn: 2, myBf: { [knight.id!]: pumped, [wall.id!]: shrunk, [goblin.id!]: goblin } }))
    await expect(slot(goblin.id!)).not.toHaveAttribute('data-entered', 'turn')

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})

test('attention alerts: hidden tab gets a title badge on my turn, cleared when visible @gamefeel', async ({ page }) => {
  await withFakeServer(recapScenario, async () => {
    const { pageErrors } = await startGame(page, { prefix: 'attn', tableName: RECAP_TABLE, deck: DECK.advanced, skipAsks: true })
    await expect(page.locator('.game-board')).toBeVisible({ timeout: 20_000 })
    const baseTitle = await page.title()

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    })
    await push(page, recapView({ mine: false, turn: 2 }))
    await push(page, recapView({ mine: true, turn: 3 }))
    await expect.poll(() => page.title()).toMatch(/^\(1\) /)

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect.poll(() => page.title()).toBe(baseTitle)

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})

test('smart stops: passes mana-only windows and stops when a spell is castable @gamefeel', async ({ page }) => {
  await withFakeServer(recapScenario, async () => {
    const { pageErrors } = await startGame(page, { prefix: 'smart', tableName: RECAP_TABLE, deck: DECK.advanced, skipAsks: true })
    await expect(page.locator('.game-board')).toBeVisible({ timeout: 20_000 })

    await page.locator('[data-testid="pass-split-toggle"]').click()
    await page.getByTestId('smart-stops-toggle').click()
    await page.keyboard.press('Escape')
    await expect.poll(() => page.evaluate(() => (window as unknown as { __mageStore: { getState: () => { settings: { smartStops: boolean } } } }).__mageStore.getState().settings.smartStops)).toBe(true)

    const passes = () => parseSent(sentOf(page)).filter((f) => f.action === 'sendPlayerBoolean' && f.args?.value === false).length
    const before = passes()
    const mana = { basicManaAbilities: [{ id: 'm1', value: '{T}: Add {R}.' }], basicPlayAbilities: [], basicCastAbilities: [], other: [] }
    const cast = { basicManaAbilities: [], basicPlayAbilities: [], basicCastAbilities: [{ id: 'c1', value: 'Cast Shock' }], other: [] }
    const oppUpkeep = (cycle: number, objects: Record<string, unknown>) => {
      const v = recapView({ mine: false, turn: 2 })
      const me = v.players!.find((p) => p.controlled)!
      me.hasPriority = true
      v.players!.find((p) => !p.controlled)!.hasPriority = false
      return { ...v, step: 'UPKEEP', phase: 'BEGINNING', gameCycle: cycle, canPlayObjects: { objects } } as GameView
    }

    await push(page, oppUpkeep(100, { 'rc-land': mana }))
    await page.waitForTimeout(600)
    expect(passes(), 'a GAME_UPDATE alone is not a priority request').toBe(before)
    await push(page, oppUpkeep(100, { 'rc-land': mana }), 'GAME_SELECT')
    await expect.poll(passes, { timeout: 5_000 }).toBe(before + 1)

    await push(page, oppUpkeep(101, { 'rc-land': mana, 'rc-shock': cast }), 'GAME_SELECT')
    await page.waitForTimeout(600)
    expect(passes()).toBe(before + 1)

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})
