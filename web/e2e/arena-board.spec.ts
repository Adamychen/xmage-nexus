import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

fakeOnly()

const SHOTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots')

const RECT_OF =
  'const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } };'

function commanderGame() {
  const mkPlayer = (id: string, name: string, controlled: boolean) => ({
    playerId: id,
    name,
    life: 40,
    controlled,
    isActive: controlled,
    hasPriority: controlled,
    isHuman: controlled,
    defeated: false,
    left: false,
    battlefield: {},
    handCount: controlled ? 3 : 0,
    libraryCount: 40,
    counters: [],
    commandList: [
      { id: `cmd-${id}`, name: controlled ? 'Atraxa, Praetors Voice' : `Commander ${name}`, mageObjectType: 'COMMANDER' },
    ],
    designationNames: [],
    manaPool: { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 },
    timers: {},
  })
  return {
    players: [mkPlayer('p1', 'Alice', true), mkPlayer('p2', 'Bob', false), mkPlayer('p3', 'Carol', false)],
    myPlayerId: 'p1',
    myHand: {
      'h-1': { id: 'h-1', name: 'Island', parentId: 'h-1', manaValue: 0, expansionSetCode: '', cardNumber: '0' },
      'h-2': { id: 'h-2', name: 'Island', parentId: 'h-2', manaValue: 0, expansionSetCode: '', cardNumber: '0' },
      'h-3': { id: 'h-3', name: 'Counterspell', parentId: 'h-3', manaValue: 2, expansionSetCode: '', cardNumber: '0' },
    },
    turn: 2,
    phase: 'PRECOMBAT_MAIN',
    step: 'PRECOMBAT_MAIN',
    activePlayerId: 'p1',
    activePlayerName: 'Alice',
    priorityPlayerName: 'Alice',
    stack: {},
    combat: [],
    canPlayObjects: {},
    opponentHands: {},
    watchedHands: {},
    revealed: [],
    exiles: {},
  }
}

test('arena layout: mi campo a ancho completo, rivales en columnas, mano overlay @arena', async ({ page }) => {
  fs.mkdirSync(SHOTS_DIR, { recursive: true })
  await page.goto('/')
  await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(400)
  // Inyectar GameView de 3 jugadores + modo arena
  await page.evaluate((gameView) => {
    const store = (globalThis as unknown as { __mageStore?: { getState: () => Record<string, any>; setState: (s: unknown) => void } }).__mageStore
    const st = store?.getState() as { settings: Record<string, unknown> }
    store?.setState({ phase: 'game', settings: { ...st.settings, boardLayout: 'arena' }, game: gameView })
  }, commanderGame())

  const board = page.locator('[data-testid="arena-board"]')
  await expect(board).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.arena-opp-cell')).toHaveCount(2)
  await expect(page.locator('.arena-board > .player-zone')).toBeVisible()
  await expect(page.locator('.arena-board > .player-zone.compact-pod')).toHaveCount(0)

  // mano overlay presente y anclada al fondo del tablero
  const bar = page.locator('[data-testid="hand-bar"]')
  await expect(bar).toBeVisible()
  const boxes = await page.evaluate(`${RECT_OF}
    (() => {
      const bar = document.querySelector('[data-testid="hand-bar"]')
      const board = document.querySelector('[data-testid="arena-board"]')
      const zone = document.querySelector('.arena-board > .player-zone')
      if (!bar || !board || !zone) throw new Error('arena-board, hand-bar o player-zone no encontrado')
      return { bar: rectOf(bar), board: rectOf(board), zone: rectOf(zone) }
    })()`)
  expect(
    boxes.zone.y + boxes.zone.height,
    'player-zone llega al fondo del arena-board (la mano no consume layout)',
  ).toBeGreaterThanOrEqual(boxes.board.y + boxes.board.height - 2)
  expect(boxes.bar.y + boxes.bar.height, 'mano anclada al fondo').toBeGreaterThanOrEqual(
    boxes.board.y + boxes.board.height - 2,
  )

  await page.waitForTimeout(400)
  fs.writeFileSync(path.join(SHOTS_DIR, 'arena-layout-commander.png'), await page.screenshot({ fullPage: true }))
})
