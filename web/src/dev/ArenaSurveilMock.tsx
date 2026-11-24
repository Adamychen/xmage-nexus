import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import CardSlot from '../board/CardSlot'
import { FAN_SLICE, FAN_STEP_DEG, fanRadius } from '../board/zoneFan'
import type { CardView } from '../net/types'
import './ArenaSurveilMock.css'

export type ArenaMockMode = 'surveil' | 'scry'

type ZoneId = 'top' | 'away'

interface Drag {
  id: string
  from: ZoneId
  started: boolean
}

interface Physics {
  pointerId: number
  px: number
  py: number
  startX: number
  startY: number
  offX: number
  offY: number
  lastX: number
  lastY: number
  vx: number
  vy: number
  rx: number
  ry: number
  rz: number
  scale: number
}

interface Hover {
  zone: ZoneId
  index: number
}

interface FanGeometry {
  mid: number
  stepDeg: number
  slicePx: number
}

const MOCK_CARDS: CardView[] = [
  { id: 'asv-1', name: 'Lightning Bolt', expansionSetCode: 'M10', cardNumber: '146', cardTypes: ['Instant'] } as unknown as CardView,
  { id: 'asv-2', name: 'Counterspell', expansionSetCode: 'MH2', cardNumber: '267', cardTypes: ['Instant'] } as unknown as CardView,
  { id: 'asv-3', name: 'Forest', expansionSetCode: 'M21', cardNumber: '277', cardTypes: ['Land'] } as unknown as CardView,
  { id: 'asv-4', name: 'Elvish Mystic', expansionSetCode: 'M14', cardNumber: '169', cardTypes: ['Creature'] } as unknown as CardView,
]

const SOURCE: CardView = { id: 'asv-src', name: 'Nightveil Sprite', expansionSetCode: 'GRN', cardNumber: '48', cardTypes: ['Creature'] } as unknown as CardView

const DRAG_THRESHOLD = 4
const LIFT_SCALE = 1.12
const DEAL_MS = 900

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function fanGeometry(zone: ZoneId, width: number, cardW: number, cards: number): FanGeometry {
  const slots = cards + (zone === 'top' ? 1 : 0)
  const mid = (slots - 1) / 2
  const room = slots > 1 ? (width - cardW) / (slots - 1) : cardW
  const slicePx = Math.max(cardW * 0.18, Math.min(cardW * FAN_SLICE, room))
  const stepDeg = FAN_STEP_DEG * (slicePx / (cardW * FAN_SLICE))
  return { mid, stepDeg, slicePx }
}

