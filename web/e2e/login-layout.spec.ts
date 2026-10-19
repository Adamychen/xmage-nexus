import { test, expect } from './fixtures'
import { dismissSetupWizard } from './support/start-game'

test.use({ viewport: { width: 1280, height: 720 }, launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })

interface Sample {
  label: string
  gutter: number
  cardLeft: number
}

test('login: moving the pointer does not toggle the scroll gutter or shift the card @login', async ({ page }) => {
  await page.goto('/')
  await dismissSetupWizard(page)
  const card = page.locator('.login-card')
  await expect(card).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(600)

  const sample = (label: string) => page.evaluate((label): Sample => {
    const wrap = document.querySelector('.login-wrap') as HTMLElement
    const el = document.querySelector('.login-card') as HTMLElement
    return { label, gutter: wrap.offsetWidth - wrap.clientWidth, cardLeft: Math.round(el.getBoundingClientRect().left) }
  }, label)

  const samples: Sample[] = [await sample('initial')]
  const { width, height } = page.viewportSize()!
  for (let y = 10; y < height; y += Math.round(height / 4)) {
    for (let x = 10; x < width; x += Math.round(width / 4)) {
      await page.mouse.move(x, y, { steps: 2 })
      await page.waitForTimeout(80)
      samples.push(await sample(`mouse ${x},${y}`))
    }
  }
  const controls = card.locator('input, button, select, .user-avatar-preview')
  const count = await controls.count()
  for (let i = 0; i < count; i++) {
    const control = controls.nth(i)
    if (!(await control.isVisible())) continue
    await control.hover()
    await page.waitForTimeout(120)
    samples.push(await sample(`hover #${i}`))
  }

  expect(samples.length).toBeGreaterThan(10)
  expect(new Set(samples.map((s) => s.gutter)).size, JSON.stringify(samples.filter((s) => s.gutter !== samples[0].gutter).slice(0, 3))).toBe(1)
  expect(new Set(samples.map((s) => s.cardLeft)).size, JSON.stringify(samples.filter((s) => s.cardLeft !== samples[0].cardLeft).slice(0, 3))).toBe(1)
})
