import { test, expect, type Browser, type Page } from '@playwright/test'
import { login } from './support/start-game'

const TABLE_NAME = (tag: string) => `drr-${tag}`

async function createHumanDraft(page: Page, table: string) {
  await page.getByRole('button', { name: /Nuevo torneo/i }).first().click()
  await page.getByPlaceholder(/Ej\. Modern Casual Bo3/).fill(table)
  await page.getByRole('tab', { name: /Draft \/ Limitado/i }).click()
  await page.getByLabel(/Limitado — Draft \/ Sealed/i).selectOption('Booster Draft Elimination (Random)')
  await page.locator('button.wizard-step[title="Draft"]').click()
  await page.getByPlaceholder(/M21, MH3, BLB/).fill('M21')
  const seat = page.getByTestId('seat-type-1')
  const plaza2 = page.getByText('Plaza 2', { exact: true }).first()
  for (let i = 0; i < 8; i++) {
    if (await plaza2.count() > 0 && await plaza2.isVisible()) {
      await plaza2.click()
      if (await seat.count() > 0 && await seat.first().isVisible()) break
    }
    await page.getByRole('button', { name: /Siguiente/ }).click()
  }
  await seat.getByRole('radio', { name: /Humano/ }).click()
  await page.getByRole('button', { name: /Crear Torneo Draft|Crear torneo|Create Draft/i }).last().click()
}

test.describe('Draft reload against the real stack', { tag: '@draftreal' }, () => {
  test('two humans draft, then reload during construction', async ({ page, browser }: { page: Page; browser: Browser }) => {
    test.setTimeout(10 * 60_000)
    const tag = String(Date.now()).slice(-6)
    const host = `drh${tag}`
    const guest = `drg${tag}`
    await login(page, host, { landsOn: 'body' })
    await createHumanDraft(page, TABLE_NAME(tag))
    await page.screenshot({ path: 'e2e/shots/draft-real-host-created.png' })
    const guestCtx = await browser.newContext()
    const guestPage = await guestCtx.newPage()
    await login(guestPage, guest, { landsOn: 'body' })
    await guestPage.getByText(TABLE_NAME(tag)).first().waitFor({ timeout: 30_000 })
    await guestPage.screenshot({ path: 'e2e/shots/draft-real-guest-lobby.png' })
  })
})