export default function ArenaSurveilMock({ mode, count = 3 }: { mode: ArenaMockMode; count?: number }) {
  const cards = MOCK_CARDS.slice(0, count)
  const byId = new Map(cards.map((c) => [c.id as string, c]))
  const [zones, setZones] = useState<Record<ZoneId, string[]>>(() => ({ top: cards.map((c) => c.id as string), away: [] }))
  const [drag, setDrag] = useState<Drag | null>(null)
  const [hover, setHover] = useState<Hover | null>(null)
  const [sizes, setSizes] = useState<Record<ZoneId, number>>({ top: 600, away: 600 })
  const [cardW, setCardW] = useState(170)
  const [peek, setPeek] = useState(false)
  const [sent, setSent] = useState(false)
  const [dealing, setDealing] = useState(true)
  const [dealKey, setDealKey] = useState(0)
  const [versions, setVersions] = useState<Record<string, number>>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const zoneRefs = useRef<Record<ZoneId, HTMLDivElement | null>>({ top: null, away: null })
  const cardRefs = useRef(new Map<string, HTMLDivElement>())
  const landing = useRef<{ id: string; x: number; y: number } | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const physics = useRef<Physics | null>(null)
  const hoverRef = useRef<Hover | null>(null)
  const liftRef = useRef<{ slot: HTMLElement; clone: HTMLElement } | null>(null)
  const dragElRef = useRef<HTMLDivElement>(null)
  const dragCardRef = useRef<HTMLDivElement>(null)
  const probeRef = useRef<HTMLDivElement>(null)
  dragRef.current = drag

  const awayLabel = mode === 'surveil' ? 'Graveyard' : 'Bottom of Library'
  const cardH = cardW * 1.39344
  const radius = fanRadius(cardW)

  useLayoutEffect(() => {
    const measure = () => {
      setSizes({ top: zoneRefs.current.top?.clientWidth ?? 600, away: zoneRefs.current.away?.clientWidth ?? 600 })
      const w = probeRef.current?.offsetWidth ?? 0
      if (w > 0) setCardW(w)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    setDealing(true)
    const done = window.setTimeout(() => setDealing(false), DEAL_MS)
    return () => window.clearTimeout(done)
  }, [dealKey])

  const paintDrag = () => {
    const p = physics.current
    const el = dragElRef.current
    const card = dragCardRef.current
    if (!p || !el || !card) return
    el.style.transform = `translate3d(${p.px - p.offX}px, ${p.py - p.offY}px, 0)`
    card.style.transform = `perspective(1000px) rotateX(${p.rx}deg) rotateY(${p.ry}deg) rotateZ(${p.rz}deg) scale(${p.scale})`
    card.style.setProperty('--gx', `${50 + p.ry * 1.6}%`)
    card.style.setProperty('--gy', `${40 - p.rx * 1.6}%`)
    card.style.setProperty('--speed', `${Math.min(1, Math.hypot(p.vx, p.vy) / 30)}`)
  }

  useLayoutEffect(() => {
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
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [drag?.started])

  const hitTest = useCallback(
    (x: number, y: number, draggedId: string): Hover | null => {
      for (const zone of ['top', 'away'] as ZoneId[]) {
        const el = zoneRefs.current[zone]
        const box = el?.closest('.asv-box')
        if (!el || !box) continue
        const b = box.getBoundingClientRect()
        const pad = 36
        if (x < b.left - pad || x > b.right + pad || y < b.top - pad * 2 || y > b.bottom + pad * 2) continue
        const r = el.getBoundingClientRect()
        const remaining = zones[zone].filter((id) => id !== draggedId)
        const geo = fanGeometry(zone, r.width, cardW, remaining.length + 1)
        const slot = Math.round((x - (r.left + r.width / 2)) / geo.slicePx + geo.mid)
        const first = zone === 'top' ? 1 : 0
        return { zone, index: clamp(slot - first, 0, remaining.length) }
      }
      return null
    },
    [zones, cardW],
  )

  const moveCard = (id: string, to: ZoneId, index: number) => {
    setVersions((v) => ({ ...v, [id]: (v[id] ?? 0) + 1 }))
    setZones((z) => {
      const next: Record<ZoneId, string[]> = { top: z.top.filter((c) => c !== id), away: z.away.filter((c) => c !== id) }
      next[to] = [...next[to].slice(0, index), id, ...next[to].slice(index)]
      return next
    })
  }

  const clearLift = useCallback(() => {
    const lift = liftRef.current
    if (!lift) return
    lift.slot.classList.remove('is-lifted')
    lift.clone.remove()
    liftRef.current = null
  }, [])

  const onLanePointerOver = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current) return
    const slot = (e.target as HTMLElement).closest<HTMLElement>('.asv-slot[data-asv-id]')
    if (!slot || liftRef.current?.slot === slot) return
    clearLift()
    const clone = slot.cloneNode(true) as HTMLElement
    for (const el of [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))]) {
      el.removeAttribute('data-asv-id')
      el.removeAttribute('data-card-id')
      el.removeAttribute('data-testid')
      el.removeAttribute('id')
    }
    clone.classList.add('asv-lift')
    clone.setAttribute('aria-hidden', 'true')
    clone.style.zIndex = '9999'
    slot.parentElement?.appendChild(clone)
    slot.classList.add('is-lifted')
    liftRef.current = { slot, clone }
  }

  useLayoutEffect(() => clearLift, [clearLift])
  useLayoutEffect(() => clearLift(), [zones, drag?.started, clearLift])

  const updateHover = (next: Hover | null) => {
    const prev = hoverRef.current
    if (prev?.zone === next?.zone && prev?.index === next?.index) return
    hoverRef.current = next
    setHover(next)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>, id: string, from: ZoneId) => {
    if (e.button !== 0 || sent || dragRef.current) return
    const face = cardRefs.current.get(id)?.querySelector('.asv-card')
    if (!face) return
    e.preventDefault()
    const r = face.getBoundingClientRect()
    rootRef.current?.setPointerCapture(e.pointerId)
    physics.current = {
      pointerId: e.pointerId,
      px: e.clientX,
      py: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      offX: clamp(e.clientX - r.left, 0, cardW),
      offY: clamp(e.clientY - r.top, 0, cardH),
      lastX: e.clientX,
      lastY: e.clientY,
      vx: 0,
      vy: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      scale: LIFT_SCALE,
    }
    setDrag({ id, from, started: false })
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    const p = physics.current
    if (!d || !p || e.pointerId !== p.pointerId) return
    p.px = e.clientX
    p.py = e.clientY
    const moved = Math.hypot(p.px - p.startX, p.py - p.startY) > DRAG_THRESHOLD
    if (!d.started && moved) setDrag({ ...d, started: true })
    if (d.started || moved) {
      paintDrag()
      updateHover(hitTest(p.px, p.py, d.id))
    }
  }

  const endDrag = () => {
    physics.current = null
    hoverRef.current = null
    setDrag(null)
    setHover(null)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    const p = physics.current
    if (!d || !p || e.pointerId !== p.pointerId) return
    if (!d.started) {
      const to: ZoneId = d.from === 'top' ? 'away' : 'top'
      const face = cardRefs.current.get(d.id)?.querySelector('.asv-card')
      if (face) {
        const r = face.getBoundingClientRect()
        landing.current = { id: d.id, x: r.left + r.width / 2, y: r.top + r.height / 2 }
      }
      moveCard(d.id, to, zones[to].length)
    } else {
      const target = hitTest(p.px, p.py, d.id) ?? { zone: d.from, index: zones[d.from].indexOf(d.id) }
      moveCard(d.id, target.zone, target.index)
    }
    endDrag()
  }

  useLayoutEffect(() => {
    const land = landing.current
    if (!land) return
    landing.current = null
    const inner = cardRefs.current.get(land.id)?.querySelector<HTMLElement>('.asv-land')
    if (!inner) return
    const r = inner.getBoundingClientRect()
    inner.style.transition = 'none'
    inner.style.transform = `translate(${land.x - (r.left + r.width / 2)}px, ${land.y - (r.top + r.height / 2)}px)`
    void inner.offsetWidth
    inner.style.transition = 'transform 360ms cubic-bezier(.2, 1.15, .4, 1)'
    inner.style.transform = ''
  }, [zones])

  const submit = () => {
    setSent(true)
    window.setTimeout(() => {
      setSent(false)
      setZones({ top: cards.map((c) => c.id as string), away: [] })
      setDealKey((k) => k + 1)
    }, 1400)
  }

  const renderZone = (zone: ZoneId) => {
    const ids = zones[zone].filter((id) => !(drag?.started && id === drag.id))
    const withGap = hover?.zone === zone && drag?.started
    const geo = fanGeometry(zone, sizes[zone], cardW, ids.length + (withGap ? 1 : 0))
    const first = zone === 'top' ? 1 : 0
    const angleOf = (slot: number) => (slot - geo.mid) * geo.stepDeg
    let slot = first
    const placed: { id: string; angle: number; order: number }[] = []
    ids.forEach((id, i) => {
      if (withGap && slot === hover!.index + first) slot++
      placed.push({ id, angle: angleOf(slot), order: i })
      slot++
    })
    const gapAngle = withGap ? angleOf(hover!.index + first) : null
    const isAway = zone === 'away'
    const label = isAway ? awayLabel : mode === 'surveil' ? 'Library' : 'Top of Library'
    return (
      <section
        className={['asv-zone', `asv-zone-${zone}`, withGap ? 'is-hot' : ''].filter(Boolean).join(' ')}
        data-asv-zone={zone}
      >
        <h3 className="asv-zone-label">{label}</h3>
        <div className="asv-box">
          <div
            className="asv-lane"
            style={{ ['--fan-radius' as string]: `${radius}px` }}
            ref={(el) => { zoneRefs.current[zone] = el }}
            onPointerOver={onLanePointerOver}
            onPointerLeave={clearLift}
          >
            {!isAway && (
              <div className="asv-slot asv-deck" style={{ rotate: `${angleOf(0)}deg`, zIndex: 1 }} aria-hidden>
                <div className="asv-card">
                  <CardSlot card={SOURCE} cardId="asv-deck" faceDown />
                </div>
              </div>
            )}
            {gapAngle != null && <div className="asv-slot asv-gap" style={{ rotate: `${gapAngle}deg` }} />}
            {placed.map(({ id, angle, order }) => (
              <div
                key={id}
                className="asv-slot"
                data-asv-id={id}
                style={{ rotate: `${angle}deg`, zIndex: 10 + order }}
                ref={(el) => {
                  if (el) cardRefs.current.set(id, el)
                  else cardRefs.current.delete(id)
                }}
              >
                <div className="asv-land">
                  <div
                    className="asv-card"
                    style={dealing ? { animationDelay: `${cards.findIndex((c) => c.id === id) * 80}ms` } : undefined}
                    onPointerDown={(e) => onPointerDown(e, id, zone)}
                  >
                    <CardSlot card={byId.get(id)!} cardId={`asv-card:${id}:${versions[id] ?? 0}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  const dragged = drag?.started ? byId.get(drag.id) : null

  return (
    <div
      ref={rootRef}
      className={['asv', peek ? 'is-peek' : '', sent ? 'is-sent' : '', dealing ? 'is-dealing' : '', drag?.started ? 'is-dragging' : ''].filter(Boolean).join(' ')}
      data-testid="arena-surveil-mock"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={(e) => {
        if (physics.current?.pointerId === e.pointerId && dragRef.current) onPointerUp(e)
      }}
    >
      <div className="asv-scrim" aria-hidden />
      <div className="asv-probe" ref={probeRef} aria-hidden />
      <button
        type="button"
        className="asv-peek"
        onPointerDown={() => setPeek(true)}
        onPointerUp={() => setPeek(false)}
        onPointerLeave={() => setPeek(false)}
      >
        View Battlefield
      </button>
      <div className="asv-content" key={dealKey}>
        <header className="asv-head">
          <h2>{mode === 'surveil' ? 'Surveil' : 'Scry'}</h2>
          <p>
            {mode === 'surveil'
              ? 'Drag cards to put them on the top of your library or into your graveyard.'
              : 'Drag cards to put them on the top or the bottom of your library.'}
          </p>
        </header>
        <div className="asv-stage">
          {renderZone('away')}
          <div className="asv-center">
            {renderZone('top')}
            <button type="button" className="asv-done" onClick={submit} disabled={sent}>
              Done
            </button>
          </div>
          <div className="asv-source" aria-label={`Source: ${SOURCE.name}`}>
            <CardSlot card={SOURCE} cardId="asv-source" />
          </div>
        </div>
      </div>
      {dragged && (
        <div className="asv-drag" ref={dragElRef}>
          <div className="asv-drag-card" ref={dragCardRef}>
            <CardSlot card={dragged} cardId={`asv-drag:${dragged.id}:${versions[dragged.id as string] ?? 0}`} />
            <div className="asv-glare" />
          </div>
        </div>
      )}
    </div>
  )
}
