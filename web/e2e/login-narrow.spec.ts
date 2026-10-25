import type { Locator, Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { dismissSetupWizard } from './support/start-game'

interface Box { x: number; y: number; width: number; height: number }

const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

async function boxOf(locator: Locator): Promise<Box> {
  await expect(locator).toBeVisible({ timeout: 15_000 })
  const box = await locator.boundingBox()
  if (!box) throw new Error('element has no bounding box')
  return box
}

async function openNarrowLogin(page: Page) {
  await page.goto('/')
  await dismissSetupWizard(page)
  await expect(page.locator('.login-card')).toBeVisible({ timeout: 15_000 })
}

async function expectNarrowLoginRules(page: Page) {
  await openNarrowLogin(page)

  const attributions = page.locator('.login-attribution, .app-attribution').filter({ visible: true })
  await expect(attributions).toHaveCount(1)

  const attribution = await boxOf(attributions.first())
  const controls = {
    'sign-in button': page.locator('.login-submit-btn'),
    'server selector': page.locator('.login-presets-row'),
    'username input': page.locator('.login-field-username input'),
  }
  for (const [name, control] of Object.entries(controls)) {
    const box = await boxOf(control)
    expect(intersects(attribution, box), `attribution overlaps the ${name}`).toBe(false)
  }

  const label = page.locator('.network-box-title')
  await boxOf(label)
  const overflow = await label.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    textOverflow: getComputedStyle(el).textOverflow,
  }))
  expect(overflow.scrollWidth, 'network label is clipped').toBeLessThanOrEqual(overflow.clientWidth)
  expect(overflow.textOverflow, 'network label is truncated with an ellipsis').not.toBe('ellipsis')
}

test.describe('ACC-7: login screen at phone width', () => {
  test.describe('390 px', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('ACC-7: at 390 px the login shows one attribution, with no overlap and no truncated label', async ({ page }) => {
      await expectNarrowLoginRules(page)
    })
  })

  test.describe('320 px', () => {
    test.use({ viewport: { width: 320, height: 640 } })

    test('ACC-7: at 320 px the login shows one attribution, with no overlap and no truncated label', async ({ page }) => {
      await expectNarrowLoginRules(page)
    })
  })
})
