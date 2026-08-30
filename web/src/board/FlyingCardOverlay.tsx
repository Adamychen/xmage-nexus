import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useActiveFlights, type FlightRecord } from './flightManager'
import { awaitImageUrl } from '../cards/cardImages'
import './FlyingCardOverlay.css'

function FlyingCardItem({ flight }: { flight: FlightRecord }) {
  const elRef = useRef<HTMLDivElement>(null)
  const [imgUrl, setImgUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    awaitImageUrl(flight.card).then((url) => {
      if (!cancelled) setImgUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [flight.card])

  useLayoutEffect(() => {
    const el = elRef.current
    if (!el) return

    const { fromRect, toRect, duration } = flight

    // Uniform scale to destination (use min to avoid stretching)
    const scaleX = toRect.width / Math.max(1, fromRect.width)
    const scaleY = toRect.height / Math.max(1, fromRect.height)
    const scale = Math.min(scaleX, scaleY)

    // Arc offset: perpendicular lift proportional to travel distance
    const dx = toRect.left - fromRect.left
    const dy = toRect.top - fromRect.top
    const dist = Math.hypot(dx, dy)
    const arcLift = Math.min(120, dist * 0.25)

    // Define the arc keyframe on the element itself
    const keyframeName = `arc-${flight.flightId}`
    const styleTag = document.createElement('style')
    styleTag.id = keyframeName
    styleTag.textContent = `
      @keyframes ${keyframeName} {
        0%   { transform: translate3d(${fromRect.left}px, ${fromRect.top}px, 0) scale(1); opacity: 0.85; }
        50%  { transform: translate3d(${fromRect.left + dx * 0.5}px, ${fromRect.top + dy * 0.5 - arcLift}px, 0) scale(${(1 + scale) / 2}); opacity: 1; }
        100% { transform: translate3d(${toRect.left}px, ${toRect.top}px, 0) scale(${scale}); opacity: 0.7; }
      }
    `
    document.head.appendChild(styleTag)

    el.style.width = `${fromRect.width}px`
    el.style.height = `${fromRect.height}px`
    el.style.transform = `translate3d(${fromRect.left}px, ${fromRect.top}px, 0) scale(1)`
    el.style.animation = `${keyframeName} ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) forwards`

    return () => {
      document.getElementById(keyframeName)?.remove()
    }
  }, [flight])

  return (
    <div ref={elRef} className="flying-card-item" data-flight-id={flight.flightId}>
      {imgUrl ? (
        <img src={imgUrl} alt={flight.card.name || 'Card'} className="flying-card-img" />
      ) : (
        <div className="flying-card-fallback">{flight.card.name || 'Magic Card'}</div>
      )}
      <div className="flying-card-glow" />
    </div>
  )
}

export default function FlyingCardOverlay() {
  const flights = useActiveFlights()

  if (flights.length === 0) return null

  return (
    <div className="flying-cards-overlay" aria-hidden="true">
      {flights.map((flight) => (
        <FlyingCardItem key={flight.flightId} flight={flight} />
      ))}
    </div>
  )
}
