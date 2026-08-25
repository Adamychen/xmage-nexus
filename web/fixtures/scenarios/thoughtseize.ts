import type { Scenario } from '../fake'
import { makeBaseScenario } from '../fake'
import { makeGameView, makePlayer, makeCard } from '../../src/__fixtures__/gameViews'
import { GAME_ID, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_NAME, SIM_PLAYER_ID, TABLE_ID } from '../humanGameConstants'

/**
 * Escenario del FixtureServer para el descarte interactivo desde una mano
 * revelada (p.ej. Thoughtseize):
 *   - El oponente (SIM) tiene una mano conocida que se revela al humano
 *     (`revealed` + `opponentHands`).
 *   - El humano (controlador) recibe `GAME_CHOOSE_CARDS` con `cardsView1` = esa
 *     mano y elige UNA carta para que el oponente descarte.
 *   - Al enviar `sendPlayerUUID`, el escenario quita la carta de la mano
 *     revelada y decrementa `handCount`, y emite `GAME_UPDATE`.
 *
 * Esto valida de forma determinista (sin Java/stack) que el descarte desde
 * reveal es interactivo vía la grilla `CardGrid` ya cableada en T3a.
 */
export function thoughtseizeScenario(): Scenario {
  const simHand = {
    'opp-card-1': makeCard({ id: 'opp-card-1', name: 'Lightning Bolt', expansionSetCode: 'LEA', cardNumber: '161' }),
    'opp-card-2': makeCard({ id: 'opp-card-2', name: 'Counterspell', expansionSetCode: 'LEA', cardNumber: '52' }),
    'opp-card-3': makeCard({ id: 'opp-card-3', name: 'Serra Angel', expansionSetCode: 'LEA', cardNumber: '227' }),
  }

  const gameView = makeGameView({
    gameId: GAME_ID,
    turn: 3,
    phase: 'PRECOMBAT_MAIN',
    step: 'PRECOMBAT_MAIN',
    activePlayerId: HUMAN_PLAYER_ID,
    priorityPlayerId: HUMAN_PLAYER_ID,
    players: [
      makePlayer({
        playerId: HUMAN_PLAYER_ID,
        name: HUMAN_NAME,
        controlled: true,
        isHuman: true,
        life: 20,
        handCount: 2,
        battlefield: {},
      }),
      makePlayer({
        playerId: SIM_PLAYER_ID,
        name: SIM_NAME,
        controlled: false,
        isHuman: false,
        life: 20,
        handCount: 3,
        battlefield: {},
      }),
    ],
    myHand: {},
    opponentHands: { [SIM_PLAYER_ID]: simHand },
    revealed: [{ name: SIM_NAME, cards: simHand }],
    canPlayObjects: { objects: {} },
  })

  return makeBaseScenario({
    tableId: TABLE_ID,
    tableName: 'thoughtseize-test',
    gameId: GAME_ID,
    gameView,
    onStartMatch: (conn) => {
      conn.broadcast(
        'GAME_CHOOSE_CARDS',
        {
          message: 'Choose a card for them to discard',
          cardsView1: simHand,
          min: 1,
          max: 1,
          gameView,
        },
        GAME_ID,
      )
    },
    onSendPlayerUUID: (conn, uuid) => {
      const hand = gameView.opponentHands?.[SIM_PLAYER_ID]
      if (hand && hand[uuid]) {
        delete hand[uuid]
        const rev = gameView.revealed?.find((r) => r.name === SIM_NAME)
        if (rev?.cards && rev.cards[uuid]) delete rev.cards[uuid]
        const sim = gameView.players?.find((p) => p.playerId === SIM_PLAYER_ID)
        if (sim && (sim.handCount ?? 0) > 0) sim.handCount = sim.handCount - 1
      }
      conn.broadcast('GAME_UPDATE', { gameView }, GAME_ID)
    },
  })
}
