import { fakeOnly } from './support/fake-mode'
import { test, expect } from './fixtures'
import { quickStartGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { dismissInfoWindows } from './support/info-windows'
import { mechanicsScenario } from '../fixtures/scenarios/mechanics'
import type { Page } from '@playwright/test'
import path from 'node:path'

fakeOnly()

const TALL = { width: 1600, height: 1200 }
const SMALL = { width: 1100, height: 640 }

type Rect = { x: number; y: number; width: number; height: number }

const SHOTS_DIR = process.env.E2E_SHOTS_DIR

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS_DIR) await page.screenshot({ path: path.join(SHOTS_DIR, name) })
}

async function setPreviewScale(page: Page, value: number): Promise<void> {
  await page.evaluate((v) => {
    const store = (globalThis as unknown as { __mageStore?: { setSetting?: (k: string, v: unknown) => void } }).__mageStore
    store?.setSetting?.('cardPreviewScale', v)
  }, value)
}

async function openPreview(page: Page): Promise<void> {
  const landSlot = page.locator('.player-zone:not(.mirrored) .permanents-band .card-slot').first()
  await expect(landSlot).toBeVisible({ timeout: 30_000 })
  const preview = page.locator('.floating-card-preview')
  await page.mouse.move(4, 4)
  await expect(preview).toHaveCount(0)
  await landSlot.hover()
  await expect(preview).toBeVisible({ timeout: 10_000 })
  await expect(preview).not.toHaveClass(/is-leaving/)
}

async function previewBoxes(page: Page): Promise<{ card: Rect; preview: Rect; board: Rect; viewport: { width: number; height: number } }> {
  await page.waitForTimeout(250)
  return page.evaluate(() => {
    const rectOf = (el: Element | null): Rect => {
      if (!el) throw new Error('element not found')
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    }
    const preview = document.querySelector('.floating-card-preview')
    return {
      card: rectOf(preview?.querySelector('.floating-card-main') ?? null),
      preview: rectOf(preview),
      board: rectOf(preview?.closest('.board-shell') ?? null),
      viewport: { width: window.innerWidth, height: window.innerHeight },
    }
  })
}

function expectInside(inner: Rect, outer: Rect, what: string): void {
  expect(inner.x, `${what}: left edge`).toBeGreaterThanOrEqual(outer.x - 1)
  expect(inner.y, `${what}: top edge`).toBeGreaterThanOrEqual(outer.y - 1)
  expect(inner.x + inner.width, `${what}: right edge`).toBeLessThanOrEqual(outer.x + outer.width + 1)
  expect(inner.y + inner.height, `${what}: bottom edge`).toBeLessThanOrEqual(outer.y + outer.height + 1)
}

test('SET-1: the card preview grows with the cardPreviewScale setting without restarting the game @board', async ({ page }) => {
  await page.setViewportSize(TALL)
  await withFakeServer(mechanicsScenario, async () => {
    const { pageErrors } = await quickStartGame(page, { prefix: 'cps', skipAsks: true })
    await dismissInfoWindows(page)

    await openPreview(page)
    const base = await previewBoxes(page)
    expect(base.card.width).toBeGreaterThan(0)
    expect(base.card.height / base.card.width).toBeCloseTo(448 / 320, 1)
    await shot(page, 'card-preview-100.png')

    await setPreviewScale(page, 1.5)
    await openPreview(page)
    const big = await previewBoxes(page)
    expect(big.card.width / base.card.width).toBeCloseTo(1.5, 1)
    expect(big.card.height / base.card.height).toBeCloseTo(1.5, 1)
    expectInside(big.preview, big.board, 'the 150% preview stays on the board')
    await shot(page, 'card-preview-150.png')

    await setPreviewScale(page, 0.75)
    await openPreview(page)
    const small = await previewBoxes(page)
    expect(small.card.width / base.card.width).toBeCloseTo(0.75, 1)

    await page.mouse.move(4, 4)
    expect(pageErrors).toEqual([])
  })
})

test('SET-1: the keyword side panel scales together with the card @board', async ({ page }) => {
  await page.setViewportSize(TALL)
  await withFakeServer(mechanicsScenario, async () => {
    const { pageErrors } = await quickStartGame(page, { prefix: 'cpk', skipAsks: true })
    await dismissInfoWindows(page)
    const beast = page.locator('.player-zone:not(.mirrored) [data-card-name="Keyword Beast"]').first()
    await expect(beast).toBeVisible({ timeout: 30_000 })
    const panelWidths = async () => {
      await page.mouse.move(4, 4)
      await expect(page.locator('.floating-card-preview')).toHaveCount(0)
      await beast.hover()
      const panel = page.locator('.floating-card-preview .floating-card-keywords')
      await expect(panel).toBeVisible({ timeout: 10_000 })
      await page.waitForTimeout(250)
      return page.evaluate(() => {
        const width = (sel: string) => document.querySelector(sel)?.getBoundingClientRect().width ?? 0
        return { card: width('.floating-card-preview .floating-card-main'), panel: width('.floating-card-preview .floating-card-keywords') }
      })
    }
    const base = await panelWidths()
    await setPreviewScale(page, 1.25)
    const big = await panelWidths()
    await shot(page, 'card-preview-keywords-125.png')
    expect(big.card / base.card).toBeCloseTo(1.25, 1)
    expect(big.panel / base.panel).toBeCloseTo(1.25, 1)
    await page.mouse.move(4, 4)
    expect(pageErrors).toEqual([])
  })
})

test.describe('SET-1 on a small screen', () => {
  test('SET-1: a 200% preview that does not fit shrinks to stay fully inside the board and the viewport @board', async ({ page }) => {
    await page.setViewportSize(TALL)
    await withFakeServer(mechanicsScenario, async () => {
      const { pageErrors } = await quickStartGame(page, { prefix: 'cpt', skipAsks: true })
      await dismissInfoWindows(page)

      await openPreview(page)
      const base = await previewBoxes(page)

      await page.mouse.move(4, 4)
      await page.setViewportSize(SMALL)
      await setPreviewScale(page, 2)
      await openPreview(page)
      const max = await previewBoxes(page)
      const ratio = max.card.width / base.card.width
      expect(ratio, 'the preview shrank instead of being clipped').toBeLessThan(2)
      const edgeGaps = [
        max.preview.y - max.board.y,
        max.board.y + max.board.height - (max.preview.y + max.preview.height),
        max.preview.x - max.board.x,
        max.board.x + max.board.width - (max.preview.x + max.preview.width),
      ]
      expect(Math.min(...edgeGaps), 'the shrunken preview still reaches the edge of the room it has').toBeLessThanOrEqual(24)
      expect(max.card.height / max.card.width).toBeCloseTo(448 / 320, 1)
      expectInside(max.preview, max.board, 'the 200% preview stays on the board')
      expectInside(max.preview, { x: 0, y: 0, ...max.viewport }, 'the 200% preview stays in the viewport')
      await shot(page, 'card-preview-200-small.png')

      await page.mouse.move(4, 4)
      expect(pageErrors).toEqual([])
    })
  })
})
