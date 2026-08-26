import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
fakeOnly()

test.describe('Draft', { tag: '@draft' }, () => {
  test('booster se renderiza, timeout y pick', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(500)
    await page.evaluate(() => {
      const store = (globalThis as unknown as { __mageStore?: { setState: (s: unknown) => void } }).__mageStore
      store?.setState({
        draft: {
          draftId: 'draft-test-1',
          message: {
            draftView: { setNames: ['Core Set 2021'], setCodes: ['M21'], boosterNum: 1, cardNum: 2, players: ['a','b','c','d','e','f','g','h'] },
            draftPickView: {
              booster: {
                'c-1': { id: 'c-1', expansionSetCode: 'M21', cardNumber: '1', name: 'Lightning Bolt' },
                'c-2': { id: 'c-2', expansionSetCode: 'M21', cardNumber: '2', name: 'Grizzly Bears' },
                'c-3': { id: 'c-3', expansionSetCode: 'M21', cardNumber: '3', name: 'Island' },
              },
              picks: {},
              picking: true,
              timeout: 60,
            },
          },
        },
        phase: 'game',
      })
    })
    const draft = page.locator('.draft-screen').first()
    await expect(draft).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('draft-booster').first()).toBeVisible()
    await expect(page.getByTestId('draft-timeout').first()).toHaveText(/\d+:\d+/)
    const card = page.getByTestId('draft-card').first()
    await expect(card).toBeVisible()
  })

  test('después del draft aparece CONSTRUCT', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(500)
    await page.evaluate(() => {
      const store = (globalThis as unknown as { __mageStore?: { setState: (s: unknown) => void } }).__mageStore
      store?.setState({
        draft: null,
        construct: {
          deckName: 'Draft Pool',
          pool: {
            'c-1': { id: 'c-1', expansionSetCode: 'M21', cardNumber: '1', name: 'Lightning Bolt' },
            'c-2': { id: 'c-2', expansionSetCode: 'M21', cardNumber: '2', name: 'Grizzly Bears' },
            'c-3': { id: 'c-3', expansionSetCode: 'M21', cardNumber: '3', name: 'Forest' },
            'c-4': { id: 'c-4', expansionSetCode: 'M21', cardNumber: '4', name: 'Mountain' },
            'c-5': { id: 'c-5', expansionSetCode: 'M21', cardNumber: '5', name: 'Island' },
          },
          tableId: 'table-draft-1',
          parentTableId: null,
          timeLeft: 600,
        },
        phase: 'game',
      })
    })
    const construct = page.locator('.construct-screen').first()
    await expect(construct).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('construct-submit').first()).toBeVisible()
    await expect(page.locator('.construct-screen').first()).toContainText(/Pool/)
  })
})
