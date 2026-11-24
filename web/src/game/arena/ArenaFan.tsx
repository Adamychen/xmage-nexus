import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import CardSlot from '../../board/CardSlot'
import { FAN_SLICE, FAN_STEP_DEG, fanRadius } from '../../board/zoneFan'
import type { CardView } from '../../net/types'
import './ArenaFan.css'

interface FanGeometry {
  mid: number
  stepDeg: number
  slicePx: number
}

interface ArenaFanProps {
  zoneId: string
  cards: CardView[]
  leadingBack?: CardView
  splitZoneId?: string
  underCards?: CardView[]
  underGapIndex?: number | null
  gapIndex: number | null
  dealing: boolean
  onCardPointerDown: (e: PointerEvent, id: string) => void
  onUnderCardPointerDown?: (e: PointerEvent, id: string) => void
  laneRef: (el: HTMLDivElement | null) => void
}

const FALLBACK_LANE_W = 600
const FALLBACK_CARD_W = 170
const DEAL_STAGGER_MS = 80
const MIN_SLICE = 0.18

let versionSeq = 0

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function fanGeometry(width: number, cardW: number, slots: number): FanGeometry {
  const w = cardW > 0 ? cardW : FALLBACK_CARD_W
  const mid = (slots - 1) / 2
  const room = slots > 1 ? (width - w) / (slots - 1) : w
  const slicePx = Math.max(w * MIN_SLICE, Math.min(w * FAN_SLICE, room))
  const stepDeg = FAN_STEP_DEG * (slicePx / (w * FAN_SLICE))
  return { mid, stepDeg, slicePx }
}

export function fanIndexAt(x: number, lane: DOMRect, cardW: number, count: number, leading: boolean): number {
  const first = leading ? 1 : 0
  const geo = fanGeometry(lane.width, cardW, count + 1 + first)
  const slot = Math.ceil((x - (lane.left + lane.width / 2)) / geo.slicePx + geo.mid - 0.5)
  return clamp(slot - first, 0, count)
}

export function fanSplitAt(x: number, lane: DOMRect, cardW: number, underCount: number, overCount: number): { side: 'under' | 'over'; index: number } {
  const total = underCount + overCount + 2
  const geo = fanGeometry(lane.width, cardW, total)
  const slot = clamp(Math.ceil((x - (lane.left + lane.width / 2)) / geo.slicePx + geo.mid - 0.5), 0, total - 1)
  if (slot <= underCount) return { side: 'under', index: slot }
  return { side: 'over', index: slot - underCount - 1 }
}

interface FanCardProps {
  zoneId: string
  side?: string
  under?: boolean
  card: CardView
  angle: number
  zIndex: number
  dealDelay: number | null
  onPointerDown: (e: PointerEvent, id: string) => void
}

function FanCard({ zoneId, side, under, card, angle, zIndex, dealDelay, onPointerDown }: FanCardProps) {
  const [version] = useState(() => ++versionSeq)
  const id = card.id as string
  return (
    <div
      className={under ? 'arena-fan-slot is-under' : 'arena-fan-slot'}
      data-arena-card={id}
      data-arena-side={side}
      style={{ rotate: `${angle}deg`, zIndex }}
    >
      <div className="arena-fan-land">
        <div
          className="arena-fan-card"
          style={dealDelay != null ? { animationDelay: `${dealDelay}ms` } : undefined}
          onPointerDown={(e) => onPointerDown(e, id)}
        >
          <CardSlot card={card} cardId={`arena:${zoneId}:${id}:${version}`} />
        </div>
      </div>
    </div>
  )
}

