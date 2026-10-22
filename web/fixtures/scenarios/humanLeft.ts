import { TABLE } from '../table-names'
import { HumanGame } from './humanGame'

export function humanLeftScenario(): ReturnType<HumanGame['scenario']> {
  return new HumanGame({
    tableName: TABLE.humanLeft,
    lands: [{ name: 'Mountain', count: 7 }],
    hand: ['Mountain', 'Mountain', 'Mountain', 'Mountain'],
    playable: [],
    humanLeft: true,
  }).scenario()
}
