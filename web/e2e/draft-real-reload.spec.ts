import { expect, test, type Browser, type Page } from '@playwright/test'
import { login, openCreateDialog } from './support/start-game'
import { FAKE_MODE } from './dual'

const TABLE_NAME = (tag: string) => `drr-${tag}`

async function createHumanDraft(page: Page, table: string) {
  await openCreateDialog(page, 'tourney')
  const dialog = page.locator('.create-table-dialog')
  await page.getByPlaceholder(/Ej\. Modern Casual Bo3/).fill(table)
  await dialog.getByRole('radio', { name: /Draft de sobres/ }).click()
  await dialog.getByRole('radio', { name: 'Rich Man', exact: true }).click()
  for (let i = 0; i < 6; i++) await dialog.getByRole('button', { name: 'Menos plazas' }).click()
  await expect(dialog.getByRole('spinbutton', { name: 'Número de plazas' })).toHaveValue('2')
  await dialog.getByRole('button', { name: /Siguiente/ }).click()
  await dialog.getByRole('button', { name: /Siguiente/ }).click()
  await dialog.getByRole('button', { name: /Crear torneo/ }).click()
}


test.describe('Draft reload against the real stack @real', { tag: '@draftreal' }, () => {
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
