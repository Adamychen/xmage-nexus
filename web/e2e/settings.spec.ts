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
  test('SET-4: opens from the header at gameplay, with an icon per section, and steps the zoom', async ({ page }) => {
    await withFakeServer(lobbyScenario, async () => {
      await login(page, 'e2e')
      await page.getByTestId('open-settings').click()
      await expect(page.getByTestId('settings-modal')).toBeVisible()
      await expect(page.getByTestId('settings-section-gameplay')).toBeVisible()
      await expect(page.locator('.settings-nav .settings-nav-icon svg')).toHaveCount(5)
      await expect(page.getByTestId('settings-nav-gameplay')).toHaveAttribute('aria-current', 'page')
      await expect(page.locator('.dlg-kicker')).toHaveCount(0)
      await expect(page.getByTestId('settings-review-setup')).toBeVisible()
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

  test('the panel stays inside a small window at a high UI zoom', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 })
    await withFakeServer(lobbyScenario, async () => {
      await login(page, 'e2e')
      await page.getByTestId('open-settings').click()
      await expect(page.getByTestId('settings-modal')).toBeVisible()
      await page.getByTestId('settings-nav-interface').click()
      await page.getByTestId('settings-zoom-plus').click()
      await page.getByTestId('settings-zoom-plus').click()
      await expect(page.getByTestId('settings-zoom-current')).toHaveText('130%')
      const box = await page.getByTestId('settings-modal').boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(900 + 1)
    })
  })

  test('SET-5: sound rows keep the hint under the label and the board sleeves are a grid', async ({ page }) => {
    await withFakeServer(lobbyScenario, async () => {
      await login(page, 'e2e')
      await page.getByTestId('open-settings').click()
      await expect(page.getByTestId('settings-modal')).toBeVisible()

      await page.getByTestId('settings-nav-sound').click()
      const soundCard = page.getByTestId('settings-sound-card')
      await expect(soundCard).toBeVisible()
      const toggleBox = await soundCard.locator('.ui-toggle').first().boundingBox()
      expect(toggleBox?.width).toBeGreaterThanOrEqual(30)
      const { labelY, hintY } = await soundCard.evaluate((el) => ({
        labelY: el.querySelector('.settings-row-label')!.getBoundingClientRect().y,
        hintY: el.querySelector('.settings-row-hint')!.getBoundingClientRect().y,
      }))
      expect(hintY).toBeGreaterThan(labelY)

      await page.getByTestId('settings-nav-board').click()
      await page.getByTestId('settings-board-tab-table').click()
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

  test('SET-6: search finds a board setting by name and "Go" opens its tab with the setting in view', async ({ page }) => {
    await withFakeServer(lobbyScenario, async () => {
      await login(page, 'e2e')
      await page.getByTestId('open-settings').click()
      await page.getByTestId('settings-search').fill('ENFERMEDAD')
      await expect(page.getByTestId('settings-search-results')).toBeVisible()
      await expect(page.getByTestId('settings-hit-sickness-style')).toContainText('Tablero')
      await page.getByTestId('settings-go-sickness-style').click()
      await expect(page.getByTestId('settings-section-board')).toBeVisible()
      await expect(page.getByTestId('settings-board-tab-overlays')).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('[data-setting="sickness-style"]')).toBeInViewport()
      await page.getByTestId('settings-search').fill('zzqqxx')
      await expect(page.getByTestId('settings-search-none')).toBeVisible()
    })
  })

  test('SET-7: the live preview follows a board choice as soon as it is made', async ({ page }) => {
    await withFakeServer(lobbyScenario, async () => {
      await login(page, 'e2e')
      await page.getByTestId('open-settings').click()
      await page.getByTestId('settings-nav-board').click()
      await page.getByTestId('settings-board-tab-cards').click()
      const stage = page.getByTestId('board-live-preview').locator('.board-live-stage')
      await expect(stage).toBeVisible()
      await page.getByTestId('settings-card-style-compact').click()
      await expect(stage).toHaveClass(/card-style-compact/)
      await page.getByTestId('settings-card-style-classic').click()
      await expect(stage).not.toHaveClass(/card-style-compact/)
      await page.getByTestId('settings-board-tab-overlays').click()
      await page.getByTestId('settings-sickness-style-veil').click()
      await expect(stage.locator('.sickness-veil')).toHaveCount(1)
      await page.getByTestId('settings-sickness-style-badge').click()
      await expect(stage.locator('.sickness-veil')).toHaveCount(0)
    })
  })

  test('SET-9: on a phone the dialog fills the screen, lists the sections and drills into one', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await withFakeServer(lobbyScenario, async () => {
      await login(page, 'e2e')
      await page.getByTestId('open-settings').click()
      const modal = page.getByTestId('settings-modal')
      await expect(modal).toBeVisible()
      // Polled: the dialog opens with a short scale-in, so the first box can be 4% small.
      await expect.poll(async () => (await modal.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(389)
      await expect.poll(async () => (await modal.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(843)
      await expect(page.getByTestId('settings-nav-language').locator('.settings-nav-value')).toBeVisible()
      await expect(page.locator('.settings-content')).toBeHidden()
      await page.getByTestId('settings-nav-sound').click()
      await expect(page.getByTestId('settings-section-sound')).toBeVisible()
      await expect(page.getByTestId('settings-nav-sound')).toBeHidden()
      await page.getByTestId('settings-back').click()
      await expect(page.getByTestId('settings-nav-sound')).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  })
})
