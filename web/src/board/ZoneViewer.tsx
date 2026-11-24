import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { useEscape } from '../ui/useEscape'
import { useTranslation } from '../i18n'
import { overlayRoot } from './overlayRoot'
import { clampFanScroll, fanDrop, fanMaxScroll, fanRadius, fanSlot, fanWindow, scrollFromThumb, thumbLeft } from './zoneFan'
import './PileOverlay.css'

interface ZoneViewerProps {
  title: string
  count?: string
  subtitle?: ReactNode
  className?: string
  testId?: string
  itemCount: number
  onClose: () => void
  children: ReactNode
}

const THUMB_W = 52
const WHEEL_PER_CARD = 120

interface FanGeometry {
  cardW: number
  cardH: number
  roomW: number
}

function useFan(itemCount: number) {
  const fanRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [geo, setGeo] = useState<FanGeometry>({ cardW: 0, cardH: 0, roomW: 0 })
  const [scroll, setScroll] = useState(0)

  useLayoutEffect(() => {
    const fan = fanRef.current
    if (!fan) return
    const measure = () => {
      const item = fan.querySelector<HTMLElement>('.zone-fan-item')
      const next = { cardW: item?.offsetWidth ?? 0, cardH: item?.offsetHeight ?? 0, roomW: fan.clientWidth }
      setGeo((prev) => (prev.cardW === next.cardW && prev.cardH === next.cardH && prev.roomW === next.roomW ? prev : next))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(fan)
    const item = fan.querySelector<HTMLElement>('.zone-fan-item')
    if (item) observer.observe(item)
    return () => observer.disconnect()
  }, [itemCount])

  const visible = fanWindow(itemCount, geo.cardW, geo.roomW)
  const maxScroll = fanMaxScroll(itemCount, visible)
  const current = clampFanScroll(scroll, itemCount, visible)

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return
    const items = Array.from(track.children).filter((child) => child.classList.contains('zone-fan-item')) as HTMLElement[]
    const last = Math.ceil(current) + visible - 1
    items.forEach((el, index) => {
      const slot = fanSlot(index, current, visible)
      el.style.setProperty('--fan-rot', `${slot.angleDeg}deg`)
      el.style.zIndex = String(index > last ? items.length - index : items.length + index + 1)
      el.classList.toggle('is-piled', slot.piled)
      el.classList.toggle('is-off-fan', !slot.shown && !slot.piled)
    })
  })

  useEffect(() => {
    const fan = fanRef.current
    if (!fan || maxScroll <= 0) return
    const onWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
      if (delta === 0) return
      e.preventDefault()
      setScroll((s) => clampFanScroll(clampFanScroll(s, itemCount, visible) + delta / WHEEL_PER_CARD, itemCount, visible))
    }
    fan.addEventListener('wheel', onWheel, { passive: false })
    return () => fan.removeEventListener('wheel', onWheel)
  }, [itemCount, visible, maxScroll])

  const measured = geo.cardW > 0
  const style = measured
    ? ({
        '--fan-card-w': `${geo.cardW}px`,
        '--fan-radius': `${Math.round(fanRadius(geo.cardW))}px`,
        '--fan-height': `${Math.ceil(geo.cardH + fanDrop(geo.cardW, visible, visible < itemCount))}px`,
      } as CSSProperties)
    : undefined

  const scrollTo = useCallback((value: number) => setScroll(clampFanScroll(value, itemCount, visible)), [itemCount, visible])

  return { fanRef, trackRef, style, measured, scroll: current, maxScroll, scrollTo }
}

