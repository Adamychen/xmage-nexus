import { fakeOnly } from './support/fake-mode'
import { TABLE } from '../fixtures/table-names'
import { test, expect } from './fixtures'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { spellsScenario } from '../fixtures/scenarios/spells'
import type { Page } from '@playwright/test'

fakeOnly()

interface Box {
  x: number
  y: number
  width: number
  height: number
}

const MIN_VISIBLE_RATIO = 0.55

const RECT_OF = 'const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } };'

async function handBarBoxes(page: Page): Promise<{ bar: Box; slots: Box[] }> {
  return page.evaluate(`${RECT_OF}
    (() => {
      const bar = document.querySelector('[data-testid="hand-bar"]')
      if (!bar) throw new Error('hand-bar no encontrado')
      return {
        bar: rectOf(bar),
        slots: Array.from(bar.querySelectorAll('.hand-card-slot')).map(rectOf),
      }
    })()`)
}

/** Overlay: la mano flota sobre el fondo SIN consumir layout — el player-zone
 *  llega hasta el borde inferior del tablero y la barra está anclada a él. */
async function expectOverlayLayout(page: Page): Promise<void> {
  const boxes = await page.evaluate(`${RECT_OF}
    (() => {
      const bar = document.querySelector('[data-testid="hand-bar"]')
      const board = bar?.closest('.game-board, .pod-board')
      const zone = document.querySelector('.player-zone:not(.mirrored)')
      if (!bar || !board || !zone) throw new Error('hand-bar, tablero o player-zone no encontrado')
      return { bar: rectOf(bar), board: rectOf(board), zone: rectOf(zone) }
    })()`)
  expect(
    boxes.zone.y + boxes.zone.height,
    'el player-zone llega hasta el fondo del tablero (la mano no consume layout)',
  ).toBeGreaterThanOrEqual(boxes.board.y + boxes.board.height - 2)
  expect(
    boxes.bar.y + boxes.bar.height,
    'la barra de mano está anclada al fondo del tablero',
  ).toBeGreaterThanOrEqual(boxes.board.y + boxes.board.height - 2)
}

/** Cada carta de mano (salvo la primera) muestra >= MIN_VISIBLE_RATIO de su ancho. */
function expectMinVisibility(slots: Box[]): void {
  for (let i = 1; i < slots.length; i++) {
    const prevRight = slots[i - 1].x + slots[i - 1].width
    const overlap = Math.max(0, prevRight - slots[i].x)
    const visible = slots[i].width - overlap
    expect(
      visible,
      `carta ${i}: ${visible}px visibles de ${slots[i].width}px`,
    ).toBeGreaterThanOrEqual(slots[i].width * MIN_VISIBLE_RATIO - 1)
  }
}

async function expectHandBarLayout(page: Page): Promise<void> {
  const bar = page.locator('[data-testid="hand-bar"]')
  await expect(bar).toBeVisible()
  const slots = page.locator('[data-testid="hand-bar"] .hand-card-slot')
  await expect(slots.first()).toBeVisible({ timeout: 30_000 })
  // (los rivales espejados en pod comparten la clase .player-zone → excluimos)
  await expect(page.locator('.player-zone:not(.mirrored) .hand-card-slot')).toHaveCount(0)

  const { bar: barBox, slots: slotBoxes } = await handBarBoxes(page)
  expect(slotBoxes.length).toBeGreaterThanOrEqual(1)
  for (const [i, slot] of slotBoxes.entries()) {
    expect(slot.y, `carta ${i} dentro de la barra (top)`).toBeGreaterThanOrEqual(barBox.y - 2)
    expect(
      slot.y + slot.height,
      `carta ${i} dentro de la barra (bottom)`,
    ).toBeLessThanOrEqual(barBox.y + barBox.height + 2)
  }
  expectMinVisibility(slotBoxes)
  await expectOverlayLayout(page)
}

test('la mano propia flota como overlay anclado al fondo sin consumir layout (standard) @fullflow @hand-bar', async ({ page }) => {
  await withFakeServer(() => spellsScenario('blaze'), async () => {
    const { pageErrors } = await startGame(page, {
      prefix: 'hb',
      tableName: TABLE.spellsBlaze,
      skipAsks: true,
    })
    await expectHandBarLayout(page)
    expect(pageErrors).toEqual([])
  })
})

test('la mano propia flota como overlay full-width bajo el grid 2x2 (pod) @fullflow @hand-bar', async ({ page }) => {
  await withFakeServer(() => spellsScenario('blaze'), async () => {
    const { pageErrors } = await startGame(page, {
      prefix: 'hbp',
      tableName: TABLE.spellsBlaze,
      skipAsks: true,
    })

    await page.evaluate(() => {
      const store = (globalThis as unknown as {
        __mageStore?: { setSetting?: (k: string, v: unknown) => void }
      }).__mageStore
      store?.setSetting?.('boardLayout', 'pod')
    })
    await expect(page.locator('[data-testid="pod-board"]')).toBeVisible({ timeout: 15_000 })

    const widths = await page.evaluate(() => {
      const bar = document.querySelector('[data-testid="hand-bar"]')
      const pod = document.querySelector('[data-testid="pod-board"]')
      if (!bar || !pod) throw new Error('hand-bar o pod-board no encontrado')
      return { bar: bar.getBoundingClientRect().width, pod: pod.getBoundingClientRect().width }
    })
    expect(widths.bar, 'la barra cruza todo el ancho del pod').toBeGreaterThanOrEqual(widths.pod * 0.95)

    await expectHandBarLayout(page)
    expect(pageErrors).toEqual([])
  })
})
