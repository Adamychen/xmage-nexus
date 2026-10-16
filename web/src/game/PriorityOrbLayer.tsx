import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { overlayRoot } from '../board/overlayRoot'
import type { PriorityOrb } from './usePriorityOrbs'
import './PriorityOrbLayer.css'

interface PriorityOrbLayerProps {
  orbs: PriorityOrb[]
  onDone: (id: number) => void
}

export default function PriorityOrbLayer({ orbs, onDone }: PriorityOrbLayerProps) {
  if (orbs.length === 0) return null
  return createPortal(
    orbs.map((orb) => (
      <div
        key={orb.id}
        className="priority-orb"
        data-testid="priority-orb"
        style={{
          '--orb-x0': `${orb.x0}px`,
          '--orb-y0': `${orb.y0}px`,
          '--orb-x1': `${orb.x1}px`,
          '--orb-y1': `${orb.y1}px`,
          '--orb-xm': `${orb.xm}px`,
          '--orb-ym': `${orb.ym}px`,
          '--orb-ms': `${orb.ms}ms`,
        } as CSSProperties}
        onAnimationEnd={() => onDone(orb.id)}
      />
    )),
    overlayRoot(),
  )
}
