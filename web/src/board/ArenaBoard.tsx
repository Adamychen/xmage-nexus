import { Fragment, useMemo } from 'react'
import type { CardView, GameView } from '../net/types'
import OpponentZone from './OpponentZone'
import PlayerZone from './PlayerZone'
import BoardShell, { BoardColDivider, BoardDivider } from './BoardShell'
import { useBoardPresenter, useBoardPlayers } from './useBoardPresenter'
import { opponentRevealedCards, simpleToCardsView } from './revealedCards'
import type { CrossZonePlayable } from './crossZone'
import './ArenaBoard.css'

interface ArenaBoardProps {
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
}: ArenaBoardProps) {
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

  // Espectador: mismo convenio que GameBoard/pod — un jugador abajo (el último)
  // con su mano si es visible, y el resto arriba en columnas.
  const spectatorBottom = isSpectator ? (opps.length >= 2 ? opps[opps.length - 1] : opps[0]) : undefined
  const spectatorBottomHand = useMemo(() => {
    if (!isSpectator || !spectatorBottom) return {}
    const watched =
      game?.watchedHands?.[spectatorBottom.name] ||
      game?.watchedHands?.[spectatorBottom.playerId]
    const oppHand =
      game?.opponentHands?.[spectatorBottom.playerId] ||
      game?.opponentHands?.[spectatorBottom.name]
    if (watched) return simpleToCardsView(watched)
    if (oppHand) return simpleToCardsView(oppHand)
    return {}
  }, [isSpectator, spectatorBottom, game?.watchedHands, game?.opponentHands])

  const oppRow = useMemo(
    () => (isSpectator ? opps.slice(0, Math.max(0, opps.length - 1)).slice(0, 3) : opps.slice(0, 3)),
    [isSpectator, opps]
  )

  return (
    <BoardShell
      className="arena-board"
      testId="arena-board"
      presenter={presenter}
      handBar={!isSpectator ? {
        cards: game?.myHand ?? {},
        onCardClick: onPlayableClick,
        playableIds: playableIdSet,
        targetIds: targetIdSet,
      } : null}
    >
      <div className="arena-opp-row">
        {oppRow.map((opp, i) => (
          <Fragment key={opp?.playerId ?? `arena-empty-${i}`}>
            {i > 0 && <BoardColDivider />}
            <div className="arena-opp-cell">
              {opp && (
                <OpponentZone
                  player={opp}
                  onCardClick={onTargetClick}
                  onCardHover={handleCardHover}
                  targetIds={targetIdSet}
                  revealedCards={opponentRevealedCards(game, opp)}
                  attackingIds={attackingIds}
                  blockingIds={blockingIds}
                  compactPod
                />
              )}
            </div>
          </Fragment>
        ))}
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
