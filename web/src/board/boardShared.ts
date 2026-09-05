import { useMemo } from 'react'
import type { CardView, GameView, PlayerView } from '../net/types'
import { simpleToCardsView } from './revealedCards'
import type { CrossZonePlayable } from './crossZone'

export const MAX_BOARD_PLAYERS = 4

export interface BoardProps {
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

export function useSpectatorBottomHand(
  game: GameView | null,
  isSpectator: boolean,
  bottomPlayer: PlayerView | undefined,
): Record<string, CardView> {
  return useMemo(() => {
    if (!isSpectator || !bottomPlayer) return {}
    const watched =
      game?.watchedHands?.[bottomPlayer.name] ||
      game?.watchedHands?.[bottomPlayer.playerId]
    const oppHand =
      game?.opponentHands?.[bottomPlayer.playerId] ||
      game?.opponentHands?.[bottomPlayer.name]
    if (watched) return simpleToCardsView(watched)
    if (oppHand) return simpleToCardsView(oppHand)
    return {}
  }, [isSpectator, bottomPlayer, game?.watchedHands, game?.opponentHands])
}
