import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { quickStartGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { replayRecordedScenario } from '../fixtures/scenarios/replay-recorded'
fakeOnly()

// The rank badges in the game HUD read the per-player ratings that travel in
// PlayerView.userData — these two specs replay REAL recorded frames (both
// players have ratings there), so they pin the whole channel: wire → helper →
// badge. A game view without userData must paint no badge (no fake 1500).
test.describe('Rank HUD', { tag: '@board' }, () => {
  test('1v1 standard board shows the badge on both bars', async ({ page }) => {
    await withFakeServer(() => replayRecordedScenario('aura.json', 'Rank 1v1'), async () => {
      const { pageErrors } = await quickStartGame(page, { prefix: 'rank1v1' })
      expect(pageErrors).toEqual([])
      await expect(page.locator('.player-info-bar .rank-badge')).toHaveCount(2, { timeout: 10_000 })
    })
  })

  test('pod FFA shows one compact badge per player bar', async ({ page }) => {
    await withFakeServer(() => replayRecordedScenario('commander-4.json', 'Rank Pod'), async () => {
      const { pageErrors } = await quickStartGame(page, { prefix: 'rankpod' })
      expect(pageErrors).toEqual([])
      await expect(page.locator('.player-info-bar .rank-badge')).toHaveCount(4, { timeout: 10_000 })
    })
  })
})
