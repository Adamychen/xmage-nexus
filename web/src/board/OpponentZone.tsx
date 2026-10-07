import type { CardView, PermanentView, PlayerView } from '../net/types'
import type { TargetZoneKind } from './targetZones'
import BoardZone from './BoardZone'
import './OpponentZone.css'

export interface OpponentZoneProps {
  player: PlayerView | undefined
  onCardClick?: (id: string) => void
  onCardHover?: (card: CardView | PermanentView | null, rect?: DOMRect) => void
  targetIds?: Set<string>
  targetZone?: TargetZoneKind | null
  targetZones?: ReadonlySet<TargetZoneKind>
  revealedCards?: Record<string, CardView>
  playableIds?: Set<string>
  combatSelectable?: string[]
  combatMode?: 'attack' | 'block' | null
  combatChosen?: string[]
  attackingIds?: string[]
  blockingIds?: string[]
  compactPod?: boolean
  mirrored?: boolean
  className?: string
}

export default function OpponentZone(props: OpponentZoneProps) {
  return (
    <BoardZone
      {...props}
      position={props.mirrored ? 'bottom' : 'top'}
      isControlled={false}
    />
  )
}
