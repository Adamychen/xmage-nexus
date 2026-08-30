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
    const scaleX = toRect.width / Math.max(1, fromRect.width)
    const scaleY = toRect.height / Math.max(1, fromRect.height)
    const scale = Math.max(scaleX, scaleY)

    // Initial state at fromRect
    el.style.width = `${fromRect.width}px`
    el.style.height = `${fromRect.height}px`
    el.style.transform = `translate3d(${fromRect.left}px, ${fromRect.top}px, 0) scale(1)`
    el.style.transition = 'none'

    let rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(() => {
        if (!el) return
        el.style.transition = `transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${duration}ms ease`
        el.style.transform = `translate3d(${toRect.left}px, ${toRect.top}px, 0) scale(${scale})`
      })
    })

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
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
