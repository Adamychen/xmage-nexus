/**
 * Real-browser proof that the gallery "Replay" button actually runs each FX
 * keyframe. jsdom does not apply the CSS cascade, so a later stylesheet rule
 * can silently override an FX class's `animation` and nothing plays; here
 * `getComputedStyle(el).animationName` is read after pressing Replay.
 */
import { test, expect, type Page } from '@playwright/test'
import { retryTimingSpecInCi } from './support/timing'

retryTimingSpecInCi()

async function openGallery(page: Page) {
  await page.addInitScript(() => localStorage.clear())
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (route) => route.abort())
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/#/gallery')
  await expect(page.locator('[data-gallery]')).toBeVisible({ timeout: 30_000 })
  await page.evaluate(() => document.fonts.ready)
}

async function showEntry(page: Page, id: string) {
  const button = page.locator(`[data-gallery-entry="${id}"]`)
  await expect(button, `entry ${id} is missing`).toHaveCount(1)
  await button.click()
  await expect(page.locator(`[data-gallery-stage="${id}"]`)).toBeAttached({ timeout: 10_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(250)
  await page.evaluate(() => window.dispatchEvent(new Event('resize')))
  await page.waitForTimeout(150)
}

async function replayEntry(page: Page, id: string) {
  await showEntry(page, id)
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: 'Replay' }).first().click()
}

async function animationOf(page: Page, selector: string): Promise<string> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    return el ? getComputedStyle(el).animationName : ''
  }, selector)
}

async function expectAnimation(page: Page, selector: string, keyframes: string) {
  await expect
    .poll(() => animationOf(page, selector), { timeout: 4000, intervals: [30] })
    .toContain(keyframes)
}

function trackPageErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))
  return errors
}

