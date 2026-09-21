import { DECK } from '../fixtures/deck-names'
import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { startGame } from './support/start-game'
import { openDrawerTab } from './support/game-screen'
import { replayRecordedScenario, REPLAY_TABLE_NAME } from '../fixtures/scenarios/replay-recorded'

/**
 * plan4 §3.4 (objetivo ilegal al resolver): el aviso real del motor
 * (`Spell.java`: `"<carta> has been fizzled."`) viaja al cliente como
 * CHATMESSAGE de tipo GAME (GameController INFO → chatManager.broadcast) y el
 * feed debe pintarlo localizado, no como texto crudo en inglés.
 *
 * El frame real `illegal-target.json` fija el ESTADO de la partida (Bolt sin
 * objetivo legal ya en el cementerio); el escenario emite encima el mismo
 * CHATMESSAGE que manda el servidor cuando eso ocurre.
 */
fakeOnly()
test.describe('Fizzle feed (aviso real del motor)', { tag: '@recorded' }, () => {
  test('"Lightning Bolt has been fizzled." se pinta localizado', async ({ page }) => {
    await withFakeServer(
      () =>
        replayRecordedScenario('illegal-target.json', REPLAY_TABLE_NAME, {
          onStartMatch: (conn, gameId) => {
            conn.broadcast(
              'CHATMESSAGE',
              {
                chatId: `game-chat-${gameId}`,
                username: '',
                message: 'Lightning Bolt has been fizzled.',
                messageType: 'GAME',
                time: Date.now(),
              },
              gameId,
            )
          },
        }),
      async () => {
        const { pageErrors } = await startGame(page, {
          prefix: 'fizzle',
          tableName: REPLAY_TABLE_NAME,
          deck: DECK.advanced,
        })

        await openDrawerTab(page, 'log')
        const feed = page.locator('.action-feed-list')
        await expect(feed).toBeVisible({ timeout: 15_000 })
        await expect(feed).toContainText(
          'Lightning Bolt se retira de la pila sin efecto (sin objetivos legales)',
          { timeout: 15_000 },
        )

        expect(pageErrors).toEqual([])
      },
    )
  })
})
