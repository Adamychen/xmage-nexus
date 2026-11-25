import { createElement as h, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode, type RefObject } from 'react'
import CardSlot from '../../board/CardSlot'
import { fxMotionAllowed } from '../../board/fx'
import type { CardView } from '../../net/types'
import { fanIndexAt, fanSplitAt } from './ArenaFan'
import './ArenaFan.css'

export interface FanDrag {
  id: string
  from: string
  started: boolean
}

export interface FanHover {
  zone: string
  index: number
}

interface Physics {
  pointerId: number
  px: number
  py: number
  startX: number
  startY: number
  offX: number
  offY: number
  cardW: number
  lastX: number
  lastY: number
  vx: number
  vy: number
  rx: number
  ry: number
  rz: number
}

interface FanDragOptions {
  zones: string[]
  canDrag: boolean
  onDrop: (id: string, zone: string, index: number) => void
  onClick: (id: string, from: string) => void
}

export interface FanDragRoot {
  ref: RefObject<HTMLDivElement | null>
  onPointerMove: (e: PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: PointerEvent<HTMLDivElement>) => void
  onPointerCancel: (e: PointerEvent<HTMLDivElement>) => void
  onLostPointerCapture: (e: PointerEvent<HTMLDivElement>) => void
}

export interface FanDragApi {
  drag: FanDrag | null
  hover: FanHover | null
  bindRoot: FanDragRoot
  startDrag: (e: PointerEvent, id: string, from: string) => void
  dragLayer: (card: CardView | null) => ReactNode
}

const DRAG_THRESHOLD = 4
const LIFT_SCALE = 0.82
const HIT_PAD = 36
const EDGE_SCROLL_PAD = 72
const EDGE_SCROLL_SPEED = 0.14
const FLIGHT = 'transform 360ms cubic-bezier(.2, 1.15, .4, 1)'

let dragSeq = 0

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function byAttr(root: HTMLElement | null, attr: string, value: string): HTMLElement | null {
  if (!root) return null
  return Array.from(root.querySelectorAll<HTMLElement>(`[${attr}]`)).find((el) => el.getAttribute(attr) === value) ?? null
}

