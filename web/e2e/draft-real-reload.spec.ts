import { test, type Browser, type Page } from '@playwright/test'
import { login } from './support/start-game'
import { FAKE_MODE } from './dual'

const TABLE_NAME = (tag: string) => `drr-${tag}`

async function createHumanDraft(page: Page, table: string) {
  await page.getByRole('button', { name: /Nuevo torneo/i }).first().click()
  const dialog = page.locator('.create-table-dialog')
  await page.getByPlaceholder(/Ej\. Modern Casual Bo3/).fill(table)
  await page.getByRole('tab', { name: /Draft \/ Limitado/i }).click()
  await dialog.getByRole('button', { name: '2 plazas' }).first().click()
  await dialog.getByRole('button', { name: /Crear Torneo Draft/ }).click()
}


test.describe('Draft reload against the real stack', { tag: '@draftreal' }, () => {
  test.skip(FAKE_MODE, 'solo stack real (proxy + XMage local)')
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
