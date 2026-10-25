import { fakeOnly } from './support/fake-mode'
import { test, expect } from './fixtures'
import { dismissSetupWizard, quickStartGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { spellsScenario } from '../fixtures/scenarios/spells'
import type { Page } from '@playwright/test'

fakeOnly()

function brightness(rgb: string): number {
  const parts = rgb.match(/[\d.]+/g)!.slice(0, 3).map(Number)
  return parts.reduce((sum, v) => sum + v, 0) / 3
}

async function chooseAppearance(page: Page, choice: 'system' | 'light' | 'dark') {
  await page.getByTestId('open-settings').click()
  await page.getByTestId('settings-nav-interface').click()
  await page.getByTestId(`settings-appearance-${choice}`).click()
  await page.getByTestId('settings-close').click()
  await expect(page.getByTestId('settings-modal')).toBeHidden()
}

async function readSurface(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) throw new Error(`missing ${sel}`)
    const style = getComputedStyle(el)
    return {
      background: style.backgroundColor,
      colorScheme: style.colorScheme,
      ink0: style.getPropertyValue('--ink-0').trim(),
    }
  }, selector)
}

async function followSystemAppearance(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('mage-web-appearance', JSON.stringify({ sleeveId: 'classic', appearance: 'system' }))
  })
}

test.describe('system light appearance', () => {
  test.use({ colorScheme: 'light' })

  test.beforeEach(async ({ page }) => {
    await followSystemAppearance(page)
  })

  test('APR-1: the login page renders the light appearance when the system asks for light', async ({ page }) => {
    await page.goto('/')
    await dismissSetupWizard(page)
    await expect(page.locator('.login-card')).toBeVisible({ timeout: 15_000 })
    const root = await readSurface(page, 'html')
    expect(root.colorScheme).toBe('light dark')
    expect(root.ink0).toBe('#e4e9f2')
    expect(brightness(root.background)).toBeGreaterThan(200)
  })

  test('APR-2: the battlefield keeps the dark tokens while the rest of the app is light', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 880 })
    await withFakeServer(() => spellsScenario('blaze'), async () => {
      await quickStartGame(page, { prefix: 'apr', skipAsks: true })
      const board = page.locator('.board-shell.board-surface')
      await expect(board).toBeVisible({ timeout: 30_000 })
      const surface = await readSurface(page, '.board-shell.board-surface')
      expect(surface.ink0).toBe('#060910')
      expect(surface.colorScheme).toBe('dark')
      const chrome = await readSurface(page, '.game.board-surface')
      expect(chrome.ink0).toBe('#060910')
      expect(chrome.colorScheme).toBe('dark')
      const root = await readSurface(page, 'html')
      expect(root.ink0).toBe('#e4e9f2')
    })
  })

  test('APR-1: choosing Dark in Settings makes the login page dark while the system is light', async ({ page }) => {
    await page.goto('/')
    await dismissSetupWizard(page)
    await expect(page.locator('.login-card')).toBeVisible({ timeout: 15_000 })
    await chooseAppearance(page, 'dark')
    const root = await readSurface(page, 'html')
    expect(root.colorScheme).toBe('dark')
    expect(root.ink0).toBe('#060910')
    expect(brightness(root.background)).toBeLessThan(60)
  })

  test('APR-1: choosing System again follows the light system appearance', async ({ page }) => {
    await page.goto('/')
    await dismissSetupWizard(page)
    await expect(page.locator('.login-card')).toBeVisible({ timeout: 15_000 })
    await chooseAppearance(page, 'dark')
    await chooseAppearance(page, 'system')
    const root = await readSurface(page, 'html')
    expect(root.colorScheme).toBe('light dark')
    expect(root.ink0).toBe('#e4e9f2')
    expect(brightness(root.background)).toBeGreaterThan(200)
  })
})

test.describe('default appearance', () => {
  test.use({ colorScheme: 'light' })

  test('APR-1: with nothing chosen the login page is dark even when the system asks for light', async ({ page }) => {
    await page.goto('/')
    await dismissSetupWizard(page)
    await expect(page.locator('.login-card')).toBeVisible({ timeout: 15_000 })
    const root = await readSurface(page, 'html')
    expect(root.ink0).toBe('#060910')
    expect(brightness(root.background)).toBeLessThan(60)
  })
})

test.describe('system dark appearance', () => {
  test.use({ colorScheme: 'dark' })

  test.beforeEach(async ({ page }) => {
    await followSystemAppearance(page)
  })

  test('APR-1: the login page renders the dark appearance when the system asks for dark', async ({ page }) => {
    await page.goto('/')
    await dismissSetupWizard(page)
    await expect(page.locator('.login-card')).toBeVisible({ timeout: 15_000 })
    const root = await readSurface(page, 'html')
    expect(root.colorScheme).toBe('light dark')
    expect(root.ink0).toBe('#060910')
    expect(brightness(root.background)).toBeLessThan(60)
  })

  test('APR-1: choosing Light in Settings makes the login page light while the system is dark', async ({ page }) => {
    await page.goto('/')
    await dismissSetupWizard(page)
    await expect(page.locator('.login-card')).toBeVisible({ timeout: 15_000 })
    await chooseAppearance(page, 'light')
    const root = await readSurface(page, 'html')
    expect(root.colorScheme).toBe('light')
    expect(root.ink0).toBe('#e4e9f2')
    expect(brightness(root.background)).toBeGreaterThan(200)
  })

  test('APR-2: a forced Light appearance keeps the battlefield on the dark tokens', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 880 })
    await page.addInitScript(() => {
      window.localStorage.setItem('mage-web-appearance', JSON.stringify({ sleeveId: 'classic', appearance: 'light' }))
    })
    await withFakeServer(() => spellsScenario('blaze'), async () => {
      await quickStartGame(page, { prefix: 'aprl', skipAsks: true })
      await expect(page.locator('.board-shell.board-surface')).toBeVisible({ timeout: 30_000 })
      const root = await readSurface(page, 'html')
      expect(root.colorScheme).toBe('light')
      expect(root.ink0).toBe('#e4e9f2')
      const surface = await readSurface(page, '.board-shell.board-surface')
      expect(surface.ink0).toBe('#060910')
      expect(surface.colorScheme).toBe('dark')
    })
  })
})
