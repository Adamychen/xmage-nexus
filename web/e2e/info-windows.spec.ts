import { fakeOnly } from './support/fake-mode'
/**
 * Visores looked-at / companion (G12-2, U12): el GAME_INIT estático los trae
 * y las ventanas se abren solas con sus cartas.
 */

import { test, expect } from './fixtures'
fakeOnly()
import { infoWindowsScenario } from '../fixtures/scenarios/infoWindows'
import { withFakeServer } from './support/fake-backend'
import { quickStartGame } from './support/start-game'
import { parseSent, sentOf } from './support/frames'
import { dismissInfoWindows } from './support/info-windows'

test('BRD-66: info windows: the look is a corner notice and the companion opens its viewer', { tag: '@game' }, async ({ page }) => {
  await withFakeServer(() => infoWindowsScenario(), async () => {
    const { pageErrors } = await quickStartGame(page, {
      prefix: 'infow',
    })

    const overlays = page.locator('.pile-overlay')
    await expect(overlays.first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.pile-overlay', { hasText: 'Lurrus of the Dream-Den' })).toBeVisible()

    // BRD-66: the look asks nothing of the player, so it is a corner notice, not a viewer.
    const notice = page.getByTestId('reveal-toast')
    await expect(notice).toBeVisible()
    await expect(notice.getByRole('button', { name: 'Scry Card' })).toBeVisible()
    await expect(page.locator('.pile-overlay', { hasText: 'Scry Card' })).toHaveCount(0)
    const box = await notice.boundingBox()
    const viewport = page.viewportSize()!
    expect(box!.x + box!.width, 'the notice sits in the left part of the table').toBeLessThan(viewport.width / 2)
    expect(box!.y, 'the notice sits in the top part of the table').toBeLessThan(viewport.height / 2)

    // G12-4: el permanente faseado no se pinta; el resto sí.
    const myZone = page.locator('.board-zone.player-zone')
    await expect(myZone).toContainText('Steady Guy')
    await expect(myZone).not.toContainText('Phased Out Guy')

    // Issue #3: el compañero anunciado en canPlayObjects es clicable desde su
    // visor (paridad con el CardInfoWindowDialog del desktop) y envía su UUID.
    const companionCard = page.locator('.pile-overlay', { hasText: 'Lurrus of the Dream-Den' }).locator('.card-slot.playable')
    await expect(companionCard, 'Lurrus jugable (pagable {3}) en el visor').toBeVisible()
    await companionCard.click()
    await expect
      .poll(() => parseSent(sentOf(page)).some((f) => f.action === 'sendPlayerUUID' && f.args?.value === 'c-1'), {
        timeout: 10_000,
        message: 'clic en el compañero debe enviar sendPlayerUUID(c-1)',
      })
      .toBe(true)

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})

test('BRD-66: a revealed card opened from its notice stays face up when hovered', { tag: '@game' }, async ({ page }) => {
  await withFakeServer(() => infoWindowsScenario(), async () => {
    const { pageErrors } = await quickStartGame(page, { prefix: 'infoh' })

    const companion = page.locator('.pile-overlay', { hasText: 'Lurrus of the Dream-Den' })
    await expect(companion).toBeVisible({ timeout: 15_000 })
    await dismissInfoWindows(page)
    await expect(companion).toHaveCount(0)

    await page.getByTestId('reveal-toast').locator('.reveal-toast-expand').click()
    const viewer = page.locator('.pile-overlay', { hasText: 'Scry Card' })
    await expect(viewer).toBeVisible()
    const item = viewer.locator('.zone-fan-item').first()
    await expect
      .poll(() => item.locator('.pile-card').evaluate((el) => el.getAnimations().filter((a) => a.playState === 'running').length))
      .toBe(0)

    await item.hover()
    const lifted = viewer.locator('.zone-fan-lift .pile-card')
    await expect(lifted).toHaveCount(1)
    const replays = await lifted.evaluate((el) => el.getAnimations().map((a) => (a as CSSAnimation).animationName))
    expect(replays, 'the lifted copy must not turn the card face up again').not.toContain('pileFlipIn')
    expect(await lifted.evaluate((el) => getComputedStyle(el).opacity)).toBe('1')

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})
