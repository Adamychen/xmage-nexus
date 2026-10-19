import { useLayoutEffect, useRef, useState } from 'react'
import { useActiveFlights, markFlightLanded, normalizeFlightRect, FLIGHT_CARD_ASPECT, ENTER_LAND_AT, type FlightRecord } from './flightManager'
import { useCardImageUrl } from '../cards/useCardImageUrl'
import { soundManager } from '../audio/soundManager'
import type { CardView, PermanentView } from '../net/types'
import { spawnImpact } from './impactFx'
import { artCropUrl } from './compactCard'
import { restingRect } from './restingRect'
import './FlyingCardOverlay.css'

const CARD_BACK_URL = 'https://cards.scryfall.io/back.png'

const ENTER_RISE_AT = 0.27
const ENTER_HOLD_AT = 0.5
const ENTER_SETTLE_AT = ENTER_LAND_AT
const ENTER_SHOW_MAX_H = 440
const ENTER_RISE_EASE = 'cubic-bezier(0.2, 0.7, 0.4, 1)'
const ENTER_DROP_EASE = 'cubic-bezier(0.55, 0, 1, 0.45)'
const CAST_FLY_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'
const ENTER_SETTLE_EASE = 'cubic-bezier(0.2, 0.6, 0.4, 1)'
const ENTER_SHOW_SHADOW = '0 60px 110px var(--shade-5), 0 0 40px rgb(var(--brand-rgb) / 0.7)'
const ENTER_SHOW_SHADOW_RARE = '0 60px 120px var(--shade-5), 0 0 64px rgb(var(--gold-rgb) / 0.9)'

/** Legendarios y míticos: al entrar muestran un brillo de foil al quedarse en el centro. */
function enterRank(card: CardView | PermanentView): 'mythic' | 'legendary' | null {
  if (String(card.rarity ?? '').toUpperCase() === 'MYTHIC') return 'mythic'
  if ((card.superTypes ?? []).some((t) => String(t).toUpperCase() === 'LEGENDARY')) return 'legendary'
  return null
}

function unitDirection(fromRect: DOMRect, toRect: DOMRect): { x: number; y: number } {
  const dx = toRect.left + toRect.width / 2 - (fromRect.left + fromRect.width / 2)
  const dy = toRect.top + toRect.height / 2 - (fromRect.top + fromRect.height / 2)
  const len = Math.hypot(dx, dy)
  return len > 0 ? { x: dx / len, y: dy / len } : { x: 0, y: 0 }
}

/** Entrada al campo con peso, en tres tiempos: la carta sube hasta el centro de
 *  la pantalla y crece para mostrarse, se queda un instante, y luego cae
 *  acelerando hasta su sitio, donde asienta antes de quedar plana. Un hechizo
 *  lanzado usa la misma subida y pausa, pero el último tramo vuela a la pila. */
function liftAndDropKeyframes(p: {
  fromCx: number; fromCy: number; toCx: number; toCy: number
  w: number; h: number; endW: number; endH: number
  startRot: number; endRot: number; restShadow: string; showShadow: string
  arrival: 'drop' | 'fly'
}): Keyframe[] {
  const showH = Math.min(window.innerHeight * 0.5, ENTER_SHOW_MAX_H)
  const showW = showH * FLIGHT_CARD_ASPECT
  const showCx = window.innerWidth / 2
  const showCy = window.innerHeight / 2
  const pose = (cx: number, cy: number, w: number, h: number, rot: number, scale: number) =>
    `translate3d(${cx - w / 2}px, ${cy - h / 2}px, 0) rotate(${rot}deg) scale(${scale})`
  const shown = { width: `${showW}px`, height: `${showH}px`, boxShadow: p.showShadow, opacity: 1,
    transform: pose(showCx, showCy, showW, showH, 0, 1) }
  const rise: Keyframe[] = [
    { offset: 0, easing: ENTER_RISE_EASE, width: `${p.w}px`, height: `${p.h}px`, boxShadow: p.restShadow, opacity: 0.9,
      transform: pose(p.fromCx, p.fromCy, p.w, p.h, p.startRot, 1) },
    { offset: ENTER_RISE_AT, easing: 'linear', ...shown },
  ]
  if (p.arrival === 'fly') {
    return [
      ...rise,
      { offset: ENTER_HOLD_AT, easing: CAST_FLY_EASE, ...shown },
      { offset: 1, width: `${p.endW}px`, height: `${p.endH}px`, boxShadow: p.restShadow, opacity: 0.95,
        transform: pose(p.toCx, p.toCy, p.endW, p.endH, p.endRot, 1) },
    ]
  }
  return [
    ...rise,
    { offset: ENTER_HOLD_AT, easing: ENTER_DROP_EASE, ...shown },
    { offset: ENTER_SETTLE_AT, easing: ENTER_SETTLE_EASE, width: `${p.endW}px`, height: `${p.endH}px`, boxShadow: p.restShadow, opacity: 0.95,
      transform: pose(p.toCx, p.toCy, p.endW, p.endH, p.endRot, 0.97) },
    { offset: 1, width: `${p.endW}px`, height: `${p.endH}px`, boxShadow: p.restShadow, opacity: 0.95,
      transform: pose(p.toCx, p.toCy, p.endW, p.endH, p.endRot, 1) },
  ]
}

