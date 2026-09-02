import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CardView, GameView, PermanentView, PlayerView } from '../net/types'
import { useSceneBridge } from './sceneBridge'
import { useGameTransitions } from './gameTransitionEngine'
import type { CrossZonePlayable } from './crossZone'
import { useStore, isBlockingModal } from '../state/store'

export interface BoardPresenterArgs {
  game: GameView | null
  targetIds?: string[]
  chosenTargetIds?: string[]
  playableIds?: string[]
  combatSelectable?: string[]
  combatMode?: 'attack' | 'block' | null
  combatChosen?: string[]
  crossZonePlayables?: CrossZonePlayable[]
  onTargetClick?: (id: string) => void
  onPlayableClick?: (id: string) => void
  onCombatClick?: (id: string) => void
  onCardHover?: (card: CardView | null) => void
}

export interface BoardPresenter {
  boardRef: React.RefObject<HTMLDivElement | null>
  floatingCard: CardView | PermanentView | null
  anchorRect: DOMRect | null
  handleCardHover: (card: CardView | PermanentView | null, rect?: DOMRect) => void
  /** Dispatcher de clicks de zona con la prioridad combat → target → playable,
   *  idéntica en los tres modos de tablero. */
  handleCardClick: (id: string) => void
  targetIdSet: Set<string>
  playableIdSet: Set<string>
}

/** Lógica común a los tres layouts de tablero (GameBoard/TwoHeaded/Arena):
 *  hover con preview flotante, dispatcher de clicks, sets memoizados y el
 *  puente de escena/transiciones. Evita que los modos diverjan. */
export function useBoardPresenter(args: BoardPresenterArgs): BoardPresenter {
  const {
    game,
    targetIds = [],
    chosenTargetIds = [],
    playableIds = [],
    combatSelectable = [],
    combatMode = null,
    combatChosen = [],
    crossZonePlayables = [],
    onTargetClick,
    onPlayableClick,
    onCombatClick,
    onCardHover,
  } = args

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
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = null
      }

      if (card && rect) {
        setFloatingCard(card)
        setAnchorRect(rect)
        onCardHover?.(card as CardView | null)
      } else {
        hoverTimeoutRef.current = window.setTimeout(() => {
          setFloatingCard(null)
          setAnchorRect(null)
          onCardHover?.(null)
        }, 50)
      }
    },
    [onCardHover]
  )

  const targetIdSet = useMemo(() => new Set(targetIds), [targetIds])
  const playableIdSet = useMemo(() => new Set(playableIds), [playableIds])

  const handleCardClick = useCallback(
    (id: string) => {
      if (combatSelectable.includes(id) || combatChosen.includes(id)) onCombatClick?.(id)
      else if (targetIds.includes(id)) onTargetClick?.(id)
      else if (playableIds.includes(id)) onPlayableClick?.(id)
    },
    [combatSelectable, combatChosen, targetIds, playableIds, onCombatClick, onTargetClick, onPlayableClick]
  )

  useSceneBridge({
    game,
    playableIds,
    targetIds,
    chosenTargetIds,
    combatSelectable,
    combatMode,
    combatChosen,
    crossZonePlayables,
  })

  useGameTransitions(game)

  return {
    boardRef,
    floatingCard,
    anchorRect,
    handleCardHover,
    handleCardClick,
    targetIdSet,
    playableIdSet,
  }
}

export interface BoardPlayers {
  allPlayers: PlayerView[]
  me: PlayerView | undefined
  opps: PlayerView[]
  isSpectator: boolean
}

/** Jugadores del tablero. En modo espectador GameBoard deriva pseudo-jugadores
 *  desde `watchedHands` cuando el servidor no envía `players`; pod/arena no. */
export function useBoardPlayers(game: GameView | null, spectatorFallbackFromWatched = false): BoardPlayers {
  return useMemo(() => {
    let allPlayers: PlayerView[] = game?.players ?? []
    if (spectatorFallbackFromWatched && allPlayers.length === 0 && game?.watchedHands) {
      const names = Object.keys(game.watchedHands)
      if (names.length > 0) {
        allPlayers = names.map((name, i) => ({
          playerId: `p-spec-${i}`,
          name,
          life: 20,
          controlled: false,
          handCount: Object.keys(game.watchedHands?.[name] ?? {}).length,
        } as unknown as PlayerView))
      }
    }
    const me = allPlayers.find((p) => p.controlled)
    const opps = allPlayers.filter((p) => !p.controlled)
    return { allPlayers, me, opps, isSpectator: !me }
  }, [game?.players, game?.watchedHands, spectatorFallbackFromWatched])
}
