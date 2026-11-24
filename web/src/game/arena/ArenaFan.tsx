import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import CardSlot from '../../board/CardSlot'
import Icon from '../../ui/Icon'
import {
  clampFanScroll,
  FAN_SLICE,
  FAN_STEP_DEG,
  fanMaxScroll,
  fanRadius,
  fanSlot,
  fanWindow,
  scrollFromThumb,
  thumbLeft,
} from '../../board/zoneFan'
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
  /** Open slid to the rightmost cards (e.g. trigger order where First is on the right). */
  startAtEnd?: boolean
  onCardPointerDown: (e: PointerEvent, id: string) => void
  onUnderCardPointerDown?: (e: PointerEvent, id: string) => void
  onCardHover?: (id: string) => void
  onCardContextMenu?: (e: MouseEvent, id: string) => void
  renderCard?: (card: CardView, order: number) => ReactNode
  renderOverlay?: (card: CardView, order: number) => ReactNode
  laneRef: (el: HTMLDivElement | null) => void
}

const FALLBACK_LANE_W = 600
const FALLBACK_CARD_W = 170
const DEAL_STAGGER_MS = 80
const MIN_SLICE = 0.18
const THUMB_W = 52
const WHEEL_PER_CARD = 120

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

export function fanIndexAt(
  x: number,
  lane: DOMRect,
  cardW: number,
  count: number,
  leading: boolean,
  scroll = 0,
  visible?: number,
): number {
  const first = leading ? 1 : 0
  const total = count + 1 + first
  const windowSlots = visible != null && visible < total ? visible : total
  const w = cardW > 0 ? cardW : FALLBACK_CARD_W
  const geo = visible != null && visible < total
    ? { mid: (windowSlots - 1) / 2, slicePx: w * FAN_SLICE, stepDeg: FAN_STEP_DEG }
    : fanGeometry(lane.width, cardW, total)
  const slot = Math.ceil((x - (lane.left + lane.width / 2)) / geo.slicePx + geo.mid - 0.5) + Math.round(scroll)
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
  piled?: boolean
  offFan?: boolean
  card: CardView
  angle: number
  zIndex: number
  dealDelay: number | null
  customCard?: ReactNode
  overlay?: ReactNode
  onPointerDown: (e: PointerEvent, id: string) => void
  onContextMenu?: (e: MouseEvent, id: string) => void
}

function FanCard({ zoneId, side, under, piled, offFan, card, angle, zIndex, dealDelay, customCard, overlay, onPointerDown, onContextMenu }: FanCardProps) {
  const [version] = useState(() => ++versionSeq)
  const id = card.id as string
  const className = [
    'arena-fan-slot',
    under ? 'is-under' : '',
    piled ? 'is-piled' : '',
    offFan ? 'is-off-fan' : '',
  ].filter(Boolean).join(' ')
  return (
    <div
      className={className}
      data-arena-card={id}
      data-arena-side={side}
      style={{ rotate: `${angle}deg`, zIndex }}
    >
      <div className="arena-fan-land">
        <div
          className="arena-fan-card"
          style={dealDelay != null ? { animationDelay: `${dealDelay}ms` } : undefined}
          onPointerDown={(e) => onPointerDown(e, id)}
          onContextMenu={onContextMenu ? (e) => onContextMenu(e, id) : undefined}
        >
          {customCard ?? <CardSlot card={card} cardId={`arena:${zoneId}:${id}:${version}`} />}
          {overlay}
        </div>
      </div>
    </div>
  )
}