function FlyingCardItem({ flight }: { flight: FlightRecord }) {
  const elRef = useRef<HTMLDivElement>(null)
  const cropRef = useRef<HTMLImageElement>(null)
  const resolvedUrl = useCardImageUrl(flight.card)
  const imgUrl = resolvedUrl ?? (flight.card.faceDown === true ? CARD_BACK_URL : null)
  const [cropFailed, setCropFailed] = useState(false)
  const cropUrl = (flight.fromCompact || flight.toCompact) && flight.card.faceDown !== true && !cropFailed
    ? artCropUrl(resolvedUrl)
    : null

  useLayoutEffect(() => {
    const el = elRef.current
    if (!el) return

    let toRect = flight.toRect
    const { fromRect, duration } = flight
    const endRot = (flight.card as { tapped?: boolean }).tapped === true ? 90 : 0
    const startRot = flight.rotated90 ? 90 : 0

    el.style.width = `${fromRect.width}px`
    el.style.height = `${fromRect.height}px`

    if (typeof el.animate !== 'function') {
      markFlightLanded(flight.flightId)
      return
    }

    const entering = flight.variant === 'enter' || flight.variant === 'land'
    const lifted = entering || flight.lift === true
    const restShadow = getComputedStyle(el).boxShadow
    const rank = entering ? enterRank(flight.card) : null

    const keyframes = (): Keyframe[] => {
      const w = fromRect.width
      const h = fromRect.height
      // Same shape at both ends: keep the source aspect and fit it in the target.
      // A compact tile on only one end: morph between the landscape art crop and the card.
      const morph = !flight.fromCompact !== !flight.toCompact
      const scale = Math.min(toRect.width / Math.max(1, w), toRect.height / Math.max(1, h))
      const endW = morph ? toRect.width : w * scale
      const endH = morph ? toRect.height : h * scale
      const midW = (w + endW) / 2
      const midH = (h + endH) / 2

      const fromCx = fromRect.left + w / 2
      const fromCy = fromRect.top + h / 2
      const toCx = toRect.left + toRect.width / 2
      const toCy = toRect.top + toRect.height / 2

      const dx = toCx - fromCx
      const dy = toCy - fromCy
      const dist = Math.hypot(dx, dy)
      // Tilt 3D sutil en vuelos largos: la carta "gira en la mano" mientras cruza.
      const tilt = dist > 80 ? 14 : dist > 40 ? 8 : 0

      if (lifted) {
        return liftAndDropKeyframes({
          fromCx, fromCy, toCx, toCy, w, h, endW, endH, startRot, endRot, restShadow,
          showShadow: rank === 'mythic' ? ENTER_SHOW_SHADOW_RARE : ENTER_SHOW_SHADOW,
          arrival: entering ? 'drop' : 'fly',
        })
      }

      const arcLift = Math.min(110, dist * 0.22)
      const midRot = (startRot + endRot) / 2

      return [
        { width: `${w}px`, height: `${h}px`, transform: `translate3d(${fromCx - w / 2}px, ${fromCy - h / 2}px, 0) rotate(${startRot}deg) rotateY(0deg)`, opacity: 0.9 },
        { width: `${midW}px`, height: `${midH}px`, transform: `translate3d(${fromCx - midW / 2 + dx * 0.5}px, ${fromCy - midH / 2 + dy * 0.5 - arcLift}px, 0) rotate(${midRot}deg) rotateY(${tilt}deg)`, opacity: 1 },
        { width: `${endW}px`, height: `${endH}px`, transform: `translate3d(${toCx - endW / 2}px, ${toCy - endH / 2}px, 0) rotate(${endRot}deg) rotateY(0deg)`, opacity: 0.95 },
      ]
    }

    const timing: KeyframeAnimationOptions = {
      duration,
      easing: lifted ? 'linear' : 'cubic-bezier(0.3, 0.9, 0.35, 1)',
      fill: 'forwards',
    }

    const anim = el.animate(keyframes(), timing)
    // El golpe suena cuando la caída toca el suelo (fin del tramo de caída).
    const landSound = entering ? setTimeout(() => {
      soundManager.play('card_land', 'game')
      if (rank === 'mythic') spawnImpact('enter-ring', toRect)
    }, duration * ENTER_SETTLE_AT) : null

    // Retarget: si el destino real se mueve durante el vuelo (reacomodo del fan
    // de la mano, scroll del stack, resoluciones simultáneas), re-ancla el tramo
    // final al rect actual del slot para aterrizar exactamente sobre la carta.
    let rafId = 0
    const retarget = () => {
      if (anim.playState !== 'running') return
      if (flight.toSelector && typeof KeyframeEffect === 'function') {
        const target = document.querySelector<HTMLElement>(flight.toSelector)
        const r = target ? restingRect(target) : null
        if (r) {
          const normalized = normalizeFlightRect(r, null, flight.toCompact)
          const moved =
            Math.abs(normalized.rect.left + normalized.rect.width / 2 - (toRect.left + toRect.width / 2)) > 2 ||
            Math.abs(normalized.rect.top + normalized.rect.height / 2 - (toRect.top + toRect.height / 2)) > 2
          if (normalized.rect.width > 0 && normalized.rect.height > 0 && moved) {
            toRect = normalized.rect
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
      if (landSound) clearTimeout(landSound)
      anim.cancel()
      fade?.cancel()
    }
  }, [flight])

  useLayoutEffect(() => {
    const crop = cropRef.current
    const cropFrom = flight.fromCompact ? 1 : 0
    const cropTo = flight.toCompact ? 1 : 0
    if (!crop || cropFrom === cropTo || typeof crop.animate !== 'function') return
    const anim = crop.animate(
      [{ opacity: cropFrom }, { opacity: cropFrom, offset: 0.25 }, { opacity: cropTo, offset: 0.75 }, { opacity: cropTo }],
      { duration: flight.duration, fill: 'forwards' },
    )
    anim.currentTime = Math.min(flight.duration, Math.max(0, performance.now() - flight.startTime))
    return () => anim.cancel()
  }, [flight, cropUrl])

  const dir = flight.trail ? unitDirection(flight.fromRect, flight.toRect) : null
  const rank = enterRank(flight.card)
  const rankClass = rank && (flight.variant === 'enter' || flight.variant === 'land') ? ` flight-${rank}` : ''
  const flightStyle = {
    '--flight-dur': `${flight.duration}ms`,
    ...(dir ? { '--trail-ux': dir.x, '--trail-uy': dir.y } : null),
  } as React.CSSProperties

  return (
    <div
      ref={elRef}
      className={`flying-card-item${flight.variant ? ` flight-${flight.variant}` : ''}${flight.trail ? ` flight-trail-${flight.trail}` : ''}${rankClass}`}
      data-flight-id={flight.flightId}
      style={flightStyle}
    >
      {flight.card.faceDown === true ? (
        <img src={CARD_BACK_URL} alt="" className="flying-card-img" draggable={false} />
      ) : imgUrl ? (
        <>
          <img src={imgUrl} alt={flight.card.name || 'Card'} className="flying-card-img" />
          {cropUrl && (
            <img
              ref={cropRef}
              src={cropUrl}
              alt=""
              className="flying-card-img flying-card-crop"
              style={{ opacity: flight.fromCompact ? 1 : 0 }}
              draggable={false}
              onError={() => setCropFailed(true)}
            />
          )}
        </>
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
