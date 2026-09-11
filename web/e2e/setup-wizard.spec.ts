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
