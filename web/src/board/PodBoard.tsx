import { useMemo } from 'react'
import type { GameView } from '../net/types'
import TwoHeadedBoard from './TwoHeadedBoard'
import { MAX_BOARD_PLAYERS, type BoardProps } from './boardShared'
import './PodBoard.css'

export type { BoardProps as PodBoardProps }

export default function PodBoard({
  game,
  targetIds = [],
  chosenTargetIds = [],
  onTargetClick,
  playableIds = [],
  onPlayableClick,
  onCardHover,
  combatSelectable = [],
  combatMode = null,
  combatChosen = [],
  onCombatClick,
  attackingIds = [],
  blockingIds = [],
  crossZonePlayables = [],
  onPlayCrossZone,
}: BoardProps) {
  const allPlayers = useMemo(() => (game?.players ?? []).slice(0, MAX_BOARD_PLAYERS), [game?.players])

  const clampedGame = useMemo(() => {
    if (!game) return null
    if ((game.players?.length ?? 0) <= MAX_BOARD_PLAYERS) return game
    return { ...game, players: allPlayers } as GameView
  }, [game, allPlayers])

  return (
    <div className="pod-board-wrapper" data-testid="pod-board">
      <div className="pod-board-main" data-testid="pod-board-main">
        <TwoHeadedBoard
          game={clampedGame}
          targetIds={targetIds}
          chosenTargetIds={chosenTargetIds}
          onTargetClick={onTargetClick}
          playableIds={playableIds}
          onPlayableClick={onPlayableClick}
          onCardHover={onCardHover}
          combatSelectable={combatSelectable}
          combatMode={combatMode}
          combatChosen={combatChosen}
          onCombatClick={onCombatClick}
          attackingIds={attackingIds}
          blockingIds={blockingIds}
          crossZonePlayables={crossZonePlayables}
          onPlayCrossZone={onPlayCrossZone}
        />
      </div>
    </div>
  )
}
