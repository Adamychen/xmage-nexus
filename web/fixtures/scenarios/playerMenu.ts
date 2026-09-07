import { TABLE } from '../table-names'
import { HumanGame } from './humanGame'

/**
 * Escenario mínimo para el menú de jugador (clic derecho en PlayerInfoBar):
 * partida humano + sim sin prompts especiales. Las acciones del menú
 * (REQUEST_PERMISSION_TO_SEE_HAND_CARDS, VIEW_SIDEBOARD…) se verifican
 * por el frame WS enviado, sin necesidad de respuesta del servidor.
 */
export function playerMenuScenario(): ReturnType<HumanGame['scenario']> {
  const game = new HumanGame({
    tableName: TABLE.playerMenu,
    lands: [{ name: 'Mountain', count: 7 }],
    hand: ['Mountain', 'Mountain', 'Mountain', 'Mountain'],
    playable: [],
  })
  return game.scenario()
}