function useHoverLift(fanRef: RefObject<HTMLDivElement | null>, scroll: number) {
  const current = useRef<{ item: HTMLElement; clone: HTMLElement } | null>(null)

  const clear = useCallback(() => {
    if (!current.current) return
    current.current.item.classList.remove('is-lifted')
    current.current.clone.remove()
    current.current = null
  }, [])

  const onPointerOver = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.zone-fan-item')
    if (item?.classList.contains('is-piled')) {
      clear()
      return
    }
    if (!item || item.classList.contains('zone-fan-lift') || current.current?.item === item) return
    clear()
    const fan = fanRef.current
    if (!fan) return
    const clone = item.cloneNode(true) as HTMLElement
    for (const el of [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))]) {
      el.removeAttribute('data-testid')
      el.removeAttribute('data-card-id')
      el.removeAttribute('data-card-name')
      el.removeAttribute('id')
    }
    clone.className = `${item.className} zone-fan-lift`
    clone.setAttribute('aria-hidden', 'true')
    clone.style.zIndex = '9999'
    fan.appendChild(clone)
    item.classList.add('is-lifted')
    current.current = { item, clone }
  }, [clear, fanRef])

  useEffect(() => clear, [clear])
  useEffect(() => clear(), [scroll, clear])

  return { onPointerOver, clear }
}

function FanScrollbar({ scroll, maxScroll, onScroll, label }: { scroll: number; maxScroll: number; onScroll: (value: number) => void; label: string }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointerX: number; left: number } | null>(null)
  const [trackW, setTrackW] = useState(0)

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return
    setTrackW(track.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setTrackW(track.clientWidth))
    observer.observe(track)
    return () => observer.disconnect()
  }, [])

  const left = thumbLeft(scroll, maxScroll, trackW, THUMB_W)
  const active = maxScroll > 0

  const onThumbDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { pointerX: e.clientX, left }
  }

  const onThumbMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    onScroll(scrollFromThumb(drag.current.left + e.clientX - drag.current.pointerX, maxScroll, trackW, THUMB_W))
  }

  const onThumbUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    drag.current = null
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    onScroll(Math.round(scroll))
  }

  const onTrackDown = (e: PointerEvent<HTMLDivElement>) => {
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
    <div ref={trackRef} className={`zone-fan-scrollbar${active ? '' : ' is-idle'}`} onPointerDown={onTrackDown} aria-hidden={!active}>
      <div
        className="zone-fan-thumb"
        role="scrollbar"
        aria-label={label}
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={maxScroll}
        aria-valuenow={Math.round(scroll)}
        tabIndex={active ? 0 : -1}
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

export default function ZoneViewer({
  title,
  count,
  subtitle,
  className = '',
  testId,
  itemCount,
  onClose,
  children,
}: ZoneViewerProps) {
  const { t } = useTranslation()
  const fan = useFan(itemCount)
  const lift = useHoverLift(fan.fanRef, fan.scroll)
  useEscape(onClose)

  const onPileClick = (e: MouseEvent<HTMLDivElement>) => {
    const pile = (e.target as HTMLElement).closest<HTMLElement>('.zone-fan-item.is-piled')
    const track = fan.trackRef.current
    if (!pile || !track) return
    e.preventDefault()
    e.stopPropagation()
    const index = Array.from(track.children).indexOf(pile)
    fan.scrollTo(Math.round(fan.scroll) + (index < fan.scroll ? -1 : 1))
  }

  return createPortal(
    <div className="pile-overlay-backdrop" onClick={onClose} data-space-shortcut-off="true">
      <div
        className={`pile-overlay zone-viewer ${className}`.trim()}
        data-testid={testId}
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pile-overlay-header">
          <h3 className="zone-viewer-title">{title}</h3>
          {count && <span className="zone-viewer-count">{count}</span>}
          {subtitle && <span className="pile-header-subtitle">{subtitle}</span>}
        </header>
        <div
          ref={fan.fanRef}
          className={`pile-overlay-scroll zone-fan${fan.measured ? ' is-measured' : ''}`}
          style={fan.style}
          onPointerOver={lift.onPointerOver}
          onPointerLeave={lift.clear}
          onClickCapture={onPileClick}
        >
          <div ref={fan.trackRef} className="zone-fan-track">{children}</div>
        </div>
        <FanScrollbar scroll={fan.scroll} maxScroll={fan.maxScroll} onScroll={fan.scrollTo} label={title} />
        <footer className="zone-viewer-footer">
          <Button
            variant="primary"
            size="lg"
            className="pile-overlay-close zone-viewer-done"
            onClick={onClose}
            title={`${t('common', 'close')} (Esc)`}
          >
            {t('common', 'done')}
          </Button>
        </footer>
      </div>
    </div>,
    overlayRoot(),
  )
}
