import { useMemo, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  useActiveFlights,
  markFlightLanded,
  removeFlight,
  normalizeFlightRect,
  FLIGHT_CARD_ASPECT,
  ENTER_LAND_AT,
  type FlightRecord,
} from './flightManager'
import { useCardImageUrl } from '../cards/useCardImageUrl'
import { soundManager } from '../audio/soundManager'
import type { CardView, PermanentView } from '../net/types'
import { cardManaColors } from './impactFx'
import { getPreviousCardImage } from './cardPositionRegistry'
import { artCropUrl } from './compactCard'
import { restingRect } from './restingRect'
import { ARENA_EASE, fxShake, fxTimeline, gsap } from '../fx/fxEngine'
import { vfx } from '../fx/vfxEngine'
import { manaToVfxColor, type VfxColorKey } from '../fx/vfxPalette'
import './FlyingCardOverlay.css'

const CARD_BACK_URL = 'https://cards.scryfall.io/back.png'
const ENTER_SHOW_MAX_H = 380

function enterRank(card: CardView | PermanentView): 'mythic' | 'legendary' | null {
  if (String(card.rarity ?? '').toUpperCase() === 'MYTHIC') return 'mythic'
  if ((card.superTypes ?? []).some((t) => String(t).toUpperCase() === 'LEGENDARY')) return 'legendary'
  return null
}

function vfxColorOf(card: CardView | PermanentView, fallback: VfxColorKey = 'gold'): VfxColorKey {
  return manaToVfxColor(cardManaColors(card)[0], fallback)
}

function unitDirection(fromRect: DOMRect, toRect: DOMRect): { x: number; y: number } {
  const dx = toRect.left + toRect.width / 2 - (fromRect.left + fromRect.width / 2)
  const dy = toRect.top + toRect.height / 2 - (fromRect.top + fromRect.height / 2)
  const len = Math.hypot(dx, dy)
  return len > 0 ? { x: dx / len, y: dy / len } : { x: 0, y: 0 }
}

/**
 * Computes GPU-only transform coordinates (`x`, `y`, `scaleX`, `scaleY`) relative
 * to a clone sized at `baseW × baseH` with `transformOrigin: 'center center'`.
 */
function flightMetrics(fromRect: DOMRect, toRect: DOMRect, fromCompact: boolean, toCompact: boolean) {
  const w = Math.max(1, fromRect.width)
  const h = Math.max(1, fromRect.height)
  const morph = fromCompact !== toCompact
  const fitScale = Math.min(toRect.width / w, toRect.height / h)
  const endScaleX = morph ? toRect.width / w : fitScale
  const endScaleY = morph ? toRect.height / h : fitScale

  const startX = fromRect.left
  const startY = fromRect.top
  const toCx = toRect.left + toRect.width / 2
  const toCy = toRect.top + toRect.height / 2
  const endX = toCx - w / 2
  const endY = toCy - h / 2

  const fromCx = fromRect.left + w / 2
  const fromCy = fromRect.top + h / 2
  const dx = toCx - fromCx
  const dy = toCy - fromCy
  const dist = Math.hypot(dx, dy)

  return { w, h, startX, startY, endX, endY, endScaleX, endScaleY, fromCx, fromCy, toCx, toCy, dx, dy, dist }
}

function shouldLandTapped(flight: FlightRecord): boolean {
  if ((flight.card as { tapped?: boolean }).tapped !== true) return false
  if (
    flight.variant === 'destroy' ||
    flight.variant === 'exile' ||
    flight.variant === 'sacrifice' ||
    flight.variant === 'tuck' ||
    flight.variant === 'command'
  ) {
    return false
  }
  if (flight.toSelector && typeof document !== 'undefined') {
    const dest = document.querySelector<HTMLElement>(flight.toSelector)
    if (dest) {
      if (dest.closest('.hand-bar, .hand-zone, .hand-rail, .hand-row, .hand-back-fan, .hand-back-stack, .stack-zone, .pile-card')) return false
      return dest.dataset.tapped === '1' || dest.classList.contains('tapped')
    }
    if (/hand|graveyard|exile|library|stack|command|pile-card/.test(flight.toSelector)) return false
  }
  return (
    flight.variant === 'enter' ||
    flight.variant === 'land' ||
    flight.variant === 'control' ||
    flight.variant === 'animate' ||
    flight.variant === 'mutate'
  )
}

