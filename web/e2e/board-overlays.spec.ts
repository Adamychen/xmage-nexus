import { fakeOnly } from './support/fake-mode'
import { test, expect } from './fixtures'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { allInteractionsScenario } from '../fixtures/scenarios/allInteractions'
import { cardOverlaysScenario, OV_BASE_BEARS, OV_BUFFED_MYSTIC, OV_SICK_TAPPED, OV_OPP_BEAST, OV_TOKEN } from '../fixtures/scenarios/cardOverlays'
import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'
import type { Page } from '@playwright/test'

fakeOnly()

/**
 * Issue #12: the layers drawn on top of a card, which the reporter asked to be
 * able to switch off.
 *
 * The seeded value is always the NON-default one, because that is the function
 * that was added; the defaults (`always` / `badge`) are the pre-existing
 * behaviour and are pinned by the truth table in `CardSlot.test.tsx`. What the
 * browser adds over that jsdom table is the real CSS: the compact tile, the
 * stacking of the two layers, and the `loadAppearanceSettings` → render link (a
 * misspelled key in the normalizer silently drops a stored setting, which no
 * unit test would notice).
 *
 * Settings are seeded into `localStorage` before the page loads instead of
 * clicking the controls: reloading mid-game returns to the lobby, and the
 * control → `setSetting` → store link is already covered by `CardSlot` and
 * `HandBar`.
 *
 * `cardOverlaysScenario` is a dedicated fixture (a fixed board with a creature
 * at printed P/T, two buffed ones, a token without a printed value and a sick
 * but tapped one) so the assertions can name the card they expect the layer on.
 */
async function seedAppearance(page: Page, patch: Record<string, unknown>) {
  await page.addInitScript((p) => {
    const KEY = 'mage-web-appearance'
    let current: Record<string, unknown> = {}
    try {
      current = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    } catch {
      current = {}
    }
    localStorage.setItem(KEY, JSON.stringify({ ...current, ...p }))
  }, patch)
}

/** The fixture board, with the P/T badge layer already painted (the assert that
 *  pins `ptBadgeMode` only means something if the default was showing badges). */
async function openOverlayBoard(page: Page) {
  const session = await withFakeServer(cardOverlaysScenario, async () => {
    const s = await startGame(page, {
      prefix: 'ovl',
      tableName: TABLE.cardOverlays,
      deck: DECK.advanced,
      simDeck: DECK.advanced,
      skipAsks: true,
    })
    await expect(page.locator('.player-zone .card-slot').first()).toBeVisible({ timeout: 30_000 })
    return s
  })
  return session
}

const card = (page: Page, id: string) => page.locator(`.player-zone .card-slot[data-card-id="${id}"]`)
const oppCard = (page: Page, id: string) => page.locator(`.opponent-zone .card-slot[data-card-id="${id}"]`)

test.describe('capas sobre la carta @board', () => {
  test('los pips de coste de la mano respetan showHandCost', async ({ page }) => {
    await seedAppearance(page, { showHandCost: false })
    await withFakeServer(() => allInteractionsScenario(), async () => {
      const { pageErrors } = await startGame(page, {
        prefix: 'ovl',
        tableName: TABLE.allInteractions,
        deck: DECK.advanced,
        simDeck: DECK.advanced,
        skipAsks: true,
      })
      const pips = page.locator('.hand-bar .hand-card-cost')
      await expect(page.locator('.hand-bar .hand-card').first()).toBeVisible({ timeout: 30_000 })
      await expect(pips).toHaveCount(0)
      // Solo se apagó la capa extra: la mano sigue pintada y jugable.
      await expect(page.locator('.hand-bar .hand-card').first()).toBeVisible()
      expect(pageErrors).toEqual([])
    })
  })

  test('the default draws the P/T badge on every creature @board', async ({ page }) => {
    const { pageErrors } = await openOverlayBoard(page)
    await expect(card(page, OV_BASE_BEARS).locator('.pt-badge')).toBeVisible()
    await expect(card(page, OV_BUFFED_MYSTIC).locator('.pt-badge')).toBeVisible()
    expect(pageErrors).toEqual([])
  })

  test('ptBadgeMode changed: only where the printed P/T really moved @board', async ({ page }) => {
    await seedAppearance(page, { ptBadgeMode: 'changed' })
    const { pageErrors } = await openOverlayBoard(page)

    // 2/2 printed 2/2: no layer. This is the case that distinguishes 'changed'
    // from 'always'; without it the mode could not be told apart from the default.
    await expect(card(page, OV_BASE_BEARS).locator('.pt-badge')).toHaveCount(0)
    // 3/1 printed 1/1: the badge stays, and says what it is for.
    const buffed = card(page, OV_BUFFED_MYSTIC).locator('.pt-badge')
    await expect(buffed).toBeVisible()
    await expect(buffed).toHaveText('3/1')
    await expect(buffed).toHaveAttribute('data-trend', 'changed')
    // A token carries no printed value: there is nothing to compare against, so
    // hiding the numbers would hide the information (design decision).
    await expect(card(page, OV_TOKEN).locator('.pt-badge')).toBeVisible()
    expect(pageErrors).toEqual([])
  })

  test('sicknessStyle veil: replaces the clock, does not cover the badge @board', async ({ page }) => {
    await seedAppearance(page, { sicknessStyle: 'veil' })
    const { pageErrors } = await openOverlayBoard(page)

    const mystic = card(page, OV_BUFFED_MYSTIC)
    await expect(mystic.locator('.sickness-veil')).toBeVisible()
    await expect(mystic.locator('.sickness-badge')).toHaveCount(0)
    // The veil is drawn under the badge (z-4 vs z-5): the numbers must survive it.
    await expect(mystic.locator('.pt-badge')).toBeVisible()

    // A tapped creature gets neither layer, in either style.
    const tapped = card(page, OV_SICK_TAPPED)
    await expect(tapped.locator('.sickness-veil')).toHaveCount(0)
    await expect(tapped.locator('.sickness-badge')).toHaveCount(0)

    // The top zone uses the same component: cover it once.
    await expect(oppCard(page, OV_OPP_BEAST).locator('.sickness-veil')).toBeVisible()
    expect(pageErrors).toEqual([])
  })

  test('compact tiles keep both layers inside the card box @board', async ({ page }) => {
    await seedAppearance(page, { cardStyle: 'compact', sicknessStyle: 'veil', ptBadgeMode: 'changed' })
    const { pageErrors } = await openOverlayBoard(page)

    // Without this the test would pass while still drawing classic cards.
    await expect(page.locator('.player-zone .card-slot.is-compact').first()).toBeVisible()

    const mystic = card(page, OV_BUFFED_MYSTIC)
    await expect(mystic.locator('.sickness-veil')).toBeVisible()
    const badge = mystic.locator('.pt-badge')
    await expect(badge).toBeVisible()

    // Clipping guard: the shrunk badge must stay inside its own tile.
    const box = await mystic.boundingBox()
    const badgeBox = await badge.boundingBox()
    expect(box).not.toBeNull()
    expect(badgeBox).not.toBeNull()
    expect(badgeBox!.x).toBeGreaterThanOrEqual(box!.x - 1)
    expect(badgeBox!.y).toBeGreaterThanOrEqual(box!.y - 1)
    expect(badgeBox!.x + badgeBox!.width).toBeLessThanOrEqual(box!.x + box!.width + 1)
    expect(badgeBox!.y + badgeBox!.height).toBeLessThanOrEqual(box!.y + box!.height + 1)
    expect(pageErrors).toEqual([])
  })
})
