import { test, expect } from '@playwright/test'
import { fakeOnly } from './support/fake-mode'

fakeOnly()

const TEXT_BOXES = '.rc-text, .rc-halves, .rc-half-text'

test.describe('Rendered cards', () => {
  test('no rules text is ever cut: a box that overflows scrolls and the fit hook has shrunk it first', async ({ page }) => {
    await page.goto('/#/gallery')
    await page.getByText('Rendered cards', { exact: true }).first().click()
    await expect(page.locator('.rc').first()).toBeVisible()
    await page.waitForTimeout(800)

    const report = await page.evaluate((selector) => {
      const problems: string[] = []
      let boxes = 0
      for (const box of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
        boxes++
        const overflows = box.scrollHeight > box.clientHeight + 1
        if (!overflows) continue
        const style = getComputedStyle(box)
        const name = box.closest('.rc')?.getAttribute('aria-label') ?? '?'
        if (style.overflowY !== 'auto' && style.overflowY !== 'scroll') problems.push(`${name}: overflow is cut (${style.overflowY})`)
        const fit = Number(box.style.getPropertyValue('--rc-fit') || '1')
        if (box.classList.contains('rc-text') && fit >= 1) problems.push(`${name}: overflows but the fit hook did not shrink it`)
      }
      return { boxes, problems }
    }, TEXT_BOXES)

    expect(report.boxes).toBeGreaterThan(10)
    expect(report.problems).toEqual([])
  })

  test('the width slider scales a card without changing its proportions', async ({ page }) => {
    await page.goto('/#/gallery')
    await page.getByText('Rendered cards', { exact: true }).first().click()
    const card = page.locator('.rc').first()
    await expect(card).toBeVisible()
    const before = await card.boundingBox()
    await page.locator('input[type="range"]').fill('400')
    await expect.poll(async () => (await card.boundingBox())?.width ?? 0).toBeGreaterThan((before?.width ?? 0) + 50)
    const after = await card.boundingBox()
    expect(Math.abs(after!.height / after!.width - 1.4)).toBeLessThan(0.02)
  })
})
