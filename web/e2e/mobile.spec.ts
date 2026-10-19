import { test, expect } from '@playwright/test'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { login } from './support/start-game'
import { makeBaseScenario } from '../fixtures/fake'
import { playerGameView } from '../src/__fixtures__/gameViews'

fakeOnly()

const scenario = () => makeBaseScenario({ tableId: 'mobile-1', tableName: 'mobile-room', gameId: 'mobile-game', gameView: playerGameView })

test.use({ viewport: { width: 390, height: 844 } })

test.describe('narrow screens @lobby', () => {
  test('the lobby and the create-table wizard stay inside a phone-width window', async ({ page }) => {
    await withFakeServer(scenario, async () => {
      await login(page, 'phone-user')
      const lobby = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
      expect(lobby.sw).toBeLessThanOrEqual(lobby.cw)

      await page.getByTestId('create-table-open').or(page.getByRole('button', { name: /nueva mesa|new table|create table/i }).first()).click()
      const dialog = page.locator('.create-table-dialog')
      await expect(dialog).toBeVisible()
      const box = await dialog.evaluate((el) => {
        const r = el.getBoundingClientRect()
        return { left: r.left, right: r.right, vw: document.documentElement.clientWidth }
      })
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.right).toBeLessThanOrEqual(box.vw)
      expect(Math.abs(box.left - (box.vw - box.right))).toBeLessThanOrEqual(2)

      const labels = await page.locator('.wizard-step-text').evaluateAll((els) =>
        els.filter((el) => (el as HTMLElement).offsetParent !== null).length,
      )
      expect(labels).toBe(1)
      const stepper = await page.locator('.wizard-stepper').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
      expect(stepper).toBe(true)
    })
  })

  test('a spectator gets the compact view and can open the full board', async ({ page }) => {
    await withFakeServer(scenario, async () => {
      await login(page, 'phone-spectator')
      await page.evaluate((view) => {
        const store = (globalThis as unknown as { __mageStore: { setState: (s: unknown) => void } }).__mageStore
        const watching = { ...view, myPlayerId: 'nobody', players: (view.players ?? []).map((p) => ({ ...p, controlled: false })) }
        store.setState({ phase: 'game', gameId: 'mobile-game', game: watching })
      }, playerGameView)

      await expect(page.getByTestId('mobile-spectator')).toBeVisible()
      await expect(page.getByTestId('mspec-player')).toHaveCount(playerGameView.players?.length ?? 0)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
      expect(overflow).toBe(true)

      await page.getByTestId('mspec-tab-chat').click()
      await expect(page.getByTestId('mspec-pane-chat')).toBeVisible()

      await page.getByTestId('mspec-full').click()
      await expect(page.getByTestId('mobile-spectator')).toHaveCount(0)
    })
  })

  test('a player keeps the full board on a narrow screen', async ({ page }) => {
    await withFakeServer(scenario, async () => {
      await login(page, 'phone-player')
      await page.evaluate((view) => {
        const store = (globalThis as unknown as { __mageStore: { setState: (s: unknown) => void } }).__mageStore
        store.setState({ phase: 'game', gameId: 'mobile-game', game: view })
      }, playerGameView)
      await expect(page.getByTestId('game-status')).toBeVisible()
      await expect(page.getByTestId('mobile-spectator')).toHaveCount(0)
    })
  })

  test('the draft header and its buttons stay inside a phone-width window', async ({ page }) => {
    await withFakeServer(scenario, async () => {
      await login(page, 'phone-drafter')
      await page.evaluate(() => {
        const store = (globalThis as unknown as { __mageStore: { setState: (s: unknown) => void } }).__mageStore
        store.setState({
          draft: {
            draftId: 'mobile-draft',
            message: {
              draftView: { setNames: ['Core Set 2021'], setCodes: ['M21'], boosterNum: 1, cardNum: 2, players: ['a', 'b', 'c', 'd'] },
              draftPickView: {
                booster: { 'c-1': { id: 'c-1', expansionSetCode: 'M21', cardNumber: '1', name: 'Lightning Bolt' } },
                picks: {},
                picking: true,
                timeout: 60,
              },
            },
          },
          lastDraftMethod: 'DRAFT_PICK',
          phase: 'game',
        })
      })
      await expect(page.locator('.draft-screen')).toBeVisible()
      const outside = await page.locator('.draft-header, .draft-header *').evaluateAll((els) => {
        const vw = document.documentElement.clientWidth
        return els.filter((el) => {
          const r = el.getBoundingClientRect()
          return r.width > 0 && (r.right > vw + 1 || r.left < -1)
        }).length
      })
      expect(outside).toBe(0)
    })
  })
})
