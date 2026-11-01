import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import {
  CARD_STYLES,
  LAYOUT_SETTINGS,
  LAYOUTS,
  SEAT_COUNTS,
  SIZES,
  boardGame,
  drawBoard,
  loadApp,
  openBoard,
  resizeBoard,
  settleAndCount,
  settleProblem,
  type CardStyle,
  type Layout,
  type Size,
} from './support/board-geometry'

fakeOnly()

test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })

const VIEWPORTS = [
  { width: 1100, height: 700 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
]

const RESIZE_PATH = [1200, 1000, 1366, 1600]

function caseName(layout: Layout, seats: number, size: Size, style: CardStyle): string {
  return `the ${layout} board with ${seats} seats, ${size} boards and ${style} cards`
}

for (const layout of LAYOUTS) {
  for (const seats of SEAT_COUNTS) {
    for (const style of CARD_STYLES) {
      for (const size of Object.keys(SIZES) as Size[]) {
        test(`BRD-21: ${caseName(layout, seats, size, style)} keeps every size once drawn and after resizing`, async ({ page }) => {
          test.setTimeout(240_000)
          const game = boardGame(seats, SIZES[size])
          const settings = { ...LAYOUT_SETTINGS[layout], cardStyle: style }
          const violations: string[] = []

          await loadApp(page)
          for (const viewport of VIEWPORTS) {
            await resizeBoard(page, viewport)
            await drawBoard(page, game, settings)
            const problem = settleProblem(await settleAndCount(page))
            if (problem) violations.push(`drawn at ${viewport.width}x${viewport.height}: ${problem}`)
          }

          await openBoard(page, { width: 1600, height: 900 }, game, settings)
          const drawn = settleProblem(await settleAndCount(page))
          if (drawn) violations.push(`drawn at 1600x900 before resizing: ${drawn}`)

          for (const width of RESIZE_PATH) {
            await resizeBoard(page, { width, height: 900 })
            const problem = settleProblem(await settleAndCount(page))
            if (problem) violations.push(`resized to ${width}x900: ${problem}`)
          }

          expect(violations, 'board size changes after it settled').toEqual([])
        })
      }
    }
  }
}