export function useFanDrag({ zones, canDrag, onDrop, onClick }: FanDragOptions): FanDragApi {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [drag, setDrag] = useState<FanDrag | null>(null)
  const [hover, setHover] = useState<FanHover | null>(null)
  const dragRef = useRef<FanDrag | null>(null)
  const hoverRef = useRef<FanHover | null>(null)
  const physics = useRef<Physics | null>(null)
  const landing = useRef<{ id: string; x: number; y: number } | null>(null)
  const dragElRef = useRef<HTMLDivElement | null>(null)
  const dragCardRef = useRef<HTMLDivElement | null>(null)
  const dragIdRef = useRef(0)
  const zonesRef = useRef(zones)

  useLayoutEffect(() => {
    zonesRef.current = zones
  })

  const commitDrag = (next: FanDrag | null) => {
    dragRef.current = next
    setDrag(next)
  }

  const commitHover = (next: FanHover | null) => {
    const prev = hoverRef.current
    if (prev?.zone === next?.zone && prev?.index === next?.index) return
    hoverRef.current = next
    setHover(next)
  }

  const paintDrag = () => {
    const p = physics.current
    const el = dragElRef.current
    const card = dragCardRef.current
    if (!p || !el || !card) return
    el.style.transform = `translate3d(${p.px - p.offX}px, ${p.py - p.offY}px, 0)`
    card.style.transform = `perspective(1000px) rotateX(${p.rx}deg) rotateY(${p.ry}deg) rotateZ(${p.rz}deg) scale(${LIFT_SCALE})`
    card.style.setProperty('--gx', `${50 + p.ry * 1.6}%`)
    card.style.setProperty('--gy', `${40 - p.rx * 1.6}%`)
    card.style.setProperty('--speed', `${Math.min(1, Math.hypot(p.vx, p.vy) / 30)}`)
  }

  useLayoutEffect(() => {
    rootRef.current?.classList.toggle('is-arena-dragging', !!drag?.started)
    if (drag?.started) paintDrag()
  })

  useEffect(() => {
    if (!drag?.started) return
    let raf = 0
    const loop = () => {
      const p = physics.current
      if (p) {
        const dx = p.px - p.lastX
        const dy = p.py - p.lastY
        p.lastX = p.px
        p.lastY = p.py
        p.vx += (dx - p.vx) * 0.35
        p.vy += (dy - p.vy) * 0.35
        p.ry += (clamp(p.vx * 1.8, -34, 34) - p.ry) * 0.3
        p.rx += (clamp(-p.vy * 1.6, -28, 28) - p.rx) * 0.3
        p.rz += (clamp(-p.vx * 0.5, -12, 12) - p.rz) * 0.25
        paintDrag()
        for (const zone of zonesRef.current) {
          const fan = byAttr(rootRef.current, 'data-arena-zone', zone)
          if (!fan || !fan.hasAttribute('data-arena-max-scroll')) continue
          const b = fan.getBoundingClientRect()
          if (p.py < b.top - HIT_PAD || p.py > b.bottom + HIT_PAD) continue
          if (p.px < b.left + EDGE_SCROLL_PAD && p.px > b.left - HIT_PAD) {
            fan.dispatchEvent(new CustomEvent('arena-fan-scroll', { detail: { delta: -EDGE_SCROLL_SPEED } }))
          } else if (p.px > b.right - EDGE_SCROLL_PAD && p.px < b.right + HIT_PAD) {
            fan.dispatchEvent(new CustomEvent('arena-fan-scroll', { detail: { delta: EDGE_SCROLL_SPEED } }))
          }
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [drag?.started])

  useLayoutEffect(() => {
    const land = landing.current
    if (!land) return
    landing.current = null
    if (!fxMotionAllowed()) return
    const inner = byAttr(rootRef.current, 'data-arena-card', land.id)?.querySelector<HTMLElement>('.arena-fan-land')
    if (!inner) return
    const r = inner.getBoundingClientRect()
    inner.style.transition = 'none'
    inner.style.transform = `translate(${land.x - (r.left + r.width / 2)}px, ${land.y - (r.top + r.height / 2)}px)`
    void inner.offsetWidth
    inner.style.transition = FLIGHT
    inner.style.transform = ''
  })

  const hitTest = (x: number, y: number, draggedId: string, cardW: number): FanHover | null => {
    for (const zone of zones) {
      const fan = byAttr(rootRef.current, 'data-arena-zone', zone)
      const lane = fan?.querySelector<HTMLElement>('.arena-fan-lane')
      if (!fan || !lane) continue
      const b = fan.getBoundingClientRect()
      if (x < b.left - HIT_PAD || x > b.right + HIT_PAD || y < b.top - HIT_PAD * 2 || y > b.bottom + HIT_PAD * 2) continue
      const cards = Array.from(lane.querySelectorAll('[data-arena-card]')).filter((el) => el.getAttribute('data-arena-card') !== draggedId)
      const splitZone = fan.getAttribute('data-arena-split')
      if (splitZone) {
        const underCount = cards.filter((el) => el.getAttribute('data-arena-side') === splitZone).length
        const overCount = cards.length - underCount
        const hit = fanSplitAt(x, lane.getBoundingClientRect(), cardW, underCount, overCount)
        return { zone: hit.side === 'under' ? splitZone : zone, index: hit.index }
      }
      const leading = lane.querySelector('.arena-fan-back') != null
      const scrollAttr = fan.getAttribute('data-arena-scroll')
      const visibleAttr = fan.getAttribute('data-arena-visible')
      const scroll = scrollAttr != null ? Number(scrollAttr) : 0
      const visible = visibleAttr != null ? Number(visibleAttr) : undefined
      return { zone, index: fanIndexAt(x, lane.getBoundingClientRect(), cardW, cards.length, leading, scroll, visible) }
    }
    return null
  }

  const endDrag = () => {
    physics.current = null
    hoverRef.current = null
    commitDrag(null)
    setHover(null)
  }

  const startDrag = (e: PointerEvent, id: string, from: string) => {
    if (e.button !== 0 || !canDrag || dragRef.current) return
    const face = byAttr(rootRef.current, 'data-arena-card', id)?.querySelector('.arena-fan-card')
    if (!face) return
    e.preventDefault()
    const r = face.getBoundingClientRect()
    try {
      rootRef.current?.setPointerCapture?.(e.pointerId)
    } catch {
      return
    }
    physics.current = {
      pointerId: e.pointerId,
      px: e.clientX,
      py: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      offX: clamp(e.clientX - r.left, 0, r.width),
      offY: clamp(e.clientY - r.top, 0, r.height),
      cardW: r.width,
      lastX: e.clientX,
      lastY: e.clientY,
      vx: 0,
      vy: 0,
      rx: 0,
      ry: 0,
      rz: 0,
    }
    dragIdRef.current = ++dragSeq
    commitDrag({ id, from, started: false })
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    const p = physics.current
    if (!d || !p || e.pointerId !== p.pointerId) return
    p.px = e.clientX
    p.py = e.clientY
    const moved = Math.hypot(p.px - p.startX, p.py - p.startY) > DRAG_THRESHOLD
    if (!d.started && moved) commitDrag({ ...d, started: true })
    if (d.started || moved) {
      paintDrag()
      commitHover(hitTest(p.px, p.py, d.id, p.cardW))
    }
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    const p = physics.current
    if (!d || !p || e.pointerId !== p.pointerId) return
    if (!d.started) {
      const face = byAttr(rootRef.current, 'data-arena-card', d.id)?.querySelector('.arena-fan-card')
      if (face) {
        const r = face.getBoundingClientRect()
        landing.current = { id: d.id, x: r.left + r.width / 2, y: r.top + r.height / 2 }
      }
      endDrag()
      onClick(d.id, d.from)
      return
    }
    const target = hitTest(p.px, p.py, d.id, p.cardW)
    endDrag()
    if (target) onDrop(d.id, target.zone, target.index)
  }

  const onPointerCancel = (e: PointerEvent<HTMLDivElement>) => {
    if (physics.current?.pointerId === e.pointerId && dragRef.current) endDrag()
  }

  const dragLayer = (card: CardView | null): ReactNode => {
    if (!card || !drag?.started) return null
    return h(
      'div',
      { className: `arena-drag${hover ? ' is-over-target' : ''}`, ref: dragElRef },
      h(
        'div',
        { className: 'arena-drag-card', ref: dragCardRef },
        h(CardSlot, { card, cardId: `arena:drag:${card.id as string}:${dragIdRef.current}` }),
        h('div', { className: 'arena-drag-glare' }),
      ),
    )
  }

  return {
    drag,
    hover,
    bindRoot: { ref: rootRef, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture: onPointerCancel },
    startDrag,
    dragLayer,
  }
}
