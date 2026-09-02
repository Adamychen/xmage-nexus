import { test, expect } from './fixtures'
import { withFakeServer } from './support/fake-backend'
import { getFakePort } from './support/fake-port'
import { FAKE_MODE, BACKEND_PORT } from './dual'
import { decksGalleryScenario } from '../fixtures/scenarios/decksGallery'
import { startGame } from './support/start-game'
import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'

test.describe('Decks Gallery', () => {
  test('renders Arena-like gallery with box art and can open builder @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await page.goto(`/?proxyPort=${FAKE_MODE ? getFakePort() : BACKEND_PORT}`)
      const username = `deck_${Date.now()}`
      await page.getByPlaceholder(/Usuario|Username/i).fill(username)
      await page.getByPlaceholder(/Contraseña|Password/i).fill('pass')
      await page.getByRole('button', { name: /Conectar/i }).click()
      await expect(page.getByRole('button', { name: /Mesas/ })).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: /Mis Mazos|Mazos/i }).click()
      await expect(page.locator('.decks-gallery')).toBeVisible({ timeout: 8000 })
      await expect(page.locator('.decks-title', { hasText: /DECKS|Mazos/i })).toBeVisible()
      await expect(page.locator('.deck-box-create')).toBeVisible()
      await expect(page.locator('.deck-box').first()).toBeVisible()
      await expect(page.getByRole('button', { name: /Editar|Edit/i })).toBeVisible()
      // create new deck navigates to builder
      await page.locator('.deck-box-create').click()
      await expect(page.locator('.deck-builder')).toBeVisible({ timeout: 8000 })
      await expect(page.locator('.deck-header-name-input')).toBeVisible({ timeout: 8000 })
      await expect(page.locator('.arena-search-panel')).toBeVisible({ timeout: 5000 })
      // deck list may need a tick for meta load
      await page.waitForTimeout(800)
      await expect(page.locator('.deck-builder-body')).toBeVisible()
      await expect(page.locator('.builder-done')).toBeVisible()
      // sideboard section always visible, with drop hint when empty
      await expect(page.locator('.deck-sideboard-section')).toBeVisible()
      await expect(page.locator('.deck-sideboard-empty')).toBeVisible()
      // import modal adds a card without Scryfall
      await page.getByRole('button', { name: /Importar Mazo/i }).click()
      await page.locator('.deck-import-textarea').fill('4 [LEA:292] Mountain\nSB: 2 [4ED:218] Red Elemental Blast')
      await page.locator('.import-submit-btn').click()
      await expect(page.getByText('Mountain')).toBeVisible({ timeout: 3000 })
      await expect(page.locator('.arena-card-strip').first()).toBeVisible({ timeout: 3000 })
      await expect(page.locator('.strip-name', { hasText: 'Mountain' })).toBeVisible()

      // Sideboard section: imported SB cards land there with count and swap moves one copy to main
      await expect(page.locator('.deck-sideboard-section')).toBeVisible({ timeout: 3000 })
      await expect(page.locator('.deck-sideboard-section .strip-name', { hasText: 'Red Elemental Blast' })).toBeVisible()
      await expect(page.locator('.deck-sideboard-section .deck-category-count')).toHaveText('2/15')
      const sideStrip = page.locator('.deck-sideboard-section .arena-card-strip').first()
      await sideStrip.hover()
      await sideStrip.locator('.strip-btn.swap').click()
      await expect(page.locator('.deck-sideboard-section .deck-category-count')).toHaveText('1/15')
      await expect(page.locator('.deck-sideboard-section .strip-name', { hasText: 'Red Elemental Blast' })).toBeVisible()
      const mainRebStrip = page.locator('.deck-category-section:not(.deck-sideboard-section) .arena-card-strip', { hasText: 'Red Elemental Blast' }).first()
      await mainRebStrip.hover()
      await mainRebStrip.locator('.strip-btn.swap').click()
      await expect(page.locator('.deck-sideboard-section .deck-category-count')).toHaveText('2/15')

      // Drag & drop: move one Mountain main → sideboard and back via HTML5 DnD
      const dt = await page.evaluateHandle(() => new DataTransfer())
      const mainMountain = page.locator('.deck-category-section:not(.deck-sideboard-section) .arena-card-strip', { hasText: 'Mountain' }).first()
      const sideSection = page.locator('.deck-sideboard-section')
      await mainMountain.dispatchEvent('dragstart', { dataTransfer: dt })
      await sideSection.dispatchEvent('dragover', { dataTransfer: dt })
      await sideSection.dispatchEvent('drop', { dataTransfer: dt })
      await expect(page.locator('.deck-sideboard-section .deck-category-count')).toHaveText('3/15')
      await expect(page.locator('.deck-sideboard-section .strip-name', { hasText: 'Mountain' })).toBeVisible()
      const sideMountain = page.locator('.deck-sideboard-section .arena-card-strip', { hasText: 'Mountain' })
      const firstMainSection = page.locator('.deck-category-section:not(.deck-sideboard-section)').first()
      await sideMountain.dispatchEvent('dragstart', { dataTransfer: dt })
      await firstMainSection.dispatchEvent('dragover', { dataTransfer: dt })
      await firstMainSection.dispatchEvent('drop', { dataTransfer: dt })
      await expect(page.locator('.deck-sideboard-section .deck-category-count')).toHaveText('2/15')

      // Layout toggle between vertical and horizontal (sideboard visible in both)
      await page.locator('.deck-header-layout-btn').click()
      await expect(page.locator('.arena-deck-cols-layout')).toBeVisible({ timeout: 2000 })
      await expect(page.locator('.deck-sideboard-section')).toBeVisible()
      await page.locator('.deck-header-layout-btn').click()
      await expect(page.locator('.arena-deck-list-scroll')).toBeVisible({ timeout: 2000 })

      // Mana filter orbs in search bar
      await expect(page.locator('.mana-orb-btn')).toHaveCount(6)
      await page.locator('.mana-orb-btn.orb-r').click()
      await expect(page.locator('.mana-orb-btn.orb-r')).toHaveClass(/active/)
      
      // Done button saves and returns to gallery
      await page.locator('.builder-done').click()
      await expect(page.locator('.decks-gallery')).toBeVisible({ timeout: 8000 })
    })
  })
  test('import .dck text creates deck in gallery @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await page.goto(`/?proxyPort=${FAKE_MODE ? getFakePort() : BACKEND_PORT}`)
      const username = `deck2_${Date.now()}`
      await page.getByPlaceholder(/Usuario|Username/i).fill(username)
      await page.getByPlaceholder(/Contraseña|Password/i).fill('pass')
      await page.getByRole('button', { name: /Conectar/i }).click()
      await expect(page.getByRole('button', { name: /Mesas/ })).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: /Mis Mazos|Mazos/i }).click()
      await expect(page.locator('.decks-gallery')).toBeVisible({ timeout: 8000 })
      await page.getByRole('button', { name: /Importar mazo desde texto/i }).click()
      await expect(page.locator('.decks-import-dialog')).toBeVisible()
      await page.locator('.decks-import-dialog input').first().fill('Mi Test DCK')
      await page.locator('.decks-import-dialog textarea').fill('NAME:Mi Test DCK\n4 [M10:146] Lightning Bolt\n20 [LEA:292] Mountain\nSB: 2 [4ED:218] Red Elemental Blast')
      await page.locator('.decks-import-dialog').getByRole('button', { name: /Importar Mazo/i }).click()
      await expect(page.getByText('Mi Test DCK')).toBeVisible({ timeout: 5000 })
      await expect(page.getByText('43/75').first().or(page.getByText(/1\/75/))).toBeVisible({ timeout: 3000 })
    })
  })

  test('explores online & meta decks catalog in Deck Browser @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await page.goto(`/?proxyPort=${FAKE_MODE ? getFakePort() : BACKEND_PORT}`)
      const username = `deck3_${Date.now()}`
      await page.getByPlaceholder(/Usuario|Username/i).fill(username)
      await page.getByPlaceholder(/Contraseña|Password/i).fill('pass')
      await page.getByRole('button', { name: /Conectar/i }).click()
      await expect(page.getByRole('button', { name: /Mesas/ })).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: /Mis Mazos|Mazos/i }).click()
      await expect(page.locator('.decks-gallery')).toBeVisible({ timeout: 8000 })

      // Switch to Deck Browser tab
      await page.getByRole('button', { name: /Meta & Decks Populares/i }).click()
      await expect(page.locator('.deck-browser-container')).toBeVisible({ timeout: 5000 })
      await expect(page.locator('.browser-deck-card').first()).toBeVisible({ timeout: 5000 })
      await expect(page.getByText('Izzet Murktide')).toBeVisible()

      // Inspect a deck modal
      await page.locator('.browser-deck-card', { hasText: 'Izzet Murktide' }).click()
      await expect(page.locator('.deck-inspector-modal')).toBeVisible({ timeout: 3000 })
      await expect(page.locator('.inspector-format-badge', { hasText: 'Modern' })).toBeVisible()
      await expect(page.locator('.inspector-copy-btn')).toBeVisible()

      // Close modal
      await page.locator('.inspector-close-btn').click()
      await expect(page.locator('.deck-inspector-modal')).not.toBeVisible()

      // Switch to URL import sub-tab
      await page.getByRole('button', { name: /Importar Mazo/i }).click()
      await expect(page.locator('.browser-url-import-view')).toBeVisible()
    })
  })
})
