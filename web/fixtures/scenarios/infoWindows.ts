import { makeBaseScenario } from '../fake'
import { TABLE } from '../table-names'
import { makeCard, makeGameView, makePermanent, makePlayer } from '../../src/__fixtures__/gameViews'

/**
 * Escenario estático para los visores looked-at / companion (G12-2, U12):
 * el GAME_INIT trae una entrada en `lookedAt` y otra en `companion`.
 * Las acciones del menú de jugador se verifican por frame WS enviado.
 */
export function infoWindowsScenario(): ReturnType<typeof makeBaseScenario> {
  return makeBaseScenario({
    tableId: 't-info-windows',
    tableName: TABLE.infoWindows,
    gameId: 'g-info-windows',
    getGameView: () =>
      makeGameView({
        players: [
          makePlayer({
            playerId: 'p1',
            name: 'Alice',
            controlled: true,
            handCount: 0,
            battlefield: {
              'ph-1': makePermanent({ name: 'Phased Out Guy', parentId: 'ph-1', phasedIn: false }),
              'ok-1': makePermanent({ name: 'Steady Guy', parentId: 'ok-1' }),
            },
          }),
          makePlayer({ playerId: 'p2', name: 'Bob', handCount: 0 }),
        ],
        lookedAt: [
          { name: 'Alice', cards: { 'l-1': makeCard({ name: 'Scry Card', parentId: 'l-1' }) } },
        ],
        companion: [
          { name: 'Bob', cards: { 'c-1': makeCard({ name: 'Lurrus of the Dream-Den', parentId: 'c-1' }) } },
        ],
      }),
  })
}
