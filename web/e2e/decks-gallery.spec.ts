import { test, expect } from './fixtures'
import { blockLocalizedEnrich } from './support/fake-mode'
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
      const username = `deck_${String(Date.now()).slice(-9)}`
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
      await expect(page.locator('.deck-sideboard-section .deck-category-count')).toHaveText('2')
      const sideStrip = page.locator('.deck-sideboard-section .arena-card-strip').first()
      // dispatchEvent y no click() geométrico: tras el swap la lista re-renderiza
      // y con 4 workers el clic por coordenadas perdía el hover (element not
      // stable / no visible) — flake visto 2026-09-18. El hover + visible sigue
      // verificando que el reveal por hover funciona.
      const sideSwap = sideStrip.locator('.strip-btn.swap')
      await sideStrip.hover()
      await expect(sideSwap).toBeVisible()
      await sideSwap.dispatchEvent('click')
      await expect(page.locator('.deck-sideboard-section .deck-category-count')).toHaveText('1')
      await expect(page.locator('.deck-sideboard-section .strip-name', { hasText: /Red Elemental Blast|Ráfaga elemental roja/ })).toBeVisible()
      const mainRebStrip = page.locator('.deck-category-section:not(.deck-sideboard-section) .arena-card-strip', { hasText: /Red Elemental Blast|Ráfaga elemental roja/ }).first()
      const mainSwap = mainRebStrip.locator('.strip-btn.swap')
      await mainRebStrip.hover()
      await expect(mainSwap).toBeVisible()
      await mainSwap.dispatchEvent('click')
      await expect(page.locator('.deck-sideboard-section .deck-category-count')).toHaveText('2')

      // Drag & drop: move one Mountain main → sideboard and back via HTML5 DnD
      const dt = await page.evaluateHandle(() => new DataTransfer())
      const mainMountain = page.locator('.deck-category-section:not(.deck-sideboard-section) .arena-card-strip', { hasText: /Mountain|Montaña/ }).first()
      const sideSection = page.locator('.deck-sideboard-section')
      await mainMountain.dispatchEvent('dragstart', { dataTransfer: dt })
      await sideSection.dispatchEvent('dragover', { dataTransfer: dt })
      await sideSection.dispatchEvent('drop', { dataTransfer: dt })
      await expect(page.locator('.deck-sideboard-section .deck-category-count')).toHaveText('3')
      await expect(page.locator('.deck-sideboard-section .strip-name', { hasText: /Mountain|Montaña/ })).toBeVisible()
      const sideMountain = page.locator('.deck-sideboard-section .arena-card-strip', { hasText: /Mountain|Montaña/ })
      const firstMainSection = page.locator('.deck-category-section:not(.deck-sideboard-section)').first()
      await sideMountain.dispatchEvent('dragstart', { dataTransfer: dt })
      await firstMainSection.dispatchEvent('dragover', { dataTransfer: dt })
      await firstMainSection.dispatchEvent('drop', { dataTransfer: dt })
      await expect(page.locator('.deck-sideboard-section .deck-category-count')).toHaveText('2')

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
  test('precon: Editar clona el mazo y abre el builder (regresión "Cargando...") @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await page.goto(`/?proxyPort=${proxyPort()}`)
      await dismissSetupWizard(page)
      await page.getByPlaceholder(/Usuario|Username/i).fill(`precon_${String(Date.now()).slice(-7)}`)
      await page.getByPlaceholder(/Contraseña|Password/i).fill('pass')
      await page.getByRole('button', { name: /Conectar/i }).click()
      await expect(page.getByRole('button', { name: /Mesas/ })).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: /Mis Mazos|Mazos/i }).click()
      await expect(page.locator('.decks-gallery')).toBeVisible({ timeout: 8000 })

      // Un precon solo existe en memoria: Editar debe clonarlo en storage y abrir
      // el builder; si no, DeckBuilder no encuentra el id y queda en "Cargando...".
      await page.locator('.deck-box', { hasText: /Precon/ }).first().click()
      await page.getByRole('button', { name: /Editar|Edit/i }).click()
      await expect(page.locator('.deck-builder-body')).toBeVisible({ timeout: 8000 })
      await expect(page.locator('.builder-done')).toBeVisible()
      await expect(page.locator('.deck-builder.loading')).toHaveCount(0)
      await expect(page.locator('.arena-deck-list-container .arena-card-strip').first()).toBeVisible({ timeout: 8000 })
    })
  })

  test('commander: designación explícita con la corona, sin caer a la primera carta @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await page.goto(`/?proxyPort=${proxyPort()}`)
      await dismissSetupWizard(page)
      await page.getByPlaceholder(/Usuario|Username/i).fill(`cmd_${String(Date.now()).slice(-10)}`)
      await page.getByPlaceholder(/Contraseña|Password/i).fill('pass')
      await page.getByRole('button', { name: /Conectar/i }).click()
      await expect(page.getByRole('button', { name: /Mesas/ })).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: /Mis Mazos|Mazos/i }).click()
      await page.locator('.deck-box-create').click()
      await expect(page.locator('.deck-builder-body')).toBeVisible({ timeout: 8000 })

      // Formato Commander sin comandante: slot vacío, no la primera carta
      await page.locator('.arena-deck-header select').selectOption('Commander')
      await expect(page.getByText(/Designa una carta legendaria como comandante/)).toBeVisible()

      // Importar un mazo con una carta en main: NO debe aparecer como comandante
      await page.getByRole('button', { name: /Importar Mazo/i }).click()
      await page.locator('.deck-import-textarea').fill("1 [2XM:190] Atraxa, Praetors' Voice\n1 [C16:264] Sol Ring")
      await page.locator('.import-submit-btn').click()
      const atraxa = page.locator('.deck-category-section:not(.deck-sideboard-section) .arena-card-strip', { hasText: /Atraxa/ }).first()
      await expect(atraxa).toBeVisible({ timeout: 3000 })
      await expect(page.getByText(/Designa una carta legendaria como comandante/)).toBeVisible()

      // La corona designa/quita el comandante explícito. Las acciones solo se
      // montan con :hover y la meta puede recategorizar la carta (detach), así
      // que reintentamos hover+click hasta que el botón esté visible.
      await expect(async () => {
        await atraxa.hover()
        await atraxa.locator('.strip-btn.crown').click({ timeout: 2000 })
      }).toPass({ timeout: 15000 })
      const commanderSection = page.locator('.deck-category-section', { hasText: /^Comandante/ }).first()
      await expect(commanderSection.locator('.arena-card-strip', { hasText: /Atraxa/ })).toBeVisible()
      await expect(page.locator('.deck-category-section:not(.deck-sideboard-section) .arena-card-strip', { hasText: /Atraxa/ })).toHaveCount(1)
      await expect(async () => {
        await commanderSection.locator('.arena-card-strip', { hasText: /Atraxa/ }).hover()
        await commanderSection.locator('.strip-btn.crown').click({ timeout: 2000 })
      }).toPass({ timeout: 15000 })
      await expect(page.getByText(/Designa una carta legendaria como comandante/)).toBeVisible()

      // Drag&drop sobre el slot de comandante: designa la carta (antes el drop
      // burbujeaba al contenedor y la añadía/duplicaba en el mazo general).
      const mainAtraxa = page.locator('.deck-category-section:not(.deck-sideboard-section):not(.deck-commander-section) .arena-card-strip', { hasText: /Atraxa/ }).first()
      await expect(mainAtraxa).toBeVisible()
      const cmdDt = await page.evaluateHandle(() => new DataTransfer())
      const commanderSlot = page.locator('.deck-commander-section')
      await mainAtraxa.dispatchEvent('dragstart', { dataTransfer: cmdDt })
      await commanderSlot.dispatchEvent('dragover', { dataTransfer: cmdDt })
      await expect(commanderSlot).toHaveClass(/is-commander-drag-over/)
      await commanderSlot.dispatchEvent('drop', { dataTransfer: cmdDt })
      await expect(commanderSlot.locator('.arena-card-strip', { hasText: /Atraxa/ })).toBeVisible()
      await expect(page.locator('.deck-category-section:not(.deck-sideboard-section):not(.deck-commander-section) .arena-card-strip', { hasText: /Atraxa/ })).toHaveCount(0)
      await expect(page.getByText(/Designa una carta legendaria como comandante/)).toHaveCount(0)
    })
  })

  test('commander: pareja Partner ocupa las dos plazas sin duplicar en el mazo @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      const scryfall = (name: string, typeLine: string, colors: string[]) => ({
        name,
        type_line: typeLine,
        colors,
        keywords: ['Partner'],
        oracle_text: 'Partner (You can have two commanders if both have partner.)',
        mana_cost: '{1}{W}{R}',
        cmc: 3,
        image_uris: { normal: 'https://img.test/card.jpg', art_crop: 'https://img.test/card.jpg' },
      })
      await page.route('**/api.scryfall.com/cards/pc2/1**', (route) =>
        route.fulfill({ json: scryfall('Sidar Kondo of Jamuraa', 'Legendary Creature — Human', ['W']) }),
      )
      await page.route('**/api.scryfall.com/cards/c16/56**', (route) =>
        route.fulfill({ json: scryfall('Tana, the Bloodsower', 'Legendary Creature — Elf', ['R', 'G']) }),
      )

      await page.goto(`/?proxyPort=${proxyPort()}`)
      await dismissSetupWizard(page)
      await page.getByPlaceholder(/Usuario|Username/i).fill(`cmd2_${String(Date.now()).slice(-9)}`)
      await page.getByPlaceholder(/Contraseña|Password/i).fill('pass')
      await page.getByRole('button', { name: /Conectar/i }).click()
      await expect(page.getByRole('button', { name: /Mesas/ })).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: /Mis Mazos|Mazos/i }).click()
      await page.locator('.deck-box-create').click()
      await expect(page.locator('.deck-builder-body')).toBeVisible({ timeout: 8000 })
      await page.locator('.arena-deck-header select').selectOption('Commander')

      await page.getByRole('button', { name: /Importar Mazo/i }).click()
      await page.locator('.deck-import-textarea').fill("1 [PC2:1] Sidar Kondo of Jamuraa\n1 [C16:56] Tana, the Bloodsower\n20 [M10:234] Mountain")
      await page.locator('.import-submit-btn').click()

      const mainTana = page.locator('.deck-category-section:not(.deck-sideboard-section):not(.deck-commander-section) .arena-card-strip', { hasText: /Tana/ }).first()
      await expect(mainTana).toBeVisible({ timeout: 5000 })
      const dt = await page.evaluateHandle(() => new DataTransfer())
      const slot = page.locator('.deck-commander-section')
      await mainTana.dispatchEvent('dragstart', { dataTransfer: dt })
      await slot.dispatchEvent('dragover', { dataTransfer: dt })
      await slot.dispatchEvent('drop', { dataTransfer: dt })

      // La pareja legal (ambos Partner) ocupa las dos plazas; el drop no añade
      // ni duplica la carta en el mazo general.
      await expect(slot.locator('.arena-card-strip', { hasText: /Tana/ })).toBeVisible()
      await expect(slot.locator('.arena-card-strip', { hasText: /Sidar/ })).toBeVisible()
      await expect(slot.locator('.arena-card-strip')).toHaveCount(2)
      await expect(page.locator('.arena-card-strip', { hasText: /Tana/ })).toHaveCount(1)
      await expect(page.locator('.arena-card-strip', { hasText: /Sidar/ })).toHaveCount(1)

      // Quitar el primer comandante asciende al segundo (no se pierde la pareja)
      await expect(async () => {
        await slot.locator('.arena-card-strip', { hasText: /Tana/ }).hover()
        await slot.locator('.arena-card-strip', { hasText: /Tana/ }).locator('.strip-btn.crown').click({ timeout: 2000 })
      }).toPass({ timeout: 15000 })
      await expect(slot.locator('.arena-card-strip')).toHaveCount(1)
      await expect(slot.locator('.arena-card-strip', { hasText: /Sidar/ })).toBeVisible()
    })
  })

  test('import .dck text creates deck in gallery @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await page.goto(`/?proxyPort=${proxyPort()}`)
      await dismissSetupWizard(page)
      const username = `deck2_${String(Date.now()).slice(-8)}`
      await page.getByPlaceholder(/Usuario|Username/i).fill(username)
      await page.getByPlaceholder(/Contraseña|Password/i).fill('pass')
      await page.getByRole('button', { name: /Conectar/i }).click()
      await expect(page.getByRole('button', { name: /Mesas/ })).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: /Mis Mazos|Mazos/i }).click()
      await expect(page.locator('.decks-gallery')).toBeVisible({ timeout: 8000 })
      await page.locator('.decks-import-cta').click()
      await expect(page.locator('.deck-import-modal')).toBeVisible()
      await page.locator('.import-name-input').fill('Mi Test DCK')
      await page.locator('.deck-import-textarea').fill('NAME:Mi Test DCK\n4 [M10:146] Lightning Bolt\n20 [LEA:292] Mountain\nSB: 2 [4ED:218] Red Elemental Blast')
      await page.locator('.import-submit-btn').click()
      await expect(page.getByText('Mi Test DCK')).toBeVisible({ timeout: 5000 })
      await expect(page.getByText('43/75').first().or(page.getByText(/1\/75/))).toBeVisible({ timeout: 3000 })
    })
  })

  test('explores online & meta decks catalog in Deck Browser @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await page.goto(`/?proxyPort=${proxyPort()}`)
      await dismissSetupWizard(page)
      const username = `deck3_${String(Date.now()).slice(-8)}`
      await page.getByPlaceholder(/Usuario|Username/i).fill(username)
      await page.getByPlaceholder(/Contraseña|Password/i).fill('pass')
      await page.getByRole('button', { name: /Conectar/i }).click()
      await expect(page.getByRole('button', { name: /Mesas/ })).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: /Mis Mazos|Mazos/i }).click()
      await expect(page.locator('.decks-gallery')).toBeVisible({ timeout: 8000 })

      // Switch to Deck Browser tab
      await page.getByRole('tab', { name: /Meta & Decks Populares/i }).click()
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

      // Import por URL: entrada unificada del header (el sub-tab del browser
      // se retiró con ImportDeckDialog)
      await page.locator('.decks-import-cta').click()
      await expect(page.locator('.deck-import-modal')).toBeVisible()
      await page.locator('.deck-import-textarea').fill('https://moxfield.com/decks/abc123')
      await expect(page.locator('.import-badge.success')).toBeVisible()
    })
  })

  test('U6: sort control, card-size slider, .cod import and .dek export @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await blockLocalizedEnrich(page)
      await page.goto(`/?proxyPort=${proxyPort()}`)
      await dismissSetupWizard(page)
      const username = `deck_u6_${String(Date.now()).slice(-6)}`
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
      await expect(page.getByRole('button', { name: /Export(ar)? \.DEK/i })).toBeVisible()
    })
  })

  test('U7: commander/maybeboard sections, draft log and paste button @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await blockLocalizedEnrich(page)
      await page.goto(`/?proxyPort=${proxyPort()}`)
      await dismissSetupWizard(page)
      const username = `deck_u7_${String(Date.now()).slice(-6)}`
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
      const username = `deck_rsp_${String(Date.now()).slice(-5)}`
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

