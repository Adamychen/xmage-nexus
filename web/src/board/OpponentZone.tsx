import type { CardView, PlayerView } from '../net/types'
import BoardZone from './BoardZone'
import './OpponentZone.css'

export interface OpponentZoneProps {
  player: PlayerView | undefined
  onCardClick?: (id: string) => void
  onCardHover?: (card: any, rect?: DOMRect) => void
  targetIds?: Set<string>
  revealedCards?: Record<string, CardView>
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
