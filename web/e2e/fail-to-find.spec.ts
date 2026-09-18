import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { waitPlayable } from './support/game-screen'
import { lastGameView, myHandEntries, parseFrames, parseSent, sentOf, targetIdsOf, waitFrame } from './support/frames'
import { HumanGame } from '../fixtures/scenarios/humanGame'

fakeOnly()

const SEARCH_TARGETS = ['lib-1', 'lib-2', 'lib-3']
const TABLE_NAME = 'fail-to-find-test'

function failToFindScenario() {
  const game = new HumanGame({
    tableName: TABLE_NAME,
    lands: [{ name: 'Mountain', count: 2 }],
    hand: ['Evolving Wilds', 'Mountain', 'Mountain'],
    playable: ['Evolving Wilds'],
    cast: [
      { type: 'target', message: 'Search your library for a basic land card', targets: SEARCH_TARGETS, required: false },
      { type: 'mana', message: 'Pay {1}', sources: 1 },
    ],
  })
  return game.scenario()
}

test.describe('Fail to find (búsqueda declinable)', { tag: '@failtofind' }, () => {
  test('flag:false ofrece Terminar y declinar no mueve cartas ni cambia la biblioteca', async ({ page }) => {
    await withFakeServer(failToFindScenario, async () => {
      const { frames, pageErrors, helper } = await startGame(page, {
        prefix: 'ftf',
        tableName: TABLE_NAME,
      })

      const wildsId = await waitPlayable(page, 'Evolving Wilds', { timeoutMs: 30_000 })
      if (!wildsId) throw new Error('Evolving Wilds no fue jugable en 30s')
      expect(await helper.playCard(wildsId), 'lanzar Evolving Wilds por WS').toBeTruthy()

      const target = await waitFrame(
        page,
        (f) => f.method === 'GAME_TARGET' && f.data?.flag === false,
        'GAME_TARGET de búsqueda con flag:false',
      )
      expect(targetIdsOf(target), 'la búsqueda debe listar possibleTargets').toEqual(SEARCH_TARGETS)

      const libraryChip = page.locator('.resource-bar.my [data-library-count]')
      await expect(libraryChip).toBeVisible()
      const libraryBefore = await libraryChip.getAttribute('data-library-count')
      expect(Number(libraryBefore), 'la biblioteca debe tener cartas antes de declinar').toBeGreaterThan(0)
      const handBefore = myHandEntries(lastGameView(parseFrames(frames))).map(([, card]) => card.name)

      const bar = page.locator('.targeting-bar')
      await expect(bar).toBeVisible({ timeout: 15_000 })
      const finish = bar.locator('.action-prompt-actions').getByRole('button', { name: /Terminar|Finish/ })
      await expect(finish).toBeVisible()
      const declinesBefore = parseSent(sentOf(page)).filter((s) => s.action === 'sendPlayerBoolean' && s.args?.value === false).length
      await finish.click()

      await expect
        .poll(
          () => parseSent(sentOf(page)).filter((s) => s.action === 'sendPlayerBoolean' && s.args?.value === false).length,
          { timeout: 10_000 },
        )
        .toBeGreaterThan(declinesBefore)

      await waitFrame(page, (f) => f.method === 'GAME_PLAY_MANA', 'siguiente paso del cast tras declinar', 10_000)
      await expect(bar).toBeHidden({ timeout: 10_000 })

      await expect.poll(() => libraryChip.getAttribute('data-library-count'), { timeout: 10_000 }).toBe(libraryBefore)
      const handAfter = myHandEntries(lastGameView(parseFrames(frames))).map(([, card]) => card.name)
      expect(handAfter.filter((name) => !handBefore.includes(name)), 'declinar no debe añadir cartas a la mano').toEqual([])
      expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
    })
  })
})
