import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { dismissSetupWizard } from './support/start-game'
import { richCommanderGame, showGame } from './support/rich-game'

fakeOnly()

const V2 = { gameUi: 'v2', boardLayout: 'arena', boardLayoutManual: true }

test.use({ viewport: { width: 1280, height: 800 } })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await dismissSetupWizard(page)
  await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(300)
})

function card(id: string, name: string) {
  return { id, parentId: id, name, displayName: name, cardTypes: ['INSTANT'], manaValue: 1, expansionSetCode: '', cardNumber: '0', rules: [] }
}

test('v2 player card zone icons are large relative to the avatar and stay inside the card @gameui', async ({ page }, testInfo) => {
  const game = richCommanderGame() as { players: Array<Record<string, unknown>> }
  game.players[0].graveyard = { 'gy-1': card('gy-1', 'Lightning Bolt'), 'gy-2': card('gy-2', 'Counterspell') }
  game.players[0].exile = { 'ex-1': card('ex-1', 'Brainstorm') }
  await showGame(page, game, V2)
  const bar = page.locator('.pz-bottom-row .player-info-bar.is-portrait')
  await expect(bar).toBeVisible({ timeout: 10_000 })
  const icons = bar.locator('.pp-stats .resource-chip .chip-icon svg')
  await expect(icons).toHaveCount(3)
  await page.waitForTimeout(400)

  const avatar = await bar.locator('.player-avatar').boundingBox()
  const cardBox = await bar.boundingBox()
  expect(avatar).not.toBeNull()
  expect(cardBox).not.toBeNull()
  await page.screenshot({ path: testInfo.outputPath('v2-zone-icons.png') })

  for (let i = 0; i < 3; i++) {
    const icon = await icons.nth(i).boundingBox()
    expect(icon, `zone icon ${i} has a box`).not.toBeNull()
    expect(icon!.height, `zone icon ${i} height vs avatar`).toBeGreaterThanOrEqual(avatar!.height * 0.25)
    expect(icon!.x).toBeGreaterThanOrEqual(cardBox!.x)
    expect(icon!.y).toBeGreaterThanOrEqual(cardBox!.y)
    expect(icon!.x + icon!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width)
    expect(icon!.y + icon!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height)
  }
})
