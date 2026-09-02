import { useMemo } from 'react'
import type { CardView, GameView } from '../net/types'
import OpponentZone from './OpponentZone'
import PlayerZone from './PlayerZone'
import BoardShell, { BoardDivider } from './BoardShell'
import { useBoardPresenter, useBoardPlayers } from './useBoardPresenter'
import { opponentRevealedCards, simpleToCardsView } from './revealedCards'
import type { CrossZonePlayable } from './crossZone'
import './GameBoard.css'

interface GameBoardProps {
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
  focusedOpponentId?: string
}

export default function GameBoard({
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
  focusedOpponentId,
}: GameBoardProps) {
  const { allPlayers } = useBoardPlayers(game, true)
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

  const me = allPlayers.find((p) => p.controlled)
  const opps = allPlayers.filter((p) => !p.controlled)
  const isSpectator = !me
  const oppBottom = isSpectator ? (opps.length >= 2 ? opps[opps.length - 1] : opps[0]) : undefined
  const topOpps = isSpectator ? (opps.length >= 2 ? opps.slice(0, opps.length - 1) : []) : opps

  /** Bottom player hand in spectator mode (revealed or viewed). */
  const spectatorBottomHand = useMemo(() => {
    if (!isSpectator || !oppBottom) return {}
    const watched =
      game?.watchedHands?.[oppBottom.name] ||
      game?.watchedHands?.[oppBottom.playerId]
    const oppHand =
      game?.opponentHands?.[oppBottom.playerId] ||
      game?.opponentHands?.[oppBottom.name]
    if (watched) return simpleToCardsView(watched)
    if (oppHand) return simpleToCardsView(oppHand)
    return {}
  }, [isSpectator, oppBottom, game?.watchedHands, game?.opponentHands])

  const currentOpp = useMemo(() => {
    if (topOpps.length <= 1) return topOpps[0]
    if (focusedOpponentId) {
      const found = topOpps.find((p) => p.playerId === focusedOpponentId)
      if (found) return found
    }
    const activeOpp = topOpps.find((p) => p.playerId === game?.activePlayerId)
    if (activeOpp) return activeOpp
    return topOpps[0]
  }, [topOpps, focusedOpponentId, game?.activePlayerId])

  return (
    <BoardShell
      className="game-board"
      testId="game-board"
      presenter={presenter}
      handBar={!isSpectator ? {
        cards: game?.myHand ?? {},
        onCardClick: onPlayableClick,
        playableIds: playableIdSet,
        targetIds: targetIdSet,
      } : null}
    >
      <OpponentZone
        key={currentOpp?.playerId}
        player={currentOpp}
        onCardClick={onTargetClick}
        onCardHover={handleCardHover}
        targetIds={targetIdSet}
        revealedCards={opponentRevealedCards(game, currentOpp)}
        attackingIds={attackingIds}
        blockingIds={blockingIds}
      />
      <BoardDivider />
      <PlayerZone
        player={isSpectator ? oppBottom : me}
        hand={isSpectator ? spectatorBottomHand : (game?.myHand ?? {})}
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
