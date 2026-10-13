import { setSetting } from '../state/store'
import type { BoardLayoutPref } from '../state/persistence'
import type { GameUi } from '../game/gameUi'

export type BoardLayoutChoice = BoardLayoutPref | 'table'

/** "Table" is the v2 interface: its own board (arena geometry) plus the v2 chrome. It sits in
 *  the layout picker beside Standard, Pod and Arena, but is stored as `gameUi: 'v2'`. */
export function boardLayoutChoiceOf(settings: { boardLayout: BoardLayoutPref; gameUi: GameUi }): BoardLayoutChoice {
  return settings.gameUi === 'v2' ? 'table' : settings.boardLayout
}

export function chooseBoardLayout(choice: BoardLayoutChoice): void {
  if (choice === 'table') {
    setSetting('gameUi', 'v2')
    return
  }
  setSetting('gameUi', 'v1')
  setSetting('boardLayout', choice)
}