export default function ArenaFan({
  zoneId,
  cards,
  leadingBack,
  splitZoneId,
  underCards,
  underGapIndex = null,
  gapIndex,
  dealing,
  onCardPointerDown,
  onUnderCardPointerDown,
  laneRef,
}: ArenaFanProps) {
  const laneEl = useRef<HTMLDivElement | null>(null)
  const probeRef = useRef<HTMLDivElement>(null)
  const laneRefLatest = useRef(laneRef)
  laneRefLatest.current = laneRef
  const liftRef = useRef<{ slot: HTMLElement; clone: HTMLElement } | null>(null)
  const [size, setSize] = useState({ laneW: FALLBACK_LANE_W, cardW: FALLBACK_CARD_W })

  const setLane = useCallback((el: HTMLDivElement | null) => {
    laneEl.current = el
    laneRefLatest.current(el)
  }, [])

  useLayoutEffect(() => {
    const lane = laneEl.current
    if (!lane) return
    const measure = () => {
      const laneW = lane.clientWidth || FALLBACK_LANE_W
      const cardW = probeRef.current?.offsetWidth || FALLBACK_CARD_W
      setSize((prev) => (prev.laneW === laneW && prev.cardW === cardW ? prev : { laneW, cardW }))
    }
    measure()
    window.addEventListener('resize', measure)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(lane)
    return () => {
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [])

  const clearLift = useCallback(() => {
    const lift = liftRef.current
    if (!lift) return
    lift.slot.classList.remove('is-lifted')
    lift.clone.remove()
    liftRef.current = null
  }, [])

  const under = underCards ?? []
  const idsKey = [...under, ...cards].map((c) => c.id as string).join('|')
  useLayoutEffect(() => clearLift, [clearLift])
  useLayoutEffect(() => clearLift(), [idsKey, gapIndex, underGapIndex, clearLift])

  const onPointerOver = (e: PointerEvent<HTMLDivElement>) => {
    const slot = (e.target as HTMLElement).closest<HTMLElement>('.arena-fan-slot[data-arena-card]')
    if (!slot || liftRef.current?.slot === slot) return
    clearLift()
    const clone = slot.cloneNode(true) as HTMLElement
    for (const el of [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))]) {
      el.removeAttribute('data-arena-card')
      el.removeAttribute('data-card-id')
      el.removeAttribute('data-card-name')
      el.removeAttribute('data-testid')
      el.removeAttribute('id')
    }
    clone.classList.add('arena-lift')
    clone.setAttribute('aria-hidden', 'true')
    clone.style.zIndex = '9999'
    slot.parentElement?.appendChild(clone)
    slot.classList.add('is-lifted')
    liftRef.current = { slot, clone }
  }

  const backCount = leadingBack ? 1 : 0
  const underGap = underGapIndex == null ? null : clamp(underGapIndex, 0, under.length)
  const overGap = underGap == null && gapIndex != null ? clamp(gapIndex, 0, cards.length) : null
  const hasGap = underGap != null || overGap != null
  const geo = fanGeometry(size.laneW, size.cardW, under.length + backCount + cards.length + (hasGap ? 1 : 0))
  const angleOf = (slot: number) => Math.round((slot - geo.mid) * geo.stepDeg * 100) / 100 || 0

  let slot = 0
  const placedUnder = under.map((card, order) => {
    if (underGap != null && slot === underGap) slot++
    const angle = angleOf(slot)
    slot++
    return { card, angle, order }
  })
  if (underGap != null && slot === underGap) slot++

  const backSlot = slot
  if (leadingBack) slot++

  const overStart = slot
  const placedOver = cards.map((card, order) => {
    if (overGap != null && slot === overStart + overGap) slot++
    const angle = angleOf(slot)
    slot++
    return { card, angle, order }
  })

  const gapSlot = underGap != null ? underGap : overGap != null ? overStart + overGap : null
  const backZ = splitZoneId != null ? 10 + under.length : 1
  const overZBase = splitZoneId != null ? 10 + under.length + 1 : 10

  const laneStyle = { '--fan-radius': `${fanRadius(size.cardW)}px` } as CSSProperties
  const className = ['arena-fan', hasGap ? 'is-hot' : '', dealing ? 'is-dealing' : '', splitZoneId != null ? 'is-split' : ''].filter(Boolean).join(' ')

  return (
    <div className={className} data-arena-zone={zoneId} data-arena-split={splitZoneId}>
      <div className="arena-fan-probe" ref={probeRef} aria-hidden="true" />
      <div className="arena-fan-lane" ref={setLane} style={laneStyle} onPointerOver={onPointerOver} onPointerLeave={clearLift}>
        {placedUnder.map(({ card, angle, order }) => (
          <FanCard
            key={card.id as string}
            zoneId={splitZoneId ?? zoneId}
            side={splitZoneId}
            under
            card={card}
            angle={angle}
            zIndex={10 + order}
            dealDelay={dealing ? order * DEAL_STAGGER_MS : null}
            onPointerDown={onUnderCardPointerDown ?? onCardPointerDown}
          />
        ))}
        {leadingBack && (
          <div className="arena-fan-slot arena-fan-back" aria-hidden="true" style={{ rotate: `${angleOf(backSlot)}deg`, zIndex: backZ }}>
            <div className="arena-fan-card">
              <CardSlot card={leadingBack} cardId={`arena:${zoneId}:back`} faceDown />
            </div>
          </div>
        )}
        {gapSlot != null && <div className="arena-fan-slot arena-fan-gap" style={{ rotate: `${angleOf(gapSlot)}deg` }} />}
        {placedOver.map(({ card, angle, order }) => (
          <FanCard
            key={card.id as string}
            zoneId={zoneId}
            side={splitZoneId != null ? zoneId : undefined}
            card={card}
            angle={angle}
            zIndex={overZBase + order}
            dealDelay={dealing ? (under.length + order) * DEAL_STAGGER_MS : null}
            onPointerDown={onCardPointerDown}
          />
        ))}
      </div>
    </div>
  )
}
