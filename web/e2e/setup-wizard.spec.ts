import { test, expect } from './fixtures'

test('setup wizard: aparece en contexto fresco, se completa y precarga el login', async ({ page }) => {
  await page.goto('/')
  const wizard = page.getByTestId('setup-wizard')
  await expect(wizard).toBeVisible({ timeout: 10_000 })

  const next = page.getByTestId('setup-next')
  await next.click()
  await page.getByTestId('setup-username').fill('e2eplayer')
  await next.click()
  await expect(page.getByTestId('setup-preset-official')).toBeVisible()
  await next.click()
  await expect(page.getByTestId('settings-layout-arena')).toBeVisible()
  await next.click()
  await expect(page.getByTestId('settings-sound-card')).toBeVisible()
  await next.click()
  await expect(page.getByTestId('setup-counter')).toContainText('6')
  // el paso final ('done') muestra "Entrar" (setup-enter), no hay setup-next
  await expect(page.getByTestId('setup-enter')).toBeVisible()
  await page.getByTestId('setup-enter').click()
  await expect(wizard).toBeHidden({ timeout: 5_000 })
  await expect(page.getByLabel(/Nombre de usuario|Usuario|Username/i)).toHaveValue('e2eplayer')
})

test('setup wizard: omitir deja el login intacto', async ({ page }) => {
  await page.goto('/')
  const wizard = page.getByTestId('setup-wizard')
  await expect(wizard).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('setup-skip').click()
  await expect(wizard).toBeHidden({ timeout: 5_000 })
  await expect(page.getByRole('button', { name: /Conectar|Connect/i })).toBeVisible()
})

for (const viewport of [{ width: 1366, height: 768 }, { width: 375, height: 812 }]) {
  test(`SET-13: the board step fits the wizard at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page.getByTestId('setup-wizard')).toBeVisible({ timeout: 10_000 })
    for (let i = 0; i < 3; i++) await page.getByTestId('setup-next').click()
    await expect(page.getByTestId('settings-layout-arena')).toBeVisible()

    const box = await page.getByTestId('setup-body').evaluate((body) => {
      const rect = (el: Element | null) => el!.getBoundingClientRect()
      const cards = [...body.querySelectorAll('[data-testid^="settings-layout-"]')].map((c) => rect(c))
      return {
        body: rect(body),
        cards: cards.map((c) => ({ width: c.width, top: c.top, bottom: c.bottom })),
        preview: rect(body.querySelector('[data-testid="board-layout-preview"]')),
      }
    })
    // Two cards per row, each wide enough to read its description.
    expect(box.cards).toHaveLength(4)
    for (const card of box.cards) expect(card.width).toBeGreaterThan(box.body.width / 2 - 40)
    expect(box.cards[0].top).toBe(box.cards[1].top)
    expect(box.cards[2].top).toBeGreaterThan(box.cards[0].bottom)
    // The preview sits under the options and inside the wizard.
    expect(box.preview.top).toBeGreaterThan(Math.max(...box.cards.map((c) => c.bottom)))
    expect(box.preview.right).toBeLessThanOrEqual(box.body.right + 1)
  })
}
