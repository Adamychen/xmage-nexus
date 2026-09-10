import { test, expect } from './fixtures'
import { withFakeServer } from './support/fake-backend'
import { proxyPort } from './dual'
import { decksGalleryScenario } from '../fixtures/scenarios/decksGallery'
import { dismissSetupWizard, startGame } from './support/start-game'
import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'

test.describe('Decks Gallery', () => {
  test('renders Arena-like gallery with box art and can open builder @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await page.goto(`/?proxyPort=${proxyPort()}`)
      await dismissSetupWizard(page)
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
      await expect(page.locator('.strip-name', { hasText: /Mountain|Montaña/ })).toBeVisible({ timeout: 3000 })
      await expect(page.locator('.arena-card-strip').first()).toBeVisible({ timeout: 3000 })

      // Sideboard section: imported SB cards land there with count and swap moves one copy to main
      await expect(page.locator('.deck-sideboard-section')).toBeVisible({ timeout: 3000 })
      await expect(page.locator('.deck-sideboard-section .strip-name', { hasText: /Red Elemental Blast|Ráfaga elemental roja/ })).toBeVisible()
      await expect(page.locator('.deck-sideboard-section .deck-category-count')).toHaveText('2/15')
      const sideStrip = page.locator('.deck-sideboard-section .arena-card-strip').first()
      await sideStrip.hover()
      await sideStrip.locator('.strip-btn.swap').click()
      await expect(page.locator('.deck-sideboard-section .deck-category-count')).toHaveText('1/15')
      await expect(page.locator('.deck-sideboard-section .strip-name', { hasText: /Red Elemental Blast|Ráfaga elemental roja/ })).toBeVisible()
      const mainRebStrip = page.locator('.deck-category-section:not(.deck-sideboard-section) .arena-card-strip', { hasText: /Red Elemental Blast|Ráfaga elemental roja/ }).first()
      await mainRebStrip.hover()
      await mainRebStrip.locator('.strip-btn.swap').click()
      await expect(page.locator('.deck-sideboard-section .deck-category-count')).toHaveText('2/15')

      // Drag & drop: move one Mountain main → sideboard and back via HTML5 DnD
      const dt = await page.evaluateHandle(() => new DataTransfer())
      const mainMountain = page.locator('.deck-category-section:not(.deck-sideboard-section) .arena-card-strip', { hasText: /Mountain|Montaña/ }).first()
      const sideSection = page.locator('.deck-sideboard-section')
      await mainMountain.dispatchEvent('dragstart', { dataTransfer: dt })
      await sideSection.dispatchEvent('dragover', { dataTransfer: dt })
      await sideSection.dispatchEvent('drop', { dataTransfer: dt })
      await expect(page.locator('.deck-sideboard-section .deck-category-count')).toHaveText('3/15')
      await expect(page.locator('.deck-sideboard-section .strip-name', { hasText: /Mountain|Montaña/ })).toBeVisible()
      const sideMountain = page.locator('.deck-sideboard-section .arena-card-strip', { hasText: /Mountain|Montaña/ })
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
      await page.goto(`/?proxyPort=${proxyPort()}`)
      await dismissSetupWizard(page)
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
      await page.goto(`/?proxyPort=${proxyPort()}`)
      await dismissSetupWizard(page)
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

  test('U6: sort control, card-size slider, .cod import and .dek export @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await page.goto(`/?proxyPort=${proxyPort()}`)
      await dismissSetupWizard(page)
      const username = `deck_u6_${Date.now()}`
      await page.getByPlaceholder(/Usuario|Username/i).fill(username)
      await page.getByPlaceholder(/Contraseña|Password/i).fill('pass')
      await page.getByRole('button', { name: /Conectar/i }).click()
      await expect(page.getByRole('button', { name: /Mesas/ })).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: /Mis Mazos|Mazos/i }).click()
      await expect(page.locator('.decks-gallery')).toBeVisible({ timeout: 8000 })
      await page.locator('.deck-box-create').click()
      await expect(page.locator('.deck-builder')).toBeVisible({ timeout: 8000 })
      await expect(page.locator('.arena-search-panel')).toBeVisible({ timeout: 5000 })

      // U6-1: sort select with 6 orders + direction toggle
      const sortSelect = page.locator('.arena-sort-select')
      await expect(sortSelect).toBeVisible()
      await expect(sortSelect.locator('option')).toHaveCount(6)
      await sortSelect.selectOption('name')
      await expect(page.locator('.arena-sort-dir-btn')).toBeVisible()
      await page.locator('.arena-sort-dir-btn').click()
      await expect(page.locator('.arena-sort-dir-btn')).toHaveText('↓')

      // U6 minor: card-size slider changes the grid min column width
      const slider = page.locator('.arena-grid-size-slider')
      await expect(slider).toBeVisible()
      await slider.fill('100')
      await expect(page.locator('.arena-card-grid-scroll')).toHaveAttribute('style', /minmax\(190px/)

      // U6-4: paste .cod XML into the import modal (local parse, no Scryfall needed)
      await page.getByRole('button', { name: /Importar Mazo/i }).click()
      await page.locator('.deck-import-textarea').fill(
        '<?xml version="1.0"?>\n<cockatrice_deck version="1">\n<deckname>Burn</deckname>\n<zone name="main">\n<card number="4" name="Lightning Bolt"/>\n</zone>\n<zone name="side">\n<card number="2" name="Pyroblast"/>\n</zone>\n</cockatrice_deck>',
      )
      await page.locator('.import-submit-btn').click()
      await expect(page.locator('.strip-name', { hasText: /Lightning Bolt/ })).toBeVisible({ timeout: 3000 })
      await expect(page.locator('.deck-sideboard-section .strip-name', { hasText: /Pyroblast/ })).toBeVisible({ timeout: 3000 })

      // U6-5: .dek export button present in the footer
      await expect(page.getByRole('button', { name: /Export \.DEK/i })).toBeVisible()
    })
  })

  test('U7: commander/maybeboard sections, draft log and paste button @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await page.goto(`/?proxyPort=${proxyPort()}`)
      await dismissSetupWizard(page)
      const username = `deck_u7_${Date.now()}`
      await page.getByPlaceholder(/Usuario|Username/i).fill(username)
      await page.getByPlaceholder(/Contraseña|Password/i).fill('pass')
      await page.getByRole('button', { name: /Conectar/i }).click()
      await expect(page.getByRole('button', { name: /Mesas/ })).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: /Mis Mazos|Mazos/i }).click()
      await expect(page.locator('.decks-gallery')).toBeVisible({ timeout: 8000 })
      await page.locator('.deck-box-create').click()
      await expect(page.locator('.deck-builder')).toBeVisible({ timeout: 8000 })

      // U7-5: paste button present in the import modal
      await page.getByRole('button', { name: /Importar Mazo/i }).click()
      await expect(page.locator('.import-paste-btn')).toBeVisible()

      // U7-6: Commander first in main, Maybeboard to sideboard
      await page.locator('.deck-import-textarea').fill(
        'Commander\n1 Atraxa, Praetors\' Voice\nDeck\n1 Sol Ring\nMaybeboard\n1 Doubling Season\n',
      )
      await expect(page.locator('.import-badge.success')).toBeVisible()
      await page.locator('.import-submit-btn').click()
      await expect(page.locator('.deck-category-section:not(.deck-sideboard-section) .strip-name').first()).toHaveText(/Atraxa/)
      await expect(page.locator('.deck-sideboard-section .strip-name', { hasText: /Doubling Season/ })).toBeVisible({ timeout: 3000 })

      // U7-1: draft log recognized by the modal badge
      await page.getByRole('button', { name: /Importar Mazo/i }).click()
      await page.locator('.deck-import-textarea').fill(
        '------ NEO ------\n--> Light-Paws, Emperor\'s Voice\n--> Mountain\n',
      )
      await expect(page.locator('.import-badge.success')).toContainText('2')
    })
  })

  test('responsive layout on laptop viewports prevents deck box overlap @decks', async ({ page }) => {    await page.setViewportSize({ width: 1366, height: 768 })
    await withFakeServer(decksGalleryScenario, async () => {
      await page.goto(`/?proxyPort=${proxyPort()}`)
      await dismissSetupWizard(page)
      const username = `deck_resp_${Date.now()}`
      await page.getByPlaceholder(/Usuario|Username/i).fill(username)
      await page.getByPlaceholder(/Contraseña|Password/i).fill('pass')
      await page.getByRole('button', { name: /Conectar/i }).click()
      await expect(page.getByRole('button', { name: /Mesas/ })).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: /Mis Mazos|Mazos/i }).click()
      await expect(page.locator('.decks-gallery')).toBeVisible({ timeout: 8000 })

      // Wait for deck boxes to be laid out
      await expect(page.locator('.deck-box').first()).toBeVisible({ timeout: 5000 })

      // Verify that no deck boxes overlap each other vertically or horizontally
      const overlapFound = await page.evaluate(() => {
        const boxes = Array.from(document.querySelectorAll('.deck-box'))
        const rects = boxes.map((b) => b.getBoundingClientRect())
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            const a = rects[i]
            const b = rects[j]
            // Two rectangles overlap if they intersect in both X and Y dimensions (excluding exact borders)
            const overlapX = a.left < b.right - 2 && a.right > b.left + 2
            const overlapY = a.top < b.bottom - 2 && a.bottom > b.top + 2
            if (overlapX && overlapY) {
              return { i, j, a: { top: a.top, bottom: a.bottom }, b: { top: b.top, bottom: b.bottom } }
            }
          }
        }
        return null
      })
      expect(overlapFound).toBeNull()

      // Open DeckBuilder and verify the floating chat panel can stay visible
      // alongside it (content reserves its space, buttons stay clickable)
      await page.locator('.deck-box-create').click()
      await expect(page.locator('.deck-builder')).toBeVisible({ timeout: 8000 })
      await page.locator('.floating-chat-fab').click()
      await expect(page.locator('.lobby-aside')).toBeVisible()

      // Verify done button works cleanly
      await page.locator('.builder-done').click()
      await expect(page.locator('.decks-gallery')).toBeVisible({ timeout: 8000 })
    })
  })
})