function destinationRotation(flight: FlightRecord): number {
  if (shouldLandTapped(flight)) return 90
  if (!flight.toSelector || typeof document === 'undefined') return 0
  const dest = document.querySelector<HTMLElement>(flight.toSelector)
  if (!dest) return 0

  const oppFanCard = dest.closest<HTMLElement>('.hand-back-fan-card')
  const oppHalfFan = dest.closest<HTMLElement>('.hand-back-stack.is-half-fan')
  if (oppFanCard || oppHalfFan) {
    const fanDeg = oppFanCard ? parseFloat(getComputedStyle(oppFanCard).getPropertyValue('--fan-rot')) || 0 : 0
    return (oppHalfFan ? 180 : 0) + fanDeg
  }

  const handSlot = dest.closest<HTMLElement>('.hand-card-slot')
  if (handSlot) {
    return parseFloat(getComputedStyle(handSlot).getPropertyValue('--rot')) || 0
  }

  return 0
}

function FlyingCardItem({ flight }: { flight: FlightRecord }) {
  const elRef = useRef<HTMLDivElement>(null)
  const cropRef = useRef<HTMLImageElement>(null)
  const resolvedUrl = useCardImageUrl(flight.card)
  const lastSeen = useMemo(() => getPreviousCardImage(String(flight.card.id ?? '')), [flight.card.id])
  const imgUrl = resolvedUrl ?? lastSeen ?? (flight.card.faceDown === true ? CARD_BACK_URL : null)
  const [cropFailed, setCropFailed] = useState(false)
  const cropUrl = (flight.fromCompact || flight.toCompact) && flight.card.faceDown !== true && !cropFailed
    ? artCropUrl(resolvedUrl)
    : null

  useLayoutEffect(() => {
    const el = elRef.current
    if (!el) return

    let toRect = flight.toRect
    const { fromRect } = flight
    const durS = Math.max(0.14, flight.duration / 1000)
    const endRot = destinationRotation(flight)
    const startRot = flight.startRotation ?? (flight.rotated90 ? 90 : 0)
    const entering = flight.variant === 'enter' || flight.variant === 'land'
    const lifted = entering || flight.lift === true
    const rank = entering ? enterRank(flight.card) : null
    const color = vfxColorOf(flight.card, rank ? 'gold' : 'brand')

    el.style.width = `${fromRect.width}px`
    el.style.height = `${fromRect.height}px`

    const m = flightMetrics(fromRect, toRect, flight.fromCompact === true, flight.toCompact === true)
    const tl = fxTimeline()
    if (!tl) {
      markFlightLanded(flight.flightId)
      return
    }

    // Origin VFX for destructive / exile transitions
    if (flight.variant === 'destroy' || flight.variant === 'sacrifice') {
      vfx.shatter(fromRect, flight.variant === 'sacrifice' ? 'blood' : 'ember')
    } else if (flight.variant === 'exile') {
      vfx.exileVortex(fromRect, 'W')
    } else if (flight.variant === 'control') {
      vfx.shockwave(m.fromCx, m.fromCy, 'gold', { startR: 12, endR: 90, lineWidth: 3.5, duration: 0.34 })
    }

    tl.set(el, {
      x: m.startX,
      y: m.startY,
      scaleX: 1,
      scaleY: 1,
      rotation: startRot,
      rotateY: 0,
      opacity: 0.92,
      transformOrigin: 'center center',
    })

    if (lifted) {
      const showH = Math.min((typeof window !== 'undefined' ? window.innerHeight : 800) * 0.44, ENTER_SHOW_MAX_H)
      const showW = showH * FLIGHT_CARD_ASPECT
      const showScale = Math.min(showW / m.w, showH / m.h)
      const showX = (typeof window !== 'undefined' ? window.innerWidth : 1200) / 2 - m.w / 2
      const showY = (typeof window !== 'undefined' ? window.innerHeight : 800) / 2 - m.h / 2

      const riseDur = durS * 0.28
      const holdDur = durS * 0.2
      const dropDur = durS * (entering ? ENTER_LAND_AT - 0.48 : 0.52)
      const settleDur = entering ? durS * (1 - ENTER_LAND_AT) : 0

      tl.to(el, {
        x: showX,
        y: showY,
        scaleX: showScale,
        scaleY: showScale,
        rotation: 0,
        opacity: 1,
        duration: riseDur,
        ease: ARENA_EASE.snapOut,
      })
        .to(el, { duration: holdDur })
        .to(el, {
          x: m.endX,
          y: m.endY,
          scaleX: entering ? m.endScaleX * 0.94 : m.endScaleX,
          scaleY: entering ? m.endScaleY * 0.94 : m.endScaleY,
          rotation: endRot,
          opacity: 0.98,
          duration: dropDur,
          ease: entering ? ARENA_EASE.slamIn : ARENA_EASE.arc,
        })

      if (entering) {
        tl.call(() => {
          soundManager.play('card_land', 'game')
          const board = document.querySelector('.board-shell')
          if (rank === 'mythic' || flight.variant === 'heavy') {
            vfx.mythicBurst(m.toCx, m.toCy, rank === 'mythic' ? 'gold' : color)
            if (board) fxShake(board, 'medium')
          } else if (rank === 'legendary') {
            vfx.mythicBurst(m.toCx, m.toCy, color)
            if (board) fxShake(board, 'light')
          } else {
            vfx.shockwave(m.toCx, m.toCy, color, { startR: 10, endR: 70, lineWidth: 2.5, duration: 0.28 })
            vfx.sparkBurst(m.toCx, m.toCy, color, { count: 8, speed: 150, size: 3, life: 0.28, gravity: 110 })
          }
        }).to(el, {
          scaleX: m.endScaleX,
          scaleY: m.endScaleY,
          duration: settleDur,
          ease: ARENA_EASE.pop,
        })
      } else {
        // Cast spell landing on stack
        tl.call(() => {
          vfx.sparkBurst(m.toCx, m.toCy, color, { count: 12, speed: 180, size: 3.2, life: 0.3, gravity: 60 })
        })
      }
    } else if (flight.variant === 'control') {
      const grabDur = durS * 0.28
      const pullDur = durS * 0.72
      tl.to(el, {
        scaleX: 1.1,
        scaleY: 1.1,
        opacity: 1,
        duration: grabDur,
        ease: ARENA_EASE.snapOut,
      })
        .to(el, {
          motionPath: {
            path: [
              { x: (m.startX + m.endX) / 2, y: (m.startY + m.endY) / 2 - Math.min(90, m.dist * 0.2) },
              { x: m.endX, y: m.endY },
            ],
            curviness: 1.2,
          },
          scaleX: m.endScaleX,
          scaleY: m.endScaleY,
          rotation: endRot,
          opacity: 0.96,
          duration: pullDur,
          ease: ARENA_EASE.arc,
        })
        .call(() => {
          vfx.shockwave(m.toCx, m.toCy, 'gold', { startR: 12, endR: 84, lineWidth: 3, duration: 0.3 })
        })
    } else if (flight.static || m.dist < 6) {
      // No destination zone (copies, abilities, triggers): drift left/up and dissolve like smoke/fizzle.
      vfx.sparkBurst(m.fromCx, m.fromCy, color, { count: 16, speed: 145, size: 3.5, life: 0.42, gravity: -45 })
      tl.to(el, {
        x: m.startX - 48,
        y: m.startY - 12,
        scaleX: 1.06,
        scaleY: 1.06,
        opacity: 0,
        filter: 'blur(5px) brightness(1.45)',
        duration: Math.max(0.3, durS),
        ease: 'power2.in',
      })
    } else {
      const arcLift = Math.max(44, Math.min(110, m.dist * 0.26))
      const midX = (m.startX + m.endX) / 2
      const midY = (m.startY + m.endY) / 2 - arcLift
      const tilt = m.dist > 80 ? 14 : m.dist > 40 ? 8 : 0

      tl.to(el, {
        motionPath: {
          path: [
            { x: midX, y: midY },
            { x: m.endX, y: m.endY },
          ],
          curviness: 1.15,
        },
        scaleX: m.endScaleX,
        scaleY: m.endScaleY,
        rotation: endRot,
        opacity: 0.96,
        duration: durS,
        ease: flight.variant === 'animate' ? 'power2.out' : ARENA_EASE.arc,
      })

      if (tilt > 0) {
        tl.to(el, { rotateY: tilt, duration: durS * 0.5, ease: 'power1.out' }, 0)
          .to(el, { rotateY: 0, duration: durS * 0.5, ease: 'power1.in' }, durS * 0.5)
      }
    }

    // Compact art-crop crossfade synchronized to the same timeline
    const crop = cropRef.current
    const cropFrom = flight.fromCompact ? 1 : 0
    const cropTo = flight.toCompact ? 1 : 0
    if (crop && cropFrom !== cropTo) {
      tl.fromTo(
        crop,
        { opacity: cropFrom },
        { opacity: cropTo, duration: durS * 0.5, ease: 'none' },
        durS * 0.25,
      )
    }

    // Handover: reveal destination card underneath at full opacity, then cleanly fade clone away.
    tl.call(() => markFlightLanded(flight.flightId))
      .to(el, {
        opacity: 0,
        duration: 0.09,
        delay: 0.02,
        ease: 'power1.out',
        onComplete: () => removeFlight(flight.flightId),
      })

    // Live retarget: if the destination slot moves mid-flight (hand fan reflow, stack scroll),
    // smoothly adjust the final coordinates without restarting the arc.
    let rafId = 0
    let disposed = false
    const retarget = () => {
      if (disposed || tl.progress() >= 1) return
      if (flight.toSelector) {
        const target = document.querySelector<HTMLElement>(flight.toSelector)
        const r = target ? restingRect(target) : null
        if (r) {
          const normalized = normalizeFlightRect(r, null, flight.toCompact)
          const moved =
            Math.abs(normalized.rect.left + normalized.rect.width / 2 - (toRect.left + toRect.width / 2)) > 2 ||
            Math.abs(normalized.rect.top + normalized.rect.height / 2 - (toRect.top + toRect.height / 2)) > 2
          if (normalized.rect.width > 0 && normalized.rect.height > 0 && moved) {
            toRect = normalized.rect
            const updated = flightMetrics(fromRect, toRect, flight.fromCompact === true, flight.toCompact === true)
            const remaining = Math.max(0.08, tl.duration() - tl.time() - 0.16)
            gsap.to(el, {
              x: updated.endX,
              y: updated.endY,
              scaleX: updated.endScaleX,
              scaleY: updated.endScaleY,
              duration: remaining,
              ease: ARENA_EASE.snapOut,
              overwrite: 'auto',
            })
          }
        }
      }
      rafId = requestAnimationFrame(retarget)
    }
    if (flight.toSelector && typeof requestAnimationFrame === 'function') {
      rafId = requestAnimationFrame(retarget)
    }

    return () => {
      disposed = true
      if (rafId) cancelAnimationFrame(rafId)
      tl.kill()
      gsap.killTweensOf(el)
    }
  }, [flight])

  const turns = flight.reveal || flight.conceal
  useLayoutEffect(() => {
    if (!turns || !elRef.current) return
    const elapsed = Math.min(flight.duration, Math.max(0, performance.now() - flight.startTime))
    for (const el of elRef.current.querySelectorAll('.flying-card-face, .flying-card-back-cover')) {
      if (typeof el.getAnimations !== 'function') continue
      for (const anim of el.getAnimations()) anim.currentTime = elapsed
    }
  }, [flight, imgUrl, turns])

  const dir = flight.trail || flight.variant === 'control' ? unitDirection(flight.fromRect, flight.toRect) : null
  const rank = enterRank(flight.card)
  const rankClass = rank && (flight.variant === 'enter' || flight.variant === 'land') ? ` flight-${rank}` : ''
  const flightStyle = {
    '--flight-dur': `${flight.duration}ms`,
    ...(dir ? { '--trail-ux': dir.x, '--trail-uy': dir.y } : null),
    ...(flight.tint ? { '--flight-tint': flight.tint } : null),
  } as React.CSSProperties

  return (
    <div
      ref={elRef}
      className={`flying-card-item${flight.variant ? ` flight-${flight.variant}` : ''}${flight.trail ? ` flight-trail-${flight.trail}` : ''}${rankClass}${flight.reveal ? ' flight-reveal' : ''}${flight.conceal ? ' flight-conceal' : ''}`}
      data-flight-id={flight.flightId}
      style={flightStyle}
    >
      {flight.card.faceDown === true ? (
        <img src={CARD_BACK_URL} alt="" className="flying-card-img" draggable={false} />
      ) : imgUrl ? (
        <>
          <img src={imgUrl} alt={flight.card.name || 'Card'} className={`flying-card-img${turns ? ' flying-card-face' : ''}`} />
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
        <div className={`flying-card-fallback${turns ? ' flying-card-face' : ''}`}>{flight.card.name || 'Magic Card'}</div>
      )}
      {turns && <img src={CARD_BACK_URL} alt="" className="flying-card-img flying-card-back-cover" draggable={false} />}
      <div className="flying-card-glow" />
    </div>
  )
}

export default function FlyingCardOverlay() {
  const flights = useActiveFlights()

  if (flights.length === 0) return null

  const overlay = (
    <div className="flying-cards-overlay" aria-hidden="true">
      {flights.map((flight) => (
        <FlyingCardItem key={flight.flightId} flight={flight} />
      ))}
    </div>
  )
  // Portal to document.body so ancestor transforms (e.g. board shake on mythic/legendary
  // slam) never hijack `position: fixed` viewport coordinates.
  return typeof document !== 'undefined' ? createPortal(overlay, document.body) : overlay
}
