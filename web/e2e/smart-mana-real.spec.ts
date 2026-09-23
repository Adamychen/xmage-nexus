import { test, expect } from './fixtures'
import { FAKE_MODE } from './dual'
import { startGame } from './support/start-game'
import { framesOf, lastGameView, myBattlefield, opponentPlayer, parseFrames, parseSent, parsedLen, sentOf, waitFrame, waitOppLife } from './support/frames'
import { targetOpponent, waitPlayable } from './support/game-screen'
import { DECK } from '../fixtures/deck-names'

test.skip(FAKE_MODE, 'Real only: validates smart mana payment against the GAME_PLAY_MANA prompts the XMage engine actually sends.')

test.setTimeout(240_000)

test('smart mana payment pays a two-color spell without manual clicks (real engine)', { tag: '@smart-mana-real' }, async ({ page }) => {
  const { frames, pageErrors, helper } = await startGame(page, { prefix: 'sm', deck: DECK.advanced, simDeck: DECK.aiLands })
  await page.evaluate(() => {
    const store = (globalThis as any).__mageStore
    store.setSetting('manaPayment', { ...store.getState().settings.manaPayment, smart: true })
  })

  const borosId = await waitPlayable(page, 'Boros Charm', { timeoutMs: 60_000, minUntapped: 2, needPlains: true })
  if (!borosId) throw new Error('Boros Charm was not castable in 60s (no untapped Mountain + Plains)')

  const cursor = parsedLen(page)
  const sentBefore = sentOf(page).length
  expect(await helper.playCard(borosId), 'Boros Charm should be cast over WS').toBeTruthy()
  await waitFrame(page, (f) => f.method === 'GAME_CHOOSE_ABILITY', 'GAME_CHOOSE_ABILITY for the Boros Charm mode', 15_000, cursor)
  const modeButton = page.locator('.feedback-dialog .feedback-options').getByRole('button', { name: /4 damage|4 daño|deals 4/i }).first()
  await expect(modeButton, 'Boros Charm "4 damage" mode').toBeVisible({ timeout: 15_000 })
  await modeButton.click()
  const target = await waitFrame(
    page,
    (f) => f.method === 'GAME_TARGET' && !/discard/i.test(String(f.data?.message ?? '')),
    'GAME_TARGET for Boros Charm',
    15_000,
    cursor,
  )
  const lifeBefore = opponentPlayer(lastGameView(parseFrames(framesOf(page))))?.life ?? 20
  await targetOpponent(page, target, 'Boros Charm target', helper)

  await waitOppLife(page, lifeBefore - 4, 'Boros Charm resolved without manual mana clicks', 30_000)

  const view = lastGameView(parseFrames(framesOf(page)))
  const battlefield = myBattlefield(view)
  const tapped = parseSent(sentOf(page).slice(sentBefore))
    .filter((f) => f.action === 'sendPlayerUUID')
    .map((f) => battlefield[String(f.args?.value)]?.name)
  expect(tapped.sort(), 'the client itself should have tapped exactly one Mountain and one Plains').toEqual(['Mountain', 'Plains'])
  expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  await test.info().attach('ws-frames', { body: frames.map((f) => JSON.stringify(f)).join('\n'), contentType: 'text/plain' })
})