function ArenaFanScrollbar({
  scroll,
  maxScroll,
  onScroll,
}: {
  scroll: number
  maxScroll: number
  onScroll: (next: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [trackW, setTrackW] = useState(0)
  const drag = useRef<{ pointerId: number; startX: number; startLeft: number } | null>(null)

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return
    const measure = () => setTrackW(track.clientWidth)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    return () => observer.disconnect()
  }, [])

  const left = thumbLeft(scroll, maxScroll, trackW, THUMB_W)

  const onThumbDown = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { pointerId: e.pointerId, startX: e.clientX, startLeft: left }
  }

  const onThumbMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointerId !== e.pointerId) return
    onScroll(scrollFromThumb(drag.current.startLeft + (e.clientX - drag.current.startX), maxScroll, trackW, THUMB_W))
  }

  const onThumbUp = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === e.pointerId) drag.current = null
  }

  const onTrackDown = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const track = trackRef.current
    if (!track) return
    onScroll(Math.round(scrollFromThumb(e.clientX - track.getBoundingClientRect().left - THUMB_W / 2, maxScroll, trackW, THUMB_W)))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') onScroll(Math.round(scroll) - 1)
    else if (e.key === 'ArrowRight') onScroll(Math.round(scroll) + 1)
    else if (e.key === 'Home') onScroll(0)
    else if (e.key === 'End') onScroll(maxScroll)
    else return
    e.preventDefault()
  }

  return (
    <div ref={trackRef} className="arena-fan-scrollbar" data-testid="arena-fan-scrollbar" onPointerDown={onTrackDown}>
      <div
        className="arena-fan-thumb"
        role="scrollbar"
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={maxScroll}
        aria-valuenow={Math.round(scroll)}
        tabIndex={0}
        style={{ translate: `${left}px 0`, width: THUMB_W }}
        onPointerDown={onThumbDown}
        onPointerMove={onThumbMove}
        onPointerUp={onThumbUp}
        onPointerCancel={onThumbUp}
        onKeyDown={onKeyDown}
      >
        <Icon name="chevronLeft" size={12} />
        <Icon name="chevronRight" size={12} />
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
  startAtEnd = false,
  onCardPointerDown,
  onUnderCardPointerDown,
  onCardHover,
  onCardContextMenu,
  renderCard,
  renderOverlay,
  laneRef,
}: ArenaFanProps) {
  const rootEl = useRef<HTMLDivElement | null>(null)
  const laneEl = useRef<HTMLDivElement | null>(null)
  const probeRef = useRef<HTMLDivElement>(null)
  const laneRefLatest = useRef(laneRef)
  laneRefLatest.current = laneRef
  const liftRef = useRef<{ slot: HTMLElement; clone: HTMLElement } | null>(null)
  const [size, setSize] = useState({ laneW: FALLBACK_LANE_W, cardW: FALLBACK_CARD_W })
  const [scroll, setScroll] = useState(startAtEnd ? Number.POSITIVE_INFINITY : 0)

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
  const backCount = leadingBack ? 1 : 0
  const underGap = underGapIndex == null ? null : clamp(underGapIndex, 0, under.length)
  const overGap = underGap == null && gapIndex != null ? clamp(gapIndex, 0, cards.length) : null
  const hasGap = underGap != null || overGap != null
  const totalSlots = under.length + backCount + cards.length + (hasGap ? 1 : 0)

  const visible = splitZoneId != null ? totalSlots : fanWindow(totalSlots, size.cardW, size.laneW)
  const maxScroll = fanMaxScroll(totalSlots, visible)
  const currentScroll = clampFanScroll(scroll, totalSlots, visible)
  const scrollable = maxScroll > 0

  const scrollTo = useCallback(
    (next: number) => setScroll(clampFanScroll(next, totalSlots, visible)),
    [totalSlots, visible],
  )

  useEffect(() => {
    const lane = laneEl.current
    if (!lane || !scrollable) return
    const onWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
      if (delta === 0) return
      e.preventDefault()
      setScroll((s) => clampFanScroll(clampFanScroll(s, totalSlots, visible) + delta / WHEEL_PER_CARD, totalSlots, visible))
    }
    lane.addEventListener('wheel', onWheel, { passive: false })
    return () => lane.removeEventListener('wheel', onWheel)
  }, [scrollable, totalSlots, visible])

  useEffect(() => {
    const root = rootEl.current
    if (!root || !scrollable) return
    const onEdgeScroll = (e: Event) => {
      const delta = (e as CustomEvent<{ delta?: number }>).detail?.delta ?? 0
      if (!delta) return
      setScroll((s) => clampFanScroll(clampFanScroll(s, totalSlots, visible) + delta, totalSlots, visible))
    }
    root.addEventListener('arena-fan-scroll', onEdgeScroll)
    return () => root.removeEventListener('arena-fan-scroll', onEdgeScroll)
  }, [scrollable, totalSlots, visible])

  const makeLiftClone = useCallback((slot: HTMLElement, animate: boolean) => {
    const clone = slot.cloneNode(true) as HTMLElement
    for (const el of [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))]) {
      el.removeAttribute('data-arena-card')
      el.removeAttribute('data-card-id')
      el.removeAttribute('data-card-name')
      el.removeAttribute('data-testid')
      el.removeAttribute('id')
    }
    clone.classList.remove('is-lifted')
    clone.classList.add('arena-lift')
    if (!animate) clone.classList.add('is-settled')
    clone.setAttribute('aria-hidden', 'true')
    clone.style.zIndex = '9999'
    return clone
  }, [])

  const idsKey = [...under, ...cards].map((c) => c.id as string).join('|')
  useLayoutEffect(() => clearLift, [clearLift])
  useLayoutEffect(() => clearLift(), [idsKey, gapIndex, underGapIndex, currentScroll, clearLift])

  // Keep the lifted visual clone in sync when a hovered card re-renders (e.g. selected glow on click).
  useLayoutEffect(() => {
    const lift = liftRef.current
    if (!lift || !lift.slot.isConnected) return
    const next = makeLiftClone(lift.slot, false)
    lift.clone.replaceWith(next)
    lift.clone = next
  })

  const onPointerOver = (e: PointerEvent<HTMLDivElement>) => {
    const slot = (e.target as HTMLElement).closest<HTMLElement>('.arena-fan-slot[data-arena-card]')
    if (!slot || slot.classList.contains('is-piled') || slot.classList.contains('is-off-fan')) {
      clearLift()
      return
    }
    if (liftRef.current?.slot === slot) return
    const hoveredId = slot.getAttribute('data-arena-card')
    if (hoveredId) onCardHover?.(hoveredId)
    clearLift()
    const clone = makeLiftClone(slot, true)
    slot.parentElement?.appendChild(clone)
    slot.classList.add('is-lifted')
    liftRef.current = { slot, clone }
  }

  const geo = fanGeometry(size.laneW, size.cardW, totalSlots)
  const slotLayout = (idx: number) => {
    if (scrollable) {
      const s = fanSlot(idx, currentScroll, visible)
      return { angle: s.angleDeg, piled: s.piled, offFan: !s.shown && !s.piled }
    }
    const angle = Math.round((idx - geo.mid) * geo.stepDeg * 100) / 100 || 0
    return { angle, piled: false, offFan: false }
  }

  let slot = 0
  const placedUnder = under.map((card, order) => {
    if (underGap != null && slot === underGap) slot++
    const layout = slotLayout(slot)
    const slotIndex = slot
    slot++
    return { card, ...layout, order, slotIndex }
  })
  if (underGap != null && slot === underGap) slot++

  const backSlot = slot
  if (leadingBack) slot++

  const overStart = slot
  const placedOver = cards.map((card, order) => {
    if (overGap != null && slot === overStart + overGap) slot++
    const layout = slotLayout(slot)
    const slotIndex = slot
    slot++
    return { card, ...layout, order, slotIndex }
  })

  const gapSlot = underGap != null ? underGap : overGap != null ? overStart + overGap : null
  const backZ = splitZoneId != null ? 10 + under.length : 1
  const overZBase = splitZoneId != null ? 10 + under.length + 1 : 10
  const lastVisible = Math.ceil(currentScroll) + visible - 1
  const zFor = (slotIndex: number, fallback: number) =>
    scrollable && slotIndex > lastVisible ? Math.max(1, totalSlots - slotIndex) : fallback

  const handleCardPointerDown = (e: PointerEvent, id: string, piled: boolean, slotIndex: number, handler: (e: PointerEvent, id: string) => void) => {
    if (piled) {
      e.preventDefault()
      e.stopPropagation()
      scrollTo(Math.round(currentScroll) + (slotIndex < currentScroll ? -1 : 1))
      return
    }
    handler(e, id)
  }

  const laneStyle = { '--fan-radius': `${fanRadius(size.cardW)}px` } as CSSProperties
  const className = [
    'arena-fan',
    hasGap ? 'is-hot' : '',
    dealing ? 'is-dealing' : '',
    splitZoneId != null ? 'is-split' : '',
    scrollable ? 'is-scrollable' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      ref={rootEl}
      className={className}
      data-arena-zone={zoneId}
      data-arena-split={splitZoneId}
      data-arena-scroll={scrollable ? currentScroll : undefined}
      data-arena-visible={scrollable ? visible : undefined}
      data-arena-max-scroll={scrollable ? maxScroll : undefined}
    >
      <div className="arena-fan-probe" ref={probeRef} aria-hidden="true" />
      <div className="arena-fan-lane" ref={setLane} style={laneStyle} onPointerOver={onPointerOver} onPointerLeave={clearLift}>
        {placedUnder.map(({ card, angle, piled, offFan, order, slotIndex }) => (
          <FanCard
            key={card.id as string}
            zoneId={splitZoneId ?? zoneId}
            side={splitZoneId}
            under
            piled={piled}
            offFan={offFan}
            card={card}
            angle={angle}
            zIndex={zFor(slotIndex, 10 + order)}
            dealDelay={dealing ? order * DEAL_STAGGER_MS : null}
            onPointerDown={(e, id) => handleCardPointerDown(e, id, piled, slotIndex, onUnderCardPointerDown ?? onCardPointerDown)}
          />
        ))}
        {leadingBack && (
          <div className="arena-fan-slot arena-fan-back" aria-hidden="true" style={{ rotate: `${slotLayout(backSlot).angle}deg`, zIndex: backZ }}>
            <div className="arena-fan-card">
              <CardSlot card={leadingBack} cardId={`arena:${zoneId}:back`} faceDown />
            </div>
          </div>
        )}
        {gapSlot != null && <div className="arena-fan-slot arena-fan-gap" style={{ rotate: `${slotLayout(gapSlot).angle}deg` }} />}
        {placedOver.map(({ card, angle, piled, offFan, order, slotIndex }) => (
          <FanCard
            key={card.id as string}
            zoneId={zoneId}
            side={splitZoneId != null ? zoneId : undefined}
            piled={piled}
            offFan={offFan}
            card={card}
            angle={angle}
            zIndex={zFor(slotIndex, overZBase + order)}
            dealDelay={dealing ? (under.length + order) * DEAL_STAGGER_MS : null}
            customCard={renderCard?.(card, order)}
            overlay={renderOverlay?.(card, order)}
            onPointerDown={(e, id) => handleCardPointerDown(e, id, piled, slotIndex, onCardPointerDown)}
            onContextMenu={onCardContextMenu}
          />
        ))}
      </div>
      {scrollable && <ArenaFanScrollbar scroll={currentScroll} maxScroll={maxScroll} onScroll={scrollTo} />}
    </div>
  )
}
