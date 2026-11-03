import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import {
  CARD_STYLES,
  DENSE,
  LAYOUT_SETTINGS,
  LAYOUTS,
  SEAT_COUNTS,
  boardGame,
  diffRecords,
  flattenBoard,
  inspectBoard,
  openBoard,
  overflowViolations,
  resizeBoard,
  settleAndCount,
  settleProblem,
  sharingViolations,
  type CardStyle,
  type Layout,
} from './support/board-geometry'

fakeOnly()

test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })

const WIDE = { width: 1600, height: 900 }
const NARROW = { width: 1000, height: 900 }
const HIDE_BAND_SCROLLBARS = '.bz-band { scrollbar-width: none !important; } .bz-band::-webkit-scrollbar { display: none !important; }'

function injectStyle(css: string): void {
  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style')
    style.textContent = css
    document.head.append(style)
  })
}

interface Case {
  layout: Layout
  seats: number
  style: CardStyle
  viewport: { width: number; height: number }
}

const SHARING_CASES: Case[] = [
  { layout: 'table', seats: 4, style: 'compact', viewport: NARROW },
  { layout: 'table', seats: 2, style: 'compact', viewport: NARROW },
  { layout: 'arena', seats: 4, style: 'classic', viewport: { width: 1366, height: 768 } },
]

const OVERFLOW_CASES: Case[] = [
  { layout: 'table', seats: 4, style: 'compact', viewport: NARROW },
  { layout: 'arena', seats: 4, style: 'classic', viewport: NARROW },
  { layout: 'table', seats: 4, style: 'classic', viewport: NARROW },
]

const HIDE_CASES: Case[] = [
  { layout: 'table', seats: 4, style: 'compact', viewport: NARROW },
  { layout: 'table', seats: 4, style: 'compact', viewport: { width: 1100, height: 900 } },
  { layout: 'arena', seats: 4, style: 'classic', viewport: NARROW },
]

function caseLabel(c: Case): string {
  return `the ${c.layout} board with ${c.seats} seats and ${c.style} cards at ${c.viewport.width}x${c.viewport.height}`
}

for (const layout of LAYOUTS) {
  for (const seats of SEAT_COUNTS) {
    for (const style of CARD_STYLES) {
      test(`BRD-25: the ${layout} board with ${seats} seats and ${style} cards is the same after 1600 -> 1000 -> 1600 px as drawn fresh, and the same at 1000 px as drawn fresh there`, async ({ page }) => {
        test.setTimeout(180_000)
        const game = boardGame(seats, DENSE)
        const settings = { ...LAYOUT_SETTINGS[layout], cardStyle: style }
        const notes: string[] = []

        await openBoard(page, NARROW, game, settings)
        const freshNarrowProblem = settleProblem(await settleAndCount(page))
        const freshNarrow = flattenBoard(await inspectBoard(page))

        await openBoard(page, WIDE, game, settings)
        const freshWideProblem = settleProblem(await settleAndCount(page))
        const freshWide = flattenBoard(await inspectBoard(page))

        await resizeBoard(page, NARROW)
        const resizedNarrowProblem = settleProblem(await settleAndCount(page))
        const resizedNarrow = flattenBoard(await inspectBoard(page))

        await resizeBoard(page, WIDE)
        const resizedWideProblem = settleProblem(await settleAndCount(page))
        const resizedWide = flattenBoard(await inspectBoard(page))

        if (freshNarrowProblem) notes.push(`fresh 1000 px: ${freshNarrowProblem}`)
        if (freshWideProblem) notes.push(`fresh 1600 px: ${freshWideProblem}`)
        if (resizedNarrowProblem) notes.push(`resized to 1000 px: ${resizedNarrowProblem}`)
        if (resizedWideProblem) notes.push(`resized back to 1600 px: ${resizedWideProblem}`)

        expect({
          notes,
          'fresh 1000 px vs resized into 1000 px': diffRecords(freshNarrow, resizedNarrow),
          'fresh 1600 px vs resized 1600 -> 1000 -> 1600 px': diffRecords(freshWide, resizedWide),
        }).toEqual({
          notes: [],
          'fresh 1000 px vs resized into 1000 px': [],
          'fresh 1600 px vs resized 1600 -> 1000 -> 1600 px': [],
        })
      })
    }
  }
}

for (const c of SHARING_CASES) {
  test(`BRD-26: in ${caseLabel(c)}, a band at the floor or scrolling leaves its row-mates no more than one card of room unused`, async ({ page }) => {
    test.setTimeout(120_000)
    await openBoard(page, c.viewport, boardGame(c.seats, DENSE), { ...LAYOUT_SETTINGS[c.layout], cardStyle: c.style })
    const problem = settleProblem(await settleAndCount(page))
    const info = await inspectBoard(page)
    expect([...(problem ? [`board did not settle: ${problem}`] : []), ...sharingViolations(info)]).toEqual([])
  })
}

for (const c of OVERFLOW_CASES) {
  test(`BRD-27: in ${caseLabel(c)}, a band that scrolls sideways takes no height for its scrollbar and carries data-band-overflow`, async ({ page }) => {
    test.setTimeout(120_000)
    await openBoard(page, c.viewport, boardGame(c.seats, DENSE), { ...LAYOUT_SETTINGS[c.layout], cardStyle: c.style })
    const problem = settleProblem(await settleAndCount(page))
    const info = await inspectBoard(page)
    expect([...(problem ? [`board did not settle: ${problem}`] : []), ...overflowViolations(info)]).toEqual([])
  })
}

for (const c of HIDE_CASES) {
  test(`BRD-27: in ${caseLabel(c)}, hiding the band scrollbars changes no size on the board`, async ({ page }) => {
    test.setTimeout(120_000)
    const game = boardGame(c.seats, DENSE)
    const settings = { ...LAYOUT_SETTINGS[c.layout], cardStyle: c.style }
    await openBoard(page, c.viewport, game, settings)
    const visibleProblem = settleProblem(await settleAndCount(page))
    const visible = flattenBoard(await inspectBoard(page))

    await page.addInitScript(injectStyle, HIDE_BAND_SCROLLBARS)
    await openBoard(page, c.viewport, game, settings)
    const hiddenProblem = settleProblem(await settleAndCount(page))
    const hidden = flattenBoard(await inspectBoard(page))
    const bandScrollbar = await page.evaluate(() => {
      const band = document.querySelector<HTMLElement>('.board-zone .bz-band')
      return band ? getComputedStyle(band).scrollbarWidth : 'no band'
    })

    expect([
      ...(visibleProblem ? [`drawn with scrollbars: ${visibleProblem}`] : []),
      ...(hiddenProblem ? [`drawn without scrollbars: ${hiddenProblem}`] : []),
      ...(bandScrollbar === 'none' ? [] : [`the hiding style did not apply (scrollbar-width ${bandScrollbar})`]),
      ...diffRecords(visible, hidden),
    ]).toEqual([])
  })
}
