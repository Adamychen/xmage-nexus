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
  await expect(page.getByTestId('option-switch-boardSpotlight')).toBeVisible()
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
    await expect(page.getByTestId('option-switch-boardSpotlight')).toBeVisible()

    const box = await page.getByTestId('setup-body').evaluate((body) => {
      const rect = (el: Element | null) => el!.getBoundingClientRect()
      const rows = [...body.querySelectorAll('.settings-row')].map((c) => rect(c))
      return {
        body: rect(body),
        rows: rows.map((c) => ({ right: c.right, bottom: c.bottom })),
        preview: rect(body.querySelector('[data-testid="board-live-preview"]')),
      }
    })
    expect(box.rows.length).toBeGreaterThan(0)
    for (const row of box.rows) expect(row.right).toBeLessThanOrEqual(box.body.right + 1)
    if (viewport.width < 820) expect(box.preview.top).toBeGreaterThanOrEqual(Math.max(...box.rows.map((c) => c.bottom)) - 1)
    expect(box.preview.right).toBeLessThanOrEqual(box.body.right + 1)
  })
}
