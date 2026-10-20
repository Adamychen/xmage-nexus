import type { CSSProperties } from 'react'
import Icon from '../ui/Icon'
import { useDesignationFlights } from './designationFx'
import './DesignationOverlay.css'

type Vars = CSSProperties & Record<`--${string}`, string>

export default function DesignationOverlay() {
  const flights = useDesignationFlights()
  if (flights.length === 0) return null
  return (
    <div className="designation-overlay" aria-hidden="true">
      {flights.map((fx) => (
        <div
          key={fx.id}
          className={`designation-fx is-${fx.kind}${fx.fresh ? ' is-fresh' : ''}`}
          data-testid={`fx-${fx.kind}`}
          style={{
            left: fx.x,
            top: fx.y,
            '--des-dur': `${fx.duration}ms`,
            '--from-x': `${fx.fromX}px`,
            '--from-y': `${fx.fromY}px`,
          } as Vars}
        >
          <span className="designation-fx-x">
            <span className="designation-fx-y">
              <span className="designation-fx-lift">
                <span className="designation-fx-token">
                  <Icon name={fx.kind === 'monarch' ? 'crown' : 'swords'} size={22} />
                </span>
              </span>
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}
