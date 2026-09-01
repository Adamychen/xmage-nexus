import type { CardView, CardsView, PlayerView } from '../net/types'
import type { CrossZonePlayable } from './crossZone'
import BoardZone from './BoardZone'
import './PlayerZone.css'

export interface PlayerZoneProps {
  player: PlayerView | undefined
  hand?: CardsView
  onCardClick?: (id: string) => void
  onHandCardClick?: (id: string) => void
  onCardHover?: (card: any, rect?: DOMRect) => void
  targetIds?: Set<string>
  playableIds?: Set<string>
  combatSelectable?: string[]
  combatMode?: 'attack' | 'block' | null
  combatChosen?: string[]
  attackingIds?: string[]
  blockingIds?: string[]
  crossZonePlayables?: CrossZonePlayable[]
  onPlayCrossZone?: (id: string) => void
  helperEmblems?: Record<string, CardView>
  compactPod?: boolean
  className?: string
  showHand?: boolean
}

export default function PlayerZone(props: PlayerZoneProps) {
  return (
    <BoardZone
      {...props}
      position="bottom"
      isControlled={props.player?.controlled ?? true}
    />
  )
}
