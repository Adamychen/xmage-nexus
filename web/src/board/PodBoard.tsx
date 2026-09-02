import { useMemo } from 'react'
import type { CardView, GameView } from '../net/types'
import TwoHeadedBoard from './TwoHeadedBoard'
import type { CrossZonePlayable } from './crossZone'
import './PodBoard.css'

const MAX_POD_PLAYERS = 4

interface PodBoardProps {
  game: GameView | null
  targetIds?: string[]
  chosenTargetIds?: string[]
  onTargetClick?: (id: string) => void
  playableIds?: string[]
  onPlayableClick?: (id: string) => void
  onCardHover?: (card: CardView | null) => void
  combatSelectable?: string[]
  combatMode?: 'attack' | 'block' | null
  combatChosen?: string[]
  onCombatClick?: (id: string) => void
  attackingIds?: string[]
  blockingIds?: string[]
  crossZonePlayables?: CrossZonePlayable[]
  onPlayCrossZone?: (id: string) => void
}

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
}: PodBoardProps) {
  const allPlayers = useMemo(() => (game?.players ?? []).slice(0, MAX_POD_PLAYERS), [game?.players])

  const clampedGame = useMemo(() => {
    if (!game) return null
    if ((game.players?.length ?? 0) <= MAX_POD_PLAYERS) return game
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
