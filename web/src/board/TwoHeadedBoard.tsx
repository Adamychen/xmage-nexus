import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CardView, GameView, PermanentView, PlayerView } from '../net/types'
import OpponentZone from './OpponentZone'
import PlayerZone from './PlayerZone'
import FloatingCardPreview from './FloatingCardPreview'
import { useSceneBridge } from './sceneBridge'
import type { CrossZonePlayable } from './crossZone'
import { useStore, isBlockingModal } from '../state/store'
import './TwoHeadedBoard.css'

interface TwoHeadedBoardProps {
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

function revealedCards(
  game: GameView | null | undefined,
  player: PlayerView | undefined,
): Record<string, CardView> {
  if (!game || !player) return {}
  const res: Record<string, CardView> = {}

  if (Array.isArray(game.revealed)) {
    game.revealed.forEach((rev) => {
      if (rev.cards && typeof rev.cards === 'object') {
        Object.entries(rev.cards).forEach(([id, c]) => { res[id] = c as CardView })
      }
    })
  }
  if (game.opponentHands?.[player.playerId]) {
    Object.entries(game.opponentHands[player.playerId]).forEach(([id, c]) => { res[id] = c as CardView })
  }
  if (game.watchedHands?.[player.name]) {
    Object.entries(game.watchedHands[player.name]).forEach(([id, c]) => {
      res[id] = { name: (c as any).name ?? '?', manaValue: 0, expansionSetCode: '', cardNumber: '0', parentId: id, id }
    })
  }
  return res
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
  crossZonePlayables = [],
  onPlayCrossZone,
}: TwoHeadedBoardProps) {
  const allPlayers = useMemo((): PlayerView[] => game?.players ?? [], [game?.players])

  const me = allPlayers.find((p) => p.controlled)
  const opps = allPlayers.filter((p) => !p.controlled)
  const isSpectator = !me

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

  const targetIdSet = useMemo(() => new Set(targetIds), [targetIds])
  const playableIdSet = useMemo(() => new Set(playableIds), [playableIds])

  const boardRef = useRef<HTMLDivElement>(null)
  const [floatingCard, setFloatingCard] = useState<CardView | PermanentView | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
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
    }
  }, [modalOpen])

  const handleCardHover = useCallback(
    (card: CardView | PermanentView | null, rect?: DOMRect) => {
      if (hoverTimeoutRef.current) { clearTimeout(hoverTimeoutRef.current); hoverTimeoutRef.current = null }
      if (card && rect) {
        setFloatingCard(card); setAnchorRect(rect); onCardHover?.(card as CardView | null)
      } else {
        hoverTimeoutRef.current = window.setTimeout(() => {
          setFloatingCard(null); setAnchorRect(null); onCardHover?.(null)
        }, 50)
      }
    },
    [onCardHover],
  )

  useSceneBridge({ game, playableIds, targetIds, chosenTargetIds, combatSelectable, combatMode, combatChosen, crossZonePlayables })

  const handleCardClick = (id: string) => {
    if (combatSelectable.includes(id) || combatChosen.includes(id)) onCombatClick?.(id)
    else if (targetIds.includes(id)) onTargetClick?.(id)
    else if (playableIds.includes(id)) onPlayableClick?.(id)
  }

  const oppSlot = (player: PlayerView | undefined, key: string, mirrored = false) => (
    <div className="pod-cell" key={key}>
      <OpponentZone
        player={player}
        onCardClick={onTargetClick}
        onCardHover={handleCardHover}
        targetIds={targetIdSet}
        revealedCards={revealedCards(game, player)}
        mirrored={mirrored}
      />
    </div>
  )

  return (
    <div className="pod-board" ref={boardRef}>
      {/* ── Top row ── */}
      <div className="pod-row pod-row--top">
        {oppSlot(topLeft, 'tl')}
        <div className="pod-col-divider" />
        {oppSlot(topRight, 'tr')}
      </div>

      {/* ── Horizontal board divider ── */}
      <div className="pod-board-divider">
        <span className="pod-divider-diamond">◆</span>
      </div>

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
              crossZonePlayables={crossZonePlayables}
              onPlayCrossZone={onPlayCrossZone}
              helperEmblems={game?.myHelperEmblems}
            />
          ) : (
            <OpponentZone
              player={botLeft as PlayerView | undefined}
              onCardClick={onTargetClick}
              onCardHover={handleCardHover}
              targetIds={targetIdSet}
              revealedCards={revealedCards(game, botLeft as PlayerView | undefined)}
              mirrored
            />
          )}
        </div>

        <div className="pod-col-divider" />

        {/* Bottom-right: always an opponent (mirrored to face the center) */}
        {oppSlot(botRight, 'br', true)}
      </div>

      <FloatingCardPreview
        card={floatingCard}
        anchorRect={anchorRect}
        boardRect={boardRef.current?.getBoundingClientRect() ?? null}
      />
    </div>
  )
}
