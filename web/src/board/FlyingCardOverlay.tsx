import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useActiveFlights, markFlightLanded, type FlightRecord } from './flightManager'
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

    let toRect = flight.toRect
    const { fromRect, duration } = flight
    const rot = (flight.card as { tapped?: boolean }).tapped === true ? 90 : 0

    el.style.width = `${fromRect.width}px`
    el.style.height = `${fromRect.height}px`

    if (typeof el.animate !== 'function') {
      markFlightLanded(flight.flightId)
      return
    }

    const keyframes = (): Keyframe[] => {
      const w = fromRect.width
      const h = fromRect.height
      const scale = Math.min(toRect.width / Math.max(1, w), toRect.height / Math.max(1, h))

      const fromCx = fromRect.left + w / 2
      const fromCy = fromRect.top + h / 2
      const toCx = toRect.left + toRect.width / 2
      const toCy = toRect.top + toRect.height / 2

      const dx = toCx - fromCx
      const dy = toCy - fromCy
      const dist = Math.hypot(dx, dy)
      const arcLift = Math.min(110, dist * 0.22)

      return [
        { transform: `translate3d(${fromCx - w / 2}px, ${fromCy - h / 2}px, 0) rotate(0deg) scale(1)`, opacity: 0.9 },
        { transform: `translate3d(${fromCx - w / 2 + dx * 0.5}px, ${fromCy - h / 2 + dy * 0.5 - arcLift}px, 0) rotate(${rot / 2}deg) scale(${(1 + scale) / 2})`, opacity: 1 },
        { transform: `translate3d(${toCx - w / 2}px, ${toCy - h / 2}px, 0) rotate(${rot}deg) scale(${scale})`, opacity: 0.95 },
      ]
    }

    const timing: KeyframeAnimationOptions = {
      duration,
      easing: 'cubic-bezier(0.3, 0.9, 0.35, 1)',
      fill: 'forwards',
    }

    const anim = el.animate(keyframes(), timing)

    // Retarget: si el destino real se mueve durante el vuelo (reacomodo del fan
    // de la mano, scroll del stack, resoluciones simultáneas), re-ancla el tramo
    // final al rect actual del slot para aterrizar exactamente sobre la carta.
    let rafId = 0
    const retarget = () => {
      if (anim.playState !== 'running') return
      if (flight.toSelector && typeof KeyframeEffect === 'function') {
        const target = document.querySelector(flight.toSelector)
        if (target) {
          const r = target.getBoundingClientRect()
          const moved =
            Math.abs(r.left + r.width / 2 - (toRect.left + toRect.width / 2)) > 2 ||
            Math.abs(r.top + r.height / 2 - (toRect.top + toRect.height / 2)) > 2
          if (r.width > 0 && r.height > 0 && moved) {
            toRect = r
            anim.effect = new KeyframeEffect(el, keyframes(), timing)
          }
        }
      }
      rafId = requestAnimationFrame(retarget)
    }
    if (flight.toSelector && typeof requestAnimationFrame === 'function') {
      rafId = requestAnimationFrame(retarget)
    }

    let fade: Animation | null = null
    anim.finished
      .then(() => {
        if (rafId) cancelAnimationFrame(rafId)
        markFlightLanded(flight.flightId)
        fade = el.animate([{ opacity: 0.95 }, { opacity: 0 }], {
          duration: 140,
          delay: 60,
          easing: 'ease-out',
          fill: 'forwards',
        })
      })
      .catch(() => {
        if (rafId) cancelAnimationFrame(rafId)
      })

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      anim.cancel()
      fade?.cancel()
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
