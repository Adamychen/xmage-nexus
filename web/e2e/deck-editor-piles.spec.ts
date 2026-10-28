import type { Locator, Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { withFakeServer } from './support/fake-backend'
import { proxyPort } from './dual'
import { dismissSetupWizard } from './support/start-game'
import { waitForStacksSettled } from './support/deck-editor'
import { decksGalleryScenario } from '../fixtures/scenarios/decksGallery'

const PILES = '[data-testid="deck-editor-piles"]'
const BAND = '[data-testid="deck-editor-side-band"]'
const BOLT = '[data-card-key$=":Lightning Bolt"]'

const BOLT_PRINTING = {
  object: 'card',
  name: 'Lightning Bolt',
  lang: 'en',
  set: 'm10',
  collector_number: '146',
  mana_cost: '{R}',
  cmc: 1,
  type_line: 'Instant',
  colors: ['R'],
  color_identity: ['R'],
  oracle_text: 'Lightning Bolt deals 3 damage to any target.',
}

const MOUNTAIN_PRINTING = {
  object: 'card',
  name: 'Mountain',
  lang: 'en',
  set: 'lea',
  collector_number: '292',
  mana_cost: '',
  cmc: 0,
  type_line: 'Basic Land — Mountain',
  colors: [],
  color_identity: ['R'],
  oracle_text: '({T}: Add {R}.)',
}

function user(tag: string) {
  return `${tag}_${String(Date.now()).slice(-6)}`
}

async function stubScryfallPrecon(page: Page) {
  await page.route('**/api.scryfall.com/**', (route) => route.fulfill({ status: 404, body: 'not part of the precon' }))
  await page.route('**/api.scryfall.com/cards/search**', (route) => route.fulfill({ json: { object: 'list', total_cards: 0, data: [] } }))
  await page.route('**/api.scryfall.com/cards/m10/146**', (route) => route.fulfill({ json: BOLT_PRINTING }))
  await page.route('**/api.scryfall.com/cards/lea/292**', (route) => route.fulfill({ json: MOUNTAIN_PRINTING }))
}

async function openPreconInEditor(page: Page, name: string) {
  await stubScryfallPrecon(page)
  await page.goto(`/?proxyPort=${proxyPort()}`)
  await dismissSetupWizard(page)
  await page.getByPlaceholder(/Usuario|Username/i).fill(name)
  await page.getByPlaceholder(/Contraseña|Password/i).fill('pass')
  await page.getByRole('button', { name: /Conectar/i }).click()
  await expect(page.getByRole('button', { name: /Mesas/ })).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /Mis Mazos|Mazos/i }).click()
  await expect(page.locator('.decks-gallery')).toBeVisible({ timeout: 8000 })
  await page.locator('.deck-box', { hasText: /Precon/ }).first().click()
  await page.locator('.decks-edit-btn').click()
  await expect(page.locator(PILES)).toBeVisible({ timeout: 8000 })
  await waitForStacksSettled(page)
}

function frontBolt(page: Page): Locator {
  return page.locator(`${PILES} .arena-stack-card[data-front="true"]${BOLT}`)
}

function slider(page: Page) {
  return page.locator('.deck-editor-scale .arena-grid-size-slider')
}

