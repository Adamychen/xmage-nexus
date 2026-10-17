import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { login } from './support/start-game'
import { makeBaseScenario } from '../fixtures/fake'
import { playerGameView } from '../src/__fixtures__/gameViews'

fakeOnly()

function lobbyScenario() {
  return makeBaseScenario({
    tableId: 'table-demo-1',
    tableName: 'picker-demos',
    gameId: 'game-demo-1',
    gameView: playerGameView,
  })
}

/** Every decorative `<img>` in scope must actually decode: local showcase art
 * is committed, so a 404 (renamed/missing file) must fail here, not silently. */
async function expectAllImagesLoaded(page: import('@playwright/test').Page, selector: string, minCount: number) {
  await expect
    .poll(
      async () =>
        page.evaluate((sel: string) => {
          const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(sel))
          return imgs.every((i) => i.complete && i.naturalWidth > 0) ? imgs.length : -1
        }, selector),
      { timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(minCount)
}

test.describe('Visual preset & playmat pickers', { tag: '@site' }, () => {
  test('gameplay presets and playmat tiles render with loaded local art', async ({ page }, testInfo) => {
    // Screenshots are diagnostics: Playwright's output dir, never a machine path.
    const shot = (name: string) => path.join(testInfo.outputPath(), name)
    await withFakeServer(lobbyScenario, async () => {
      await login(page, 'e2e')
      await page.getByTestId('open-settings').click()
      await page.getByTestId('settings-nav-gameplay').click()
      for (const id of ['simple', 'balanced', 'manual']) {
        await expect(page.getByTestId(`preset-demo-${id}`)).toBeVisible()
      }
      await expectAllImagesLoaded(page, '[data-testid^="preset-demo-"] .preset-tile-art', 13)
      await page.screenshot({ path: shot('picker-presets.png') })
      await page.getByTestId('settings-nav-board').click()
      await expectAllImagesLoaded(page, '.settings-content .playmat-item img.playmat-table-card', 20)
      await page.screenshot({ path: shot('picker-playmats.png') })
    })
  })

  test('board option pickers show a live miniature of each option', async ({ page }, testInfo) => {
    // Screenshots are diagnostics: keep them in Playwright's output dir (CI-safe),
    // never in a machine-specific absolute path.
    const shot = (name: string) => path.join(testInfo.outputPath(), name)
    await withFakeServer(lobbyScenario, async () => {
      await login(page, 'e2e')
      await page.getByTestId('open-settings').click()
      await page.getByTestId('settings-nav-board').click()
      const demo = (kind: string, value: string) => page.getByTestId(`board-demo-${kind}-${value}`)
      for (const [layout, zones] of [['standard', 2], ['pod', 4], ['arena', 4], ['table', 4]] as const) {
        const miniature = page.getByTestId(`layout-demo-${layout}`)
        await expect(miniature).toBeVisible()
        await expect(miniature.getByTestId('layout-demo-zone')).toHaveCount(zones)
        await expect(miniature.locator('.layout-demo-zone.is-mine')).toHaveCount(1)
      }
      await expectAllImagesLoaded(page, '[data-testid^="layout-demo-"] img.layout-demo-tile', 12)
      await page.getByTestId('settings-layout-table').scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath('layouts.png') })
      for (const [kind, values] of [
        ['cardStyle', ['classic', 'compact']],
        ['tapStyle', ['sideways', 'tilted']],
        ['ptBadge', ['always', 'changed', 'hidden']],
        ['sickness', ['badge', 'veil']],
      ] as const) {
        for (const value of values) await expect(demo(kind, value)).toBeVisible()
      }
      await expectAllImagesLoaded(page, '[data-testid^="board-demo-"] img.card-image', 20)

      for (const kind of ['handCost', 'manaSource', 'rendered', 'boardFill', 'handRail', 'handRow'] as const) {
        for (const state of ['on', 'off'] as const) {
          await expect(page.getByTestId(`option-choice-${kind}-${state}`).getByTestId(`option-preview-${kind}-${state}`)).toBeVisible()
        }
      }
      await expect(page.getByTestId('option-choice-manaSource-on').getByTestId('board-demo-manaSource-true')).toBeVisible()

      await expect(demo('cardStyle', 'compact').locator('.card-slot.is-compact')).toHaveCount(3)
      await expect(demo('cardStyle', 'classic').locator('.card-slot.is-compact')).toHaveCount(0)

      const rotation = (kind: string, value: string) =>
        demo(kind, value).locator('.card-slot.tapped').first().evaluate((el) => getComputedStyle(el).transform)
      expect(await rotation('tapStyle', 'sideways')).toBe('matrix(0, 1, -1, 0, 0, 0)')
      expect(await rotation('tapStyle', 'tilted')).not.toBe('matrix(0, 1, -1, 0, 0, 0)')

      await expect(demo('ptBadge', 'always').locator('.pt-badge')).toHaveCount(2)
      await expect(demo('ptBadge', 'changed').locator('.pt-badge')).toHaveCount(1)
      await expect(demo('ptBadge', 'hidden').locator('.pt-badge')).toHaveCount(0)

      await expect(demo('sickness', 'badge').locator('.sickness-badge')).toHaveCount(1)
      await expect(demo('sickness', 'badge').locator('.sickness-veil')).toHaveCount(0)
      await expect(demo('sickness', 'veil').locator('.sickness-veil')).toHaveCount(1)
      await expect(demo('sickness', 'veil').locator('.sickness-badge')).toHaveCount(0)

      await page.locator('.settings-content').screenshot({ path: shot('board-demos-top.png') })
      await demo('sickness', 'veil').scrollIntoViewIfNeeded()
      await page.locator('.settings-content').screenshot({ path: shot('board-demos-bottom.png') })
    })
  })
})
