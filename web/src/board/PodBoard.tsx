import { useMemo } from 'react'
import type { CardView, GameView } from '../net/types'
import TwoHeadedBoard from './TwoHeadedBoard'
import TurnOrderRing from './TurnOrderRing'
import CommanderDamageMatrix from '../game/CommanderDamageMatrix'
import type { CrossZonePlayable } from './crossZone'
import { parseCommandList } from './CommandZone'
import './PodBoard.css'

const MAX_POD_PLAYERS = 4

interface PodBoardProps {
  game: GameView | null
  targetIds?: string[]
  chosenTargetIds?: string[]
  onTargetClick?: (id: string) => void
  targetSourceId?: string
  playableIds?: string[]
  onPlayableClick?: (id: string) => void
  onCardHover?: (card: CardView | null) => void
  combatSelectable?: string[]
  combatMode?: 'attack' | 'block' | null
  combatChosen?: string[]
  onCombatClick?: (id: string) => void
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
  crossZonePlayables = [],
  onPlayCrossZone,
}: PodBoardProps) {
  const allPlayers = useMemo(() => (game?.players ?? []).slice(0, MAX_POD_PLAYERS), [game?.players])

  const clampedGame = useMemo(() => {
    if (!game) return null
    if ((game.players?.length ?? 0) <= MAX_POD_PLAYERS) return game
    return { ...game, players: allPlayers } as GameView
  }, [game, allPlayers])

  const hasCommanders = useMemo(() => {
    return allPlayers.some((p) => {
      const items = parseCommandList(p.commandList as unknown[], (p.helperCards ?? {}) as Record<string, CardView>)
      return items.some((i) => i.isCommander)
    })
  }, [allPlayers])

  const isSpectator = useMemo(() => {
    if (!allPlayers.length) return false
    return !allPlayers.some((p) => p.controlled)
  }, [allPlayers])

  const activePlayerId = game?.activePlayerId ?? ''

  return (
    <div className={`pod-board-wrapper ${isSpectator ? 'is-spectator' : 'is-player'} ${hasCommanders ? 'has-commanders' : ''}`} data-testid="pod-board">
      <div className="pod-ring-bar" data-testid="pod-ring-bar">
        <TurnOrderRing players={allPlayers} activePlayerId={activePlayerId} />
      </div>

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
          crossZonePlayables={crossZonePlayables}
          onPlayCrossZone={onPlayCrossZone}
        />
      </div>

      {hasCommanders && (
        <div className="pod-damage-overlay" data-testid="pod-damage-overlay">
          <CommanderDamageMatrix game={clampedGame} />
        </div>
      )}
    </div>
  )
}
