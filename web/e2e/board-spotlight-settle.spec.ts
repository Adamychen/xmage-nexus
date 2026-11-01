import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { dismissSetupWizard } from './support/start-game'
import { DENSE, LAYOUT_SETTINGS, boardGame, diffRecords, drawBoard, flattenBoard, inspectBoard, type CardStyle } from './support/board-geometry'

fakeOnly()

test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })

const SETTLE_CAP_MS = 8000
const CALM_FRAMES = 30
const WINDOW_MS = 1000
const RESIZE_PATH = [1600, 1000, 1600]

async function installCounter(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const SIZING = ['--card-w', '--zone-card-w', 'flex', '--pile-corner-w'] as const
    const parse = (style: string) => {
      const probe = document.createElement('div')
      probe.setAttribute('style', style)
      return SIZING.map((prop) => probe.style.getPropertyValue(prop)).join('|')
    }
    const state = { writes: 0, total: 0 }
    ;(window as unknown as { __sizing: typeof state }).__sizing = state
    const board = document.querySelector<HTMLElement>('[data-testid$="-board"]')!
    const mo = new MutationObserver((records) => {
      for (const rec of records) {
        const el = rec.target as HTMLElement
        if (el.closest('.flying-cards-overlay')) continue
        if (rec.type !== 'attributes') continue
        if (rec.attributeName === 'style') {
          if (parse(rec.oldValue ?? '') !== parse(el.getAttribute('style') ?? '')) state.writes++
        } else if (rec.attributeName?.startsWith('data-band-') && (rec.oldValue ?? null) !== el.getAttribute(rec.attributeName)) {
          state.writes++
        }
      }
    })
    mo.observe(board, { attributes: true, subtree: true, attributeOldValue: true, attributeFilter: ['style', 'data-band-lines', 'data-band-overflow'] })
    const last = new Map<HTMLElement, string>()
    const poll = () => {
      document.querySelectorAll<HTMLElement>('.board-zone.has-pile-corner').forEach((zone) => {
        const value = getComputedStyle(zone).getPropertyValue('--pile-corner-w')
        if (last.has(zone) && last.get(zone) !== value) state.writes++
        last.set(zone, value)
      })
      requestAnimationFrame(poll)
    }
    requestAnimationFrame(poll)
  })
}

async function waitSettled(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(
    ({ calm, cap }: { calm: number; cap: number }) =>
      new Promise<number>((resolve) => {
        const state = (window as unknown as { __sizing: { writes: number } }).__sizing
        const started = performance.now()
        let quiet = 0
        let last = state.writes
        const frame = () => {
          if (state.writes === last) quiet++
          else {
            quiet = 0
            last = state.writes
          }
          if (quiet >= calm || performance.now() - started > cap) resolve(quiet >= calm ? 0 : 1)
          else requestAnimationFrame(frame)
        }
        requestAnimationFrame(frame)
      }),
    { calm: CALM_FRAMES, cap: SETTLE_CAP_MS },
  )
}

async function writesInWindow(page: import('@playwright/test').Page): Promise<number> {
  await page.evaluate(() => {
    ;(window as unknown as { __sizing: { writes: number } }).__sizing.writes = 0
  })
  await page.waitForTimeout(WINDOW_MS)
  return page.evaluate(() => (window as unknown as { __sizing: { writes: number } }).__sizing.writes)
}

for (const style of ['classic', 'compact'] as CardStyle[]) {
  test(`BRD-21: the spotlight board with pile cards and ${style} cards keeps every size once drawn and after resizing 1600 -> 1000 -> 1600 px`, async ({ page }) => {
    test.setTimeout(180_000)
    const settings = { ...LAYOUT_SETTINGS.table, boardFill: true, boardSpotlight: true, cardStyle: style }
    await page.setViewportSize({ width: RESIZE_PATH[0], height: 900 })
    await page.goto('/')
    await dismissSetupWizard(page)
    await drawBoard(page, boardGame(4, DENSE), settings)
    await expect(page.getByTestId('pile-corner').first()).toBeVisible({ timeout: 10_000 })
    await page.mouse.move(1, 1)
    await installCounter(page)
    const notes: string[] = []
    const drawnCalm = await waitSettled(page)
    if (drawnCalm) notes.push('drawn board never calmed')
    const drawn = await writesInWindow(page)
    if (drawn) notes.push(`drawn board: ${drawn} sizing writes after settle`)
    const fresh = flattenBoard(await inspectBoard(page))
    for (const width of RESIZE_PATH.slice(1)) {
      await page.setViewportSize({ width, height: 900 })
      if (await waitSettled(page)) notes.push(`resized to ${width}: never calmed`)
      const after = await writesInWindow(page)
      if (after) notes.push(`resized to ${width}: ${after} sizing writes after settle`)
    }
    const back = flattenBoard(await inspectBoard(page))
    expect({ notes, 'fresh 1600 px vs resized back to 1600 px': diffRecords(fresh, back) }).toEqual({ notes: [], 'fresh 1600 px vs resized back to 1600 px': [] })
  })
}