test.describe('animations really play @board', { tag: '@timing' }, () => {
  test('FX-12: anim:countered runs counteredDrain', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:countered')
    await expectAnimation(page, '.fx-countered-shake', 'counteredDrain')
    expect(pageErrors).toEqual([])
  })

  test('FX-12: anim:fizzle runs fizzleSmoke', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:fizzle')
    await expectAnimation(page, '.fx-fizzle', 'fizzleSmoke')
    expect(pageErrors).toEqual([])
  })

  test('FX-12: anim:designation-monstrous runs designationGlow and designationSwell', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:designation-monstrous')
    await expectAnimation(page, '.designation-badge.designation-gained--monstrous', 'designationGlow')
    await expectAnimation(page, '.card-slot.fx-designation-swell', 'designationSwell')
    expect(pageErrors).toEqual([])
  })

  test('FX-12: anim:designation-suspected runs designationJolt', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:designation-suspected')
    await expectAnimation(page, '.designation-badge.designation-gained--suspected', 'designationJolt')
    expect(pageErrors).toEqual([])
  })

  test('FX-12: anim:designation-classlevel runs designationGlow', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:designation-classlevel')
    await expectAnimation(page, '.designation-badge.designation-gained--classlevel', 'designationGlow')
    expect(pageErrors).toEqual([])
  })

  test('FX-12: anim:designation-casesolved runs designationGlow', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:designation-casesolved')
    await expectAnimation(page, '.designation-badge.designation-gained--casesolved', 'designationGlow')
    expect(pageErrors).toEqual([])
  })

  test('FX-12: anim:scry runs peekLift with two cards', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:scry')
    await expectAnimation(page, '[data-testid="fx-library-peek"] .peek-lift', 'peekLift')
    await expect(page.locator('[data-testid="fx-library-peek"]')).toHaveAttribute('data-count', '2')
    expect(pageErrors).toEqual([])
  })

  test('FX-12: anim:surveil-opp shows the opponent library peek with three cards', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:surveil-opp')
    await expect(page.locator('[data-testid="fx-library-peek"]')).toHaveAttribute('data-count', '3')
    expect(pageErrors).toEqual([])
  })

  test('FX-12: anim:pay-paid runs payPaid', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:pay-paid')
    await expectAnimation(page, '.player-info-bar.fx-paid', 'payPaid')
    expect(pageErrors).toEqual([])
  })

  test('FX-12: anim:pay-declined-opp runs payDeclined', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:pay-declined-opp')
    await expectAnimation(page, '.player-info-bar.fx-declined', 'payDeclined')
    expect(pageErrors).toEqual([])
  })

  test('FX-12: anim:chosen-card shows the Blue floater', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:chosen-card')
    await expect(page.locator('.fx-floater', { hasText: 'Blue' }).first()).toBeVisible({ timeout: 4000 })
    expect(pageErrors).toEqual([])
  })

  test('FX-12: anim:behold runs beholdLift', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:behold')
    await expectAnimation(page, '.card-slot.fx-behold', 'beholdLift')
    expect(pageErrors).toEqual([])
  })

  test('FX-12: anim:dungeon-complete runs badgeDungeonComplete', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:dungeon-complete')
    await expectAnimation(page, '.badge-dungeon.fx-dungeon-complete', 'badgeDungeonComplete')
    expect(pageErrors).toEqual([])
  })

  test('FX-12: anim:goad runs goadPulse', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:goad')
    await expectAnimation(page, '.card-icon.icon-gained--goad', 'goadPulse')
    expect(pageErrors).toEqual([])
  })

  test('FX-12: anim:player-conceded shows the conceded overlay without eliminated', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:player-conceded')
    await expect(page.locator('[data-testid="fx-conceded"]')).toBeAttached({ timeout: 4000 })
    await expect(page.locator('[data-testid="fx-eliminated"]')).toHaveCount(0)
    expect(pageErrors).toEqual([])
  })

  test('FX-12: anim:player-eliminated shows the eliminated overlay', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:player-eliminated')
    await expect(page.locator('[data-testid="fx-eliminated"]')).toBeAttached({ timeout: 4000 })
    expect(pageErrors).toEqual([])
  })

  test('FX-12: anim:seat-focus-pulse pulses the shrunk seat strip once', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:seat-focus-pulse')
    await expectAnimation(page, '.seat-strip-pulse', 'seatStripPulse')
    expect(pageErrors).toEqual([])
  })

  test('FX-12, BRD-8: anim:spotlight-copy-pulse pulses the copy once', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:spotlight-copy-pulse')
    await expectAnimation(page, '.spotlight-copy-pulse', 'spotlightCopyPulse')
    expect(pageErrors).toEqual([])
  })

  test('FX-12: anim:keyword-auras runs one looping aura per keyword', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:keyword-auras')
    await expectAnimation(page, '.kw-aura--indestructible', 'kwAuraIndestructible')
    await expectAnimation(page, '.kw-aura--hexproof', 'kwAuraHexproof')
    await expectAnimation(page, '.kw-aura--deathtouch', 'kwAuraDeathtouch')
    await expectAnimation(page, '.kw-aura--flying', 'kwAuraFlying')
    await expectAnimation(page, '.kw-aura--lifelink', 'kwAuraLifelink')
    await expectAnimation(page, '.kw-aura--trample', 'kwAuraTrample')
    await expectAnimation(page, '.kw-aura--haste', 'kwAuraHaste')
    expect(pageErrors).toEqual([])
  })

  test('FX-12: anim:keyword-gain pops the coin and flares the aura', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:keyword-gain')
    await expectAnimation(page, '.kw-coin.kw-gained', 'kwCoinGained')
    await expectAnimation(page, '.kw-aura-flare--flying', 'kwAuraFlare')
    expect(pageErrors).toEqual([])
  })

  test('FX-12: anim:kw-first-strike flashes the first-strike slash', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:kw-first-strike')
    await expect(page.locator('[data-testid="fx-first-strike"]')).toBeAttached({ timeout: 4000 })
    expect(pageErrors).toEqual([])
  })

  test('FX-12: anim:kw-deathtouch shows the deathtouch kill', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:kw-deathtouch')
    await expect(page.locator('[data-testid="fx-deathtouch"]')).toBeAttached({ timeout: 4000 })
    expect(pageErrors).toEqual([])
  })

  test('FX-12: anim:kw-lifelink sends the lifelink motes', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:kw-lifelink')
    await expect(page.locator('[data-testid="fx-lifelink"]')).toBeAttached({ timeout: 4000 })
    expect(pageErrors).toEqual([])
  })

  test('FX-12: anim:kw-trample sends the overflow wave to the player', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:kw-trample')
    await expect(page.locator('[data-testid="fx-trample"]')).toBeAttached({ timeout: 4000 })
    expect(pageErrors).toEqual([])
  })

  test('FX-12: anim:kw-indestructible flashes the burst on the surviving creature', async ({ page }) => {
    const pageErrors = trackPageErrors(page)
    await openGallery(page)
    await replayEntry(page, 'anim:kw-indestructible')
    await expect(page.locator('[data-testid="fx-indestructible"]')).toBeAttached({ timeout: 4000 })
    expect(pageErrors).toEqual([])
  })
})
