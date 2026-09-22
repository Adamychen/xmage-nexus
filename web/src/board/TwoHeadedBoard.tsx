import { useMemo } from 'react'
import type { PlayerView } from '../net/types'
import OpponentZone from './OpponentZone'
import PlayerZone from './PlayerZone'
import BoardShell, { BoardColDivider, BoardDivider } from './BoardShell'
import { useBoardPresenter, useBoardPlayers } from './useBoardPresenter'
import { useSeatStates, useSwitchedHand, type BoardProps } from './boardShared'
import DefeatedSeat from './DefeatedSeat'
import { opponentRevealedCards } from './revealedCards'
import './TwoHeadedBoard.css'

export type { BoardProps as TwoHeadedBoardProps }

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
}: BoardProps) {
  const { me, opps, isSpectator } = useBoardPlayers(game, true)
  const switchedHand = useSwitchedHand(game)
  const { seatState, toggleSeat } = useSeatStates()
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

  const seatCellClass = (player: PlayerView | undefined) => {
    const state = seatState(player)
    return state === 'collapsed' ? ' seat-cell--out' : state === 'open' ? ' seat-cell--open' : ''
  }

  const renderOpponent = (player: PlayerView, mirrored: boolean) => {
    const state = seatState(player)
    const seat = state !== 'alive' && (
      <DefeatedSeat player={player} open={state === 'open'} onToggle={() => toggleSeat(player.playerId)} />
    )
    if (state === 'collapsed') return seat
    return (
      <>
        {seat}
        <OpponentZone
          player={player}
          onCardClick={handleCardClick}
          onCardHover={handleCardHover}
          targetIds={targetIdSet}
          revealedCards={opponentRevealedCards(game, player)}
          playableIds={playableIdSet}
          combatSelectable={combatSelectable}
          combatMode={combatMode}
          combatChosen={combatChosen}
          attackingIds={attackingIds}
          blockingIds={blockingIds}
          mirrored={mirrored}
          compactPod
        />
      </>
    )
  }

  const oppSlot = (player: PlayerView | undefined, key: string, mirrored = false) => (
    <div className={`pod-cell${player ? '' : ' pod-cell--empty'}${seatCellClass(player)}`} key={key}>
      {player && renderOpponent(player, mirrored)}
    </div>
  )

  const rowIsOut = (cells: (PlayerView | undefined)[]) => {
    const present = cells.filter((c): c is PlayerView => !!c)
    return present.length > 0 && present.every((c) => seatState(c) === 'collapsed')
  }

  const isTopFull = !topLeft || !topRight
  const isBottomFull = !botRight
  const brOut = !!botRight && seatState(botRight) === 'collapsed'
  const shellClass = `pod-board${isBottomFull ? ' pod-board--bottom-full' : ''}${isTopFull ? ' pod-board--top-full' : ''}${brOut ? ' pod-board--br-out' : ''}`

  return (
    <BoardShell
      className={shellClass}
      presenter={presenter}
      handBar={!isSpectator ? {
        cards: switchedHand ?? game?.myHand ?? {},
        onCardClick: onPlayableClick,
        onHover: (card, rect) => handleCardHover(card, rect, { fromHand: true }),
        playableIds: playableIdSet,
        targetIds: targetIdSet,
      } : null}
    >
      {/* ── Top row ── */}
      <div className={`pod-row pod-row--top${rowIsOut([topLeft, topRight]) ? ' pod-row--out' : ''}`}>
        {oppSlot(topLeft, 'tl')}
        {topLeft && topRight && <BoardColDivider />}
        {oppSlot(topRight, 'tr')}
      </div>

      {/* ── Horizontal board divider ── */}
      <BoardDivider labels={isBottomFull} />

      {/* ── Bottom row ── */}
      <div className={`pod-row pod-row--bottom${rowIsOut([botLeft, botRight]) ? ' pod-row--out' : ''}`}>
        {/* Bottom-left: player or spectator-opp */}
        <div className={`pod-cell pod-cell--me${!isSpectator || botLeft ? '' : ' pod-cell--empty'}${isSpectator ? seatCellClass(botLeft) : ''}`}>
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
          ) : botLeft ? (
            renderOpponent(botLeft, true)
          ) : null}
        </div>

        {botRight && <BoardColDivider />}

        {/* Bottom-right: always an opponent (mirrored to face the center) */}
        {oppSlot(botRight, 'br', true)}
      </div>
    </BoardShell>
  )
}
