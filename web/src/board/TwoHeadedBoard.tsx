import { useMemo } from 'react'
import type { CardView, GameView, PlayerView } from '../net/types'
import OpponentZone from './OpponentZone'
import PlayerZone from './PlayerZone'
import BoardShell, { BoardColDivider, BoardDivider } from './BoardShell'
import { useBoardPresenter, useBoardPlayers } from './useBoardPresenter'
import { opponentRevealedCards } from './revealedCards'
import type { CrossZonePlayable } from './crossZone'
import './TwoHeadedBoard.css'

interface TwoHeadedBoardProps {
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

export default function TwoHeadedBoard({
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
}: TwoHeadedBoardProps) {
  const { me, opps, isSpectator } = useBoardPlayers(game)
  const presenter = useBoardPresenter({
    game,
    targetIds,
    chosenTargetIds,
    playableIds,
    combatSelectable,
    combatMode,
    combatChosen,
    crossZonePlayables,
    onTargetClick,
    onPlayableClick,
    onCombatClick,
    onCardHover,
  })
  const { handleCardHover, handleCardClick, targetIdSet, playableIdSet } = presenter

  /**
   * Pod layout — always a 2×2 grid:
   *
   * [topLeft]  [topRight]
   * [botLeft]  [botRight]
   *
   * For a player: botLeft = me, rest = opponents (sorted by index).
   * For a spectator: all 4 cells are opponents in order.
   *
   * With fewer than 4 players some cells are undefined → rendered as empty.
   */
  const [topLeft, topRight, botLeft, botRight] = useMemo((): (PlayerView | undefined)[] => {
    if (isSpectator) {
      return [opps[0], opps[1], opps[2], opps[3]]
    }
    // Player layout: top row = first 2 opponents, bottom-left = me, bottom-right = 3rd opponent
    return [opps[0], opps[1], me, opps[2]]
  }, [isSpectator, me, opps])

  const oppSlot = (player: PlayerView | undefined, key: string, mirrored = false) => (
    <div className="pod-cell" key={key}>
      <OpponentZone
        player={player}
        onCardClick={onTargetClick}
        onCardHover={handleCardHover}
        targetIds={targetIdSet}
        revealedCards={opponentRevealedCards(game, player)}
        attackingIds={attackingIds}
        blockingIds={blockingIds}
        mirrored={mirrored}
        compactPod
      />
    </div>
  )

  return (
    <BoardShell
      className="pod-board"
      presenter={presenter}
      handBar={!isSpectator ? {
        cards: game?.myHand ?? {},
        onCardClick: onPlayableClick,
        playableIds: playableIdSet,
        targetIds: targetIdSet,
      } : null}
    >
      {/* ── Top row ── */}
      <div className="pod-row pod-row--top">
        {oppSlot(topLeft, 'tl')}
        <BoardColDivider />
        {oppSlot(topRight, 'tr')}
      </div>

      {/* ── Horizontal board divider ── */}
      <BoardDivider labels />

      {/* ── Bottom row ── */}
      <div className="pod-row pod-row--bottom">
        {/* Bottom-left: player or spectator-opp */}
        <div className="pod-cell pod-cell--me">
          {!isSpectator && botLeft === me ? (
            <PlayerZone
              player={me}
              hand={game?.myHand ?? {}}
              onCardClick={handleCardClick}
              onHandCardClick={onPlayableClick}
              onCardHover={handleCardHover}
              targetIds={targetIdSet}
              playableIds={playableIdSet}
              combatSelectable={combatSelectable}
              combatMode={combatMode}
              combatChosen={combatChosen}
              attackingIds={attackingIds}
              blockingIds={blockingIds}
              crossZonePlayables={crossZonePlayables}
              onPlayCrossZone={onPlayCrossZone}
              helperEmblems={game?.myHelperEmblems}
              compactPod
              showHand={false}
            />
          ) : (
            <OpponentZone
              player={botLeft as PlayerView | undefined}
              onCardClick={onTargetClick}
              onCardHover={handleCardHover}
              targetIds={targetIdSet}
              revealedCards={opponentRevealedCards(game, botLeft as PlayerView | undefined)}
              attackingIds={attackingIds}
              blockingIds={blockingIds}
              mirrored
              compactPod
            />
          )}
        </div>

        <BoardColDivider />

        {/* Bottom-right: always an opponent (mirrored to face the center) */}
        {oppSlot(botRight, 'br', true)}
      </div>
    </BoardShell>
  )
}