test.describe('Deck editor piles', () => {
  test('DCK-1: the card size slider doubles the pile cards and leaves the sideboard band size alone @decks', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 720 })
    await withFakeServer(decksGalleryScenario, async () => {
      await openPreconInEditor(page, user('dck1'))
      await expect(slider(page)).toHaveValue('100')

      const face = frontBolt(page).locator('.arena-stack-face')
      const width = async (loc: Locator) => (await loc.boundingBox())?.width ?? 0
      await expect.poll(() => width(face)).toBeGreaterThan(0)
      const face100 = await width(face)
      const band100 = await page.locator(BAND).boundingBox()

      await slider(page).fill('200')
      await expect(page.locator('.deck-editor-scale .arena-grid-size-value')).toHaveText('200%')
      await expect.poll(async () => (await width(face)) / face100).toBeGreaterThan(1.8)
      expect((await width(face)) / face100).toBeLessThan(2.3)

      const band200 = await page.locator(BAND).boundingBox()
      expect(Math.abs((band200?.width ?? 0) - (band100?.width ?? 0))).toBeLessThanOrEqual(1)
      expect(Math.abs((band200?.height ?? 0) - (band100?.height ?? 0))).toBeLessThanOrEqual(1)
      expect(await page.evaluate(() => localStorage.getItem('mage-web-deck-stacks-scale'))).toBe('200')
    })
  })

  test('DCK-1: at 200% the piles scroll inside themselves and the page never scrolls sideways @decks', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 720 })
    await withFakeServer(decksGalleryScenario, async () => {
      await openPreconInEditor(page, user('dck1s'))
      const drawer = await page.locator('.builder-left').boundingBox()
      const panel = await page.locator('.deck-editor-panel').boundingBox()
      await slider(page).fill('200')
      await expect(page.locator('.deck-editor-scale .arena-grid-size-value')).toHaveText('200%')

      const piles = page.locator(PILES)
      await expect.poll(() => piles.evaluate((el) => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight)).toBe(true)
      const scrolled = await piles.evaluate((el) => {
        el.scrollTo({ left: el.scrollWidth, top: el.scrollHeight })
        return el.scrollLeft + el.scrollTop
      })
      expect(scrolled).toBeGreaterThan(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
      expect(await page.evaluate(() => window.scrollX)).toBe(0)
      expect(await page.locator('.builder-left').boundingBox()).toEqual(drawer)
      expect(await page.locator('.deck-editor-panel').boundingBox()).toEqual(panel)
    })
  })

  test('DCK-5: Open shows the deck in Piles view and List view shows its strips @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await openPreconInEditor(page, user('dck5'))
      await expect(page.locator('[data-control="view"] [data-value="piles"]')).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('.deck-editor-list')).toHaveCount(0)

      await page.locator('[data-control="view"] [data-value="list"]').click()
      await expect(page.locator(PILES)).toHaveCount(0)
      await expect(page.locator('.deck-editor-list .arena-card-strip', { hasText: /Lightning Bolt|Relámpago/ }).first()).toBeVisible({ timeout: 8000 })
    })
  })

  test('DCK-5: the chosen view is still List after a reload @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      const name = user('dck5r')
      await openPreconInEditor(page, name)
      await page.locator('[data-control="view"] [data-value="list"]').click()
      await expect(page.locator('.deck-editor-list')).toBeVisible()
      expect(await page.evaluate(() => localStorage.getItem('mage-web-deck-editor-view'))).toBe('"list"')

      await page.reload()
      await expect(page.getByRole('button', { name: /Mesas/ })).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: /Mis Mazos|Mazos/i }).click()
      await page.locator('.deck-box:not(.deck-box-create):not(:has(.deck-box-precon))').first().click()
      await page.locator('.decks-edit-btn').click()
      await expect(page.locator('.deck-builder-body')).toBeVisible({ timeout: 8000 })
      await expect(page.locator('[data-control="view"] [data-value="list"]')).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator(PILES)).toHaveCount(0)
    })
  })

  test('DCK-6: Group switches the pile columns to mana value, colour and rarity @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await openPreconInEditor(page, user('dck6'))
      const group = (value: string) => page.locator(`.deck-editor-toolbar [data-control="group"] [data-value="${value}"]`)

      await group('cmc').click()
      await expect(page.locator(`${PILES} [data-column="cmc-1"]`)).toBeVisible({ timeout: 8000 })
      await expect(page.locator(`${PILES} [data-column="lands"]`)).toBeVisible()

      await group('color').click()
      await expect(page.locator(`${PILES} [data-column="R"]`)).toBeVisible({ timeout: 8000 })
      await expect(page.locator(`${PILES} [data-column="cmc-1"]`)).toHaveCount(0)

      await group('rarity').click()
      await expect(page.locator(`${PILES} [data-column="other"]`)).toBeVisible({ timeout: 8000 })
      await expect(page.locator(`${PILES} [data-column="R"]`)).toHaveCount(0)
    })
  })

  test('DCK-7: in Free, one copy dropped on "+ New pile" makes a pile of its own that survives Done and reopening @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      const name = user('dck7')
      await openPreconInEditor(page, name)
      await page.locator('.deck-editor-toolbar [data-control="group"] [data-value="free"]').click()
      await expect(page.locator(`${PILES} .arena-stack-col[data-kind="pile"]`, { has: page.locator(BOLT) })).toHaveCount(1, { timeout: 8000 })

      const newPile = page.locator(`${PILES} [data-column="__new__"]`)
      await expect(newPile).toBeVisible({ timeout: 8000 })
      await frontBolt(page).dragTo(newPile)

      const boltPiles = page.locator(`${PILES} .arena-stack-col[data-kind="pile"]`, { has: page.locator(BOLT) })
      await expect(boltPiles).toHaveCount(2)
      await expect(boltPiles.last().locator(BOLT)).toHaveCount(1)
      await expect(boltPiles.last().locator('.arena-stack-col-name')).toHaveText(/\d$/)
      await expect(boltPiles.first().locator(`${BOLT}[data-front="true"] .arena-stack-qty`)).toHaveText('×3')

      await page.locator('[data-testid="builder-done"]').click()
      await expect(page.locator('.decks-gallery')).toBeVisible({ timeout: 8000 })
      await page.locator('.deck-box:not(.deck-box-create):not(:has(.deck-box-precon))').first().click()
      await page.locator('.decks-edit-btn').click()
      await expect(page.locator(PILES)).toBeVisible({ timeout: 8000 })
      await waitForStacksSettled(page)
      await expect(page.locator(`${PILES} .arena-stack-col[data-kind="pile"]`, { has: page.locator(BOLT) })).toHaveCount(2)
      await expect(page.locator(`${PILES} .arena-stack-col[data-kind="pile"]`, { has: page.locator(BOLT) }).last().locator(BOLT)).toHaveCount(1)
    })
  })

  test('DCK-8: Together draws one card per distinct card and Separate draws every copy @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await openPreconInEditor(page, user('dck8'))
      const copies = page.locator(`${PILES} .arena-stack-card${BOLT}`)
      await expect(copies).toHaveCount(4, { timeout: 8000 })

      await page.locator('.deck-editor-toolbar [data-control="copies"] [data-value="together"]').click()
      await expect(copies).toHaveCount(1)
      await expect(frontBolt(page).locator('.arena-stack-qty')).toHaveText('×4')

      await page.locator('.deck-editor-toolbar [data-control="copies"] [data-value="separate"]').click()
      await expect(copies).toHaveCount(4)
    })
  })

  test('DCK-9: a click selects a card and the panel minus button removes one copy @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await openPreconInEditor(page, user('dck9'))
      const bolt = frontBolt(page)
      await expect(bolt.locator('.arena-stack-qty')).toHaveText('×4', { timeout: 8000 })

      await bolt.click({ position: { x: 20, y: 8 } })
      await expect(bolt).toHaveClass(/is-selected/)
      await expect(page.locator('.card-focus-panel .card-focus-name')).toHaveText(/Lightning Bolt|Relámpago/)

      await page.locator('.card-focus-dec').click()
      await expect(bolt.locator('.arena-stack-qty')).toHaveText('×3')
    })
  })

  test('DCK-9: Shift+click moves one copy from the piles to the sideboard band @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await openPreconInEditor(page, user('dck9s'))
      const bolt = frontBolt(page)
      await expect(bolt.locator('.arena-stack-qty')).toHaveText('×4', { timeout: 8000 })

      await bolt.click({ position: { x: 20, y: 8 }, modifiers: ['Shift'] })
      await expect(bolt.locator('.arena-stack-qty')).toHaveText('×3')
      await expect(page.locator(`${BAND} ${BOLT}`).first()).toBeVisible()
      await expect(page.locator('.deck-editor-side-count')).toHaveText(/^1(\/\d+)?$/)
    })
  })

  test('DCK-12: the drawer toggle hides the catalogue and the piles take its width @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await openPreconInEditor(page, user('dck12'))
      const toggle = page.locator('.deck-editor-drawer-toggle')
      await expect(page.locator('.builder-left')).toBeVisible()
      const open = await page.locator(PILES).boundingBox()

      await toggle.click()
      await expect(page.locator('.builder-left')).toHaveCount(0)
      await expect(toggle).toHaveAttribute('aria-pressed', 'false')
      expect((await page.locator(PILES).boundingBox())?.width ?? 0).toBeGreaterThan(open?.width ?? 0)

      await toggle.click()
      await expect(page.locator('.builder-left')).toBeVisible()
    })
  })

  test('DCK-13: the sideboard band shows its count and folds to its header @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await openPreconInEditor(page, user('dck13'))
      const bolt = frontBolt(page)
      await expect(bolt.locator('.arena-stack-qty')).toHaveText('×4', { timeout: 8000 })
      await bolt.click({ position: { x: 20, y: 8 }, modifiers: ['Shift'] })
      await expect(page.locator('.deck-editor-side-count')).toHaveText(/^1(\/\d+)?$/)

      const fold = page.locator('.deck-editor-side-head button')
      await expect(fold).toHaveAttribute('aria-expanded', 'true')
      await fold.click()
      await expect(page.locator(`${BAND}.is-folded`)).toBeVisible()
      await expect(page.locator('.deck-editor-side-body')).toHaveCount(0)
      await expect(fold).toHaveAttribute('aria-expanded', 'false')

      await fold.click()
      await expect(page.locator('.deck-editor-side-body')).toBeVisible()
    })
  })
})
