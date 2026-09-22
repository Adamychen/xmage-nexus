import { Fragment, useMemo } from 'react'
import OpponentZone from './OpponentZone'
import PlayerZone from './PlayerZone'
import BoardShell, { BoardColDivider, BoardDivider } from './BoardShell'
import { useBoardPresenter, useBoardPlayers } from './useBoardPresenter'
import { opponentRevealedCards } from './revealedCards'
import { MAX_BOARD_PLAYERS, useSeatStates, useSpectatorBottomHand, useSwitchedHand, type BoardProps } from './boardShared'
import DefeatedSeat from './DefeatedSeat'
import './ArenaBoard.css'

export type { BoardProps as ArenaBoardProps }

/**
 * Layout "Arena" para multijugador (Commander 3-4): mi campo ocupa la mitad
 * inferior a ancho completo (cartas a escala normal, status row sin compactar)
 * y los rivales se reparten la mitad superior en columnas compactas espejadas.
 */
export default function ArenaBoard({
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

  // Espectador: mismo convenio que GameBoard/pod — un jugador abajo (el último)
  // con su mano si es visible, y el resto arriba en columnas.
  const spectatorBottom = isSpectator ? (opps.length >= 2 ? opps[opps.length - 1] : opps[0]) : undefined
  const spectatorBottomHand = useSpectatorBottomHand(game, isSpectator, spectatorBottom)
  const switchedHand = useSwitchedHand(game)
  const { seatState, toggleSeat } = useSeatStates()

  const oppRow = useMemo(
    () => (isSpectator ? opps.slice(0, Math.max(0, opps.length - 1)).slice(0, MAX_BOARD_PLAYERS - 1) : opps.slice(0, MAX_BOARD_PLAYERS - 1)),
    [isSpectator, opps]
  )

  return (
    <BoardShell
      className="arena-board"
      testId="arena-board"
      presenter={presenter}
      handBar={!isSpectator ? {
        cards: switchedHand ?? game?.myHand ?? {},
        onCardClick: onPlayableClick,
        onHover: (card, rect) => handleCardHover(card, rect, { fromHand: true }),
        playableIds: playableIdSet,
        targetIds: targetIdSet,
      } : null}
    >
      <div className="arena-opp-row">
        {oppRow.map((opp, i) => {
          const state = seatState(opp)
          const seat = opp && state !== 'alive' && (
            <DefeatedSeat player={opp} open={state === 'open'} onToggle={() => toggleSeat(opp.playerId)} />
          )
          return (
            <Fragment key={opp?.playerId ?? `arena-empty-${i}`}>
              {i > 0 && <BoardColDivider />}
              <div className={`arena-opp-cell${state === 'collapsed' ? ' seat-cell--out' : state === 'open' ? ' seat-cell--open' : ''}`}>
                {seat}
                {opp && state !== 'collapsed' && (
                  <OpponentZone
                    player={opp}
                    onCardClick={handleCardClick}
                    onCardHover={handleCardHover}
                    targetIds={targetIdSet}
                    revealedCards={opponentRevealedCards(game, opp)}
                    playableIds={playableIdSet}
                    combatSelectable={combatSelectable}
                    combatMode={combatMode}
                    combatChosen={combatChosen}
                    attackingIds={attackingIds}
                    blockingIds={blockingIds}
                    compactPod
                  />
                )}
              </div>
            </Fragment>
          )
        })}
      </div>

      <BoardDivider />

      <PlayerZone
        player={me ?? spectatorBottom}
        hand={me ? (game?.myHand ?? {}) : spectatorBottomHand}
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
        crossZonePlayables={isSpectator ? [] : crossZonePlayables}
        onPlayCrossZone={onPlayCrossZone}
        helperEmblems={game?.myHelperEmblems}
        showHand={isSpectator}
      />
    </BoardShell>
  )
}
