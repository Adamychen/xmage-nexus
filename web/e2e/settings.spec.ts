import { test, expect } from '@playwright/test'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { login } from './support/start-game'
import { makeBaseScenario } from '../fixtures/fake'
import { playerGameView } from '../src/__fixtures__/gameViews'

fakeOnly()

function lobbyScenario() {
  return makeBaseScenario({
    tableId: 'table-set-1',
    tableName: 'settings-e2e',
    gameId: 'game-set-1',
    gameView: playerGameView,
  })
}

test.describe('Global settings modal', () => {
  test('abre desde el header, cambia de sección y ajusta el zoom sin iconos', async ({ page }) => {
    await withFakeServer(lobbyScenario, async () => {
      await login(page, 'e2e')
      await page.getByTestId('open-settings').click()
      await expect(page.getByTestId('settings-modal')).toBeVisible()
      await expect(page.getByTestId('settings-section-language')).toBeVisible()
      await expect(page.locator('.settings-nav svg')).toHaveCount(0)
      await page.getByTestId('settings-nav-interface').click()
      await expect(page.getByTestId('settings-section-interface')).toBeVisible()
      await page.getByTestId('settings-zoom-plus').click()
      await expect(page.getByTestId('settings-zoom-current')).toHaveText('115%')
      await page.getByTestId('settings-nav-sound').click()
      await expect(page.locator('[data-testid="settings-sound-card"] .audio-slider').first()).toBeVisible()
      await page.getByTestId('settings-nav-gameplay').click()
      await expect(page.getByTestId('settings-section-gameplay')).toBeVisible()
      await page.getByTestId('settings-close').click()
      await expect(page.getByTestId('settings-modal')).toBeHidden()
    })
  })

  test('secciones sonido y tablero conservan su layout (grid + tarjeta fx)', async ({ page }) => {
    await withFakeServer(lobbyScenario, async () => {
      await login(page, 'e2e')
      await page.getByTestId('open-settings').click()
      await expect(page.getByTestId('settings-modal')).toBeVisible()

      await page.getByTestId('settings-nav-sound').click()
      const soundCard = page.getByTestId('settings-sound-card')
      await expect(soundCard).toBeVisible()
      const toggleBox = await soundCard.locator('.ui-toggle').first().boundingBox()
      expect(toggleBox?.width).toBeGreaterThanOrEqual(30)
      const labelBox = await soundCard.locator('.fx-popover-label').first().boundingBox()
      const hintBox = await soundCard.locator('.fx-popover-hint').first().boundingBox()
      expect(labelBox && hintBox && hintBox.y).toBeGreaterThan(labelBox.y)

      await page.getByTestId('settings-nav-board').click()
      const sleeveGrid = page.locator('.appearance-sleeve-grid').first()
      await expect(sleeveGrid).toBeVisible()
      await expect.poll(
        () => sleeveGrid.evaluate((el) => getComputedStyle(el).display),
        { timeout: 5000 },
      ).toBe('grid')
    })
  })

  // Measured, not inferred: the priority-cue row needs 636px of natural width and the
  // two-pane body used to leave 496px of it, so the segmented control was squeezed to
  // 158px while its three nowrap buttons kept measuring 299px and painted past the
  // panel edge. That happened at every window width, so the fix is the row layout
  // (wrap + `flex: none` on the control), not a wider dialog.
  test('sound rows never clip their control, at desktop and minimum window width', async ({ page }) => {
    await withFakeServer(lobbyScenario, async () => {
      await login(page, 'e2e')
      await page.getByTestId('open-settings').click()
      await page.getByTestId('settings-nav-sound').click()
      for (const width of [1280, 900]) {
        await page.setViewportSize({ width, height: 700 })
        const clipped = await page
          .getByTestId('settings-sound-card')
          .evaluate((card) => {
            const cls = (el: Element) =>
              typeof (el as HTMLElement).className === 'string' ? (el as HTMLElement).className : el.tagName
            const bad: string[] = []
            const walk = (el: Element) => {
              for (const child of Array.from(el.children)) {
                const squeezed = child.scrollWidth - child.clientWidth
                const painted = Math.round(child.getBoundingClientRect().right - el.getBoundingClientRect().right)
                if (squeezed > 1 || painted > 1) bad.push(`${cls(el)} > ${cls(child)}: ${Math.max(squeezed, painted)}px`)
                walk(child)
              }
            }
            walk(card)
            return bad
          })
        expect(clipped, `${width}px wide window`).toEqual([])
      }
    })
  })
})
