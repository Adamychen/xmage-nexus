import { TABLE } from '../table-names'
import { HumanGame, SIM_PLAYER_ID } from './humanGame'

export function bestOf3Scenario() {
  const game = new HumanGame({
    tableName: TABLE.bestOf3,
    lands: [{ name: 'Mountain', count: 7 }],
    hand: ['Lightning Bolt', 'Lightning Bolt', 'Lightning Bolt', 'Lightning Bolt', 'Mountain', 'Mountain', 'Mountain', 'Mountain'],
    playable: ['Lightning Bolt'],
    cast: [
      { type: 'target', message: 'Select any target', targets: [SIM_PLAYER_ID] },
      { type: 'mana', message: 'Pay {R}', sources: 1 },
    ],
    damageToSim: 3,
    match: { winsNeeded: 2 },
    simWinsGame: [2],
  })
  return game.scenario()
}