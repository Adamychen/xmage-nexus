import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CardView, GameView, PermanentView, PlayerView } from '../net/types'
import OpponentZone from './OpponentZone'
import PlayerZone from './PlayerZone'
import HandBar, { type HandBarOrigin } from './HandBar'
import FloatingCardPreview from './FloatingCardPreview'
import FlyingCardOverlay from './FlyingCardOverlay'
import { revealedCards } from './TwoHeadedBoard'
import { useSceneBridge } from './sceneBridge'
import { useGameTransitions } from './gameTransitionEngine'
import type { CrossZonePlayable } from './crossZone'
import { useStore, isBlockingModal } from '../state/store'
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
  const allPlayers = useMemo((): PlayerView[] => game?.players ?? [], [game?.players])
  const me = allPlayers.find((p) => p.controlled)
  const opps = allPlayers.filter((p) => !p.controlled)
  const isSpectator = !me

  const targetIdSet = useMemo(() => new Set(targetIds), [targetIds])
  const playableIdSet = useMemo(() => new Set(playableIds), [playableIds])

  const boardRef = useRef<HTMLDivElement>(null)
  const [floatingCard, setFloatingCard] = useState<CardView | PermanentView | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [anchorInHandBar, setAnchorInHandBar] = useState(false)
  const hoverTimeoutRef = useRef<number | null>(null)

  const modalOpen = useStore(isBlockingModal)
  useEffect(() => {
    if (modalOpen) {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = null
      }
      setFloatingCard(null)
      setAnchorRect(null)
      setAnchorInHandBar(false)
    }
  }, [modalOpen])

  const handleCardHover = useCallback(
    (card: CardView | PermanentView | null, rect?: DOMRect, origin?: HandBarOrigin) => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = null
      }
      if (card && rect) {
        setFloatingCard(card)
        setAnchorRect(rect)
        setAnchorInHandBar(origin === 'hand-bar')
        onCardHover?.(card as CardView | null)
      } else {
        hoverTimeoutRef.current = window.setTimeout(() => {
          setFloatingCard(null)
          setAnchorRect(null)
          setAnchorInHandBar(false)
          onCardHover?.(null)
        }, 50)
      }
    },
    [onCardHover],
  )

  useSceneBridge({ game, playableIds, targetIds, chosenTargetIds, combatSelectable, combatMode, combatChosen, crossZonePlayables })
  useGameTransitions(game)

  const handleCardClick = (id: string) => {
    if (combatSelectable.includes(id) || combatChosen.includes(id)) onCombatClick?.(id)
    else if (targetIds.includes(id)) onTargetClick?.(id)
    else if (playableIds.includes(id)) onPlayableClick?.(id)
  }

  const oppRow = useMemo(() => (isSpectator ? opps.slice(0, 4) : opps.slice(0, 3)), [isSpectator, opps])

  return (
    <div className="arena-board" data-testid="arena-board" ref={boardRef}>
      <div className="arena-opp-row">
        {oppRow.map((opp, i) => (
          <div className="arena-opp-cell" key={opp?.playerId ?? `arena-empty-${i}`}>
            {opp && (
              <OpponentZone
                player={opp}
                onCardClick={onTargetClick}
                onCardHover={handleCardHover}
                targetIds={targetIdSet}
                revealedCards={revealedCards(game, opp)}
                attackingIds={attackingIds}
                blockingIds={blockingIds}
                mirrored
                compactPod
              />
            )}
          </div>
        ))}
      </div>

      <div className="arena-divider">
        <span className="arena-divider-diamond">◆</span>
      </div>

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
        showHand={false}
      />

      {!isSpectator && (
        <HandBar
          cards={game?.myHand ?? {}}
          onCardClick={onPlayableClick}
          onHover={handleCardHover}
          playableIds={playableIdSet}
          targetIds={targetIdSet}
        />
      )}

      <FloatingCardPreview
        card={floatingCard}
        anchorRect={anchorRect}
        boardRect={boardRef.current?.getBoundingClientRect() ?? null}
        anchorInHandBar={anchorInHandBar}
      />
      <FlyingCardOverlay />
    </div>
  )
}
