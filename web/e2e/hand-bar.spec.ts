import { fakeOnly } from './support/fake-mode'
import { TABLE } from '../fixtures/table-names'
import { test, expect } from './fixtures'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { spellsScenario } from '../fixtures/scenarios/spells'
import { mechanicsScenario } from '../fixtures/scenarios/mechanics'
import { HAND_BAR_REST_OVERLAP_RATIO } from '../src/board/handSizing'
import type { Page } from '@playwright/test'

fakeOnly()

interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** Visible horizontal ratio per card at rest = 1 - rest overlap (mirrors the HandBar CSS token). */
const MIN_VISIBLE_RATIO = 1 - HAND_BAR_REST_OVERLAP_RATIO

const RECT_OF = 'const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } };'

/** Overlay: la mano flota sobre el fondo SIN consumir layout — el player-zone
 *  llega hasta el borde inferior del tablero y la barra está anclada a él. */
async function expectOverlayLayout(page: Page): Promise<void> {
  const boxes = await page.evaluate(`${RECT_OF}
    (() => {
      const bar = document.querySelector('[data-testid="hand-bar"]')
      const board = bar?.closest('.game-board, .pod-board, .arena-board')
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

  const boxes = await page.evaluate(`${RECT_OF}
    (() => {
      const bar = document.querySelector('[data-testid="hand-bar"]')
      const board = bar?.closest('.game-board, .pod-board, .arena-board')
      if (!bar || !board) throw new Error('hand-bar o tablero no encontrado')
      return {
        bar: rectOf(bar),
        board: rectOf(board),
        slots: Array.from(bar.querySelectorAll('.hand-card-slot')).map(rectOf),
        cards: Array.from(bar.querySelectorAll('.hand-card')).map(rectOf),
      }
    })()`)
  expect(boxes.slots.length).toBeGreaterThanOrEqual(1)
  expect(boxes.cards.length).toBe(boxes.slots.length)

  // Los slots (caja de layout) quedan anclados al borde inferior de la banda.
  // Su caja estática es SOLO la banda visible (~cardH×0.5): si creciera a la
  // altura completa de la carta, un puntero sobre las tierras dispararía el
  // hover sin carta visible (y al elevarse la mano, oscilación por feedback).
  for (const [i, slot] of boxes.slots.entries()) {
    expect(slot.y, `carta ${i}: slot dentro de la banda visible (top)`).toBeGreaterThanOrEqual(
      boxes.bar.y - 2,
    )
    expect(
      slot.y + slot.height,
      `carta ${i} anclada al borde inferior de la banda de mano`,
    ).toBeLessThanOrEqual(boxes.bar.y + boxes.bar.height + 2)
  }

  // La carta (caja transformada) se hunde tras el borde inferior del tablero:
  // en reposo solo se ve la mitad superior ("de la mitad para arriba"),
  // con tolerancia al arco/rotación de las cartas de los extremos.
  const boardBottom = boxes.board.y + boxes.board.height
  for (const [i, card] of boxes.cards.entries()) {
    expect(
      card.y + card.height,
      `carta ${i} hundida tras el borde inferior del tablero`,
    ).toBeGreaterThanOrEqual(boardBottom - 2)
    const visible = boardBottom - card.y
    expect(
      visible,
      `carta ${i}: mitad superior visible (${visible}px de ${card.height}px)`,
    ).toBeGreaterThanOrEqual(card.height * 0.3)
    expect(visible).toBeLessThanOrEqual(card.height * 0.7)
  }

  expectMinVisibility(boxes.slots)
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

test('el hover en la mano propia muestra la carta en grande y legible (preview flotante) @fullflow @hand-bar', async ({ page }) => {
  await withFakeServer(() => spellsScenario('blaze'), async () => {
    const { pageErrors } = await startGame(page, {
      prefix: 'hbh',
      tableName: TABLE.spellsBlaze,
      skipAsks: true,
    })
    const slots = page.locator('[data-testid="hand-bar"] .hand-card-slot')
    await expect(slots.first()).toBeVisible({ timeout: 30_000 })
    const preview = page.locator('.floating-card-preview')
    await expect(preview).toHaveCount(0)

    await slots.first().hover()
    await expect(preview).toBeVisible({ timeout: 10_000 })
    await expect(preview, 'el preview nace de la carta en mano (morph)').toHaveClass(/is-morph/)
    await expect(preview, 'el morph termina en tamaño completo').toHaveClass(/is-open/, { timeout: 10_000 })
    const boxes = await page.evaluate(() => {
      const rectOf = (el: Element) => {
        const r = el.getBoundingClientRect()
        return { y: r.y, height: r.height }
      }
      const pv = document.querySelector('.floating-card-preview') as HTMLElement | null
      const slot = document.querySelector('[data-testid="hand-bar"] .hand-card-slot')
      if (!pv || !slot) throw new Error('preview o slot no encontrado')
      // offsetWidth ignora la escala transitoria de la animación de entrada
      return { pv: { ...rectOf(pv), width: pv.offsetWidth }, slot: rectOf(slot) }
    })
    expect(
      boxes.pv.width,
      'el preview es grande y legible (320px frente a ~136px de la carta en mano)',
    ).toBeGreaterThanOrEqual(300)
    // La caja final solo es estable al terminar la transición del morph:
    // se sondea hasta que el borde inferior deja de moverse por encima de la carta.
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const pv = document.querySelector('.floating-card-preview') as HTMLElement | null
            const slot = document.querySelector('[data-testid="hand-bar"] .hand-card-slot')
            if (!pv || !slot) throw new Error('preview o slot no encontrado')
            const r = pv.getBoundingClientRect()
            return r.y + r.height - (slot.getBoundingClientRect().y + 40)
          }),
        { timeout: 10_000 },
      )
      .toBeLessThanOrEqual(0)

    await page.locator('.board-shell-divider-diamond').hover()
    await expect(preview).toHaveCount(0)
    expect(pageErrors).toEqual([])
  })
})

test('el hover en tierras del campo no hace morph (preview clásico) @fullflow @hand-bar', async ({ page }) => {
  await withFakeServer(mechanicsScenario, async () => {
    const { pageErrors } = await startGame(page, {
      prefix: 'hbl',
      tableName: TABLE.mechanics,
      skipAsks: true,
    })
    // La Mountain propia vive en la fila de permanentes, pegada a la mano.
    const landSlot = page.locator('.player-zone:not(.mirrored) .permanents-band .card-slot').first()
    await expect(landSlot).toBeVisible({ timeout: 30_000 })
    const preview = page.locator('.floating-card-preview')
    await expect(preview).toHaveCount(0)

    await landSlot.hover()
    await expect(preview).toBeVisible({ timeout: 10_000 })
    await expect(preview, 'las tierras del campo no usan el morph de la mano').not.toHaveClass(/is-morph/)

    await page.locator('.board-shell-divider-diamond').hover()
    await expect(preview).toHaveCount(0)
    expect(pageErrors).toEqual([])
  })
})

test('la mano propia ocupa toda la fila inferior del pod 1v1 @fullflow @hand-bar', async ({ page }) => {
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

    // En pod 1v1 el humano está solo en la fila inferior (abajo-derecha vacío,
    // rival arriba-izquierda): la mano usa todo el ancho inferior, como en
    // standard y como en pod 3j (regla pod-board--bottom-full).
    const boxes = await page.evaluate(() => {
      const bar = document.querySelector('[data-testid="hand-bar"]')
      const pod = document.querySelector('[data-testid="pod-board"]')
      if (!bar || !pod) throw new Error('hand-bar o pod-board no encontrado')
      const rectOf = (el: Element) => {
        const r = el.getBoundingClientRect()
        return { x: r.x, width: r.width }
      }
      return { bar: rectOf(bar), pod: rectOf(pod) }
    })
    expect(
      boxes.bar.width,
      'la mano ocupa toda la fila inferior del pod',
    ).toBeGreaterThanOrEqual(boxes.pod.width * 0.9)
    expect(
      boxes.bar.x,
      'la mano empieza en el borde izquierdo del pod',
    ).toBeLessThanOrEqual(boxes.pod.x + 2)

    await expectHandBarLayout(page)
    expect(pageErrors).toEqual([])
  })
})
