import { Fragment, useLayoutEffect, useRef, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { CardView, PlayerView } from '../net/types'
import FloatingCardPreview from './FloatingCardPreview'
import { useStore, isBlockingModal } from '../state/store'
import { recordCardPosition } from './cardPositionRegistry'
import { getActiveFlights, onFlightLanded, subscribeFlights, useActiveFlights } from './flightManager'
import { stackArrivalPending } from './stackLinks'
import { useTranslation } from '../i18n'
import Icon from '../ui/Icon'
import IconButton from '../ui/IconButton'
import { clickableProps } from '../ui/clickable'
import {
  getControllerInfo,
  isCopyCard,
  isStackAbility,
} from './stackEntries'
import StackBubble, { type StackBubblePlacement } from './StackBubble'
import { StackCardFace, StackEntryCardName } from './StackCardFace'
import StackViewer from './StackViewer'
import { seatColorVar, seatIndexOf } from './seatColor'
import { stackCascadeFit, type CascadeFit } from './stackCascadeFit'
import { BOARD_RELAYOUT_EVENT } from './layout/relayout'
import './StackZone.css'

interface StackZoneProps {
  stack: Record<string, CardView> | null | undefined
  onCardClick?: (id: string) => void
  onHover?: (card: CardView | null, rect?: DOMRect) => void
  targetIds?: Set<string>
  players?: PlayerView[]
  myPlayerId?: string | null
  /** The objects whose target arrows the board should draw: the one resolving next, and the hovered one. */
  onFocusIds?: (ids: ReadonlySet<string> | null) => void
}


/** How long the bubble keeps reading the hovered card after the pointer leaves the cascade and the bubble. */
const BUBBLE_READ_MS = 220
/** The gap the bubble's tail crosses between the card and the bubble. */
const BUBBLE_GAP = 12
/** Under this much room between the cascade and the dock, the bubble lies over the front card: a
 *  folded strip and two lines of text. */
const BUBBLE_MIN_BELOW = 72

/** How long an object primed as an arrival waits for its flight before giving up on it. */
const ARRIVAL_WAIT_MS = 120

/**
 * FX-14: an object the engine is flying to the stack is handed over the instant its clone lands.
 * It is kept off the cascade from the first frame it is drawn (the flight only starts two frames
 * later, and the card must not be dealt onto the cascade and taken away again), and when the clone
 * reaches it, it is already in place under it: the clone fades out over the card it just became.
 */
function useStackArrival(id: string): '' | ' stack-entry-waiting' | ' stack-entry-arriving' {
  const flights = useActiveFlights()
  const flightId = flights.find((f) => f.cardId === id && f.toSelector?.startsWith(`[data-card-id="${id}"]`))?.flightId ?? null
  const [waiting, setWaiting] = useState(() => stackArrivalPending(id))
  const [landed, setLanded] = useState(false)

  useEffect(() => {
    if (!waiting) return
    // Nothing flew: the object was not one the engine could find a source for, so it eases in
    // where it is, which is what the entry animation is for.
    const giveUp = setTimeout(() => setWaiting(false), ARRIVAL_WAIT_MS)
    return () => clearTimeout(giveUp)
  }, [waiting])

  useEffect(() => {
    if (!flightId) return
    setWaiting(false)
    setLanded(false)
    const land = () => setLanded(true)
    const off = onFlightLanded(flightId, land)
    // A flight can also end by being dropped (a new game, a burst that cancels it): the card is
    // never left hidden waiting for a landing that will not come.
    const unsub = subscribeFlights(() => {
      if (!getActiveFlights().some((f) => f.flightId === flightId)) land()
    })
    return () => {
      off()
      unsub()
    }
  }, [flightId])

  if (flightId && !landed) return ' stack-entry-arriving'
  return waiting ? ' stack-entry-waiting' : ''
}

/** Entry del stack que registra su rect al desmontar (useLayoutEffect cleanup,
 *  como CardSlot) para que los vuelos de resolución salgan del slot exacto. */
export function RecordedStackEntry({
  id,
  className,
  style,
  onClick,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  id: string
  className: string
  style?: React.CSSProperties
  onClick?: () => void
  onMouseEnter?: (e: React.SyntheticEvent<HTMLDivElement>) => void
  onMouseLeave?: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const arriving = useStackArrival(id)
  useLayoutEffect(() => {
    const el = ref.current
    return () => {
      if (!el || !id) return
      // Registrar el thumbnail (forma de carta) en vez de la fila completa: la
      // fila es una tira ancha y deformaba el clon volador de la resolución.
      const thumb = el.querySelector<HTMLElement>('.stack-thumb')
      const source = thumb ?? el
      recordCardPosition(
        id,
        source.getBoundingClientRect(),
        'stack-zone',
        { w: source.offsetWidth, h: source.offsetHeight },
        source.querySelector('img')?.currentSrc || el.querySelector('img')?.currentSrc || undefined,
      )
    }
  }, [id])

  return (
    <div ref={ref} data-card-id={id} className={`${className}${arriving}`} style={style} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onFocus={onMouseEnter} onBlur={onMouseLeave} {...clickableProps(onClick)}>
      {children}
    </div>
  )
}

export default function StackZone({
  stack,
  onCardClick,
  onHover,
  targetIds = new Set(),
  players,
  myPlayerId,
  onFocusIds,
}: StackZoneProps) {
  const [hoverCard, setHoverCard] = useState<CardView | null>(null)
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null)
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set())
  const toggleGroup = useCallback((key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])
  const { t } = useTranslation()

  const zoneRef = useRef<HTMLDivElement>(null)
  const cascadeRef = useRef<HTMLDivElement>(null)
  const roomRef = useRef<HTMLDivElement>(null)
  // STK-2: the stack can be pushed aside to read the board under it, without closing.
  const [pushed, setPushed] = useState(false)
  const [fit, setFit] = useState<CascadeFit | null>(null)
  // STK-2: how high above the bottom the cascade has to start so it never lies over the dock,
  // which is where the button the player is about to press lives. The dock knows nothing about
  // the stack, so reading it here cannot feed back into anything it depends on.
  const [floor, setFloor] = useState(0)
  const cardRender = useStore((s) => s.settings.cardRender)
  // STK-10: the bubble under the cascade. It comes open: what the object is about to do is the
  // reason the stack is on screen, so it is read without asking for it, and the strip folds it
  // away for whoever wants the board behind it. The pointer only chooses which object is read; it
  // keeps reading the card last hovered for a moment after leaving, so the pointer can cross the
  // gap between the card and the bubble.
  const [bubbleHover, setBubbleHover] = useState(false)
  const [bubbleFolded, setBubbleFolded] = useState(false)
  const [reading, setReading] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [bubblePlacement, setBubblePlacement] = useState<StackBubblePlacement>('below')
  const [bubbleMax, setBubbleMax] = useState<number | null>(null)

  const entries = Object.entries(stack ?? {})
  // STK-4: three copies of the same spell are three objects on the stack, and each one resolves
  // on its own, so each one is drawn. Folding them into a single card with a count hid that.
  const groups = entries.map(([id, card], i) => ({ items: [[id, card]] as [string, CardView][], start: i }))
  const groupCount = groups.length
  // Deeper than the cascade draws: the tail is counted on the front card.
  const shownGroups = fit ? groups.slice(0, fit.shown) : groups
  const foldedCount = groups.length - shownGroups.length

  const modalOpen = useStore(isBlockingModal)

  // STK-1: the cascade is sized from the room its host declares, never from its own box: it sets
  // its own width and height from the answer, so measuring either would be measuring that answer
  // (BRD-54 learnt this on the player's counter stack).
  useLayoutEffect(() => {
    const el = roomRef.current
    if (!el) return
    const measure = () => {
      const { width: w, height: h } = el.getBoundingClientRect()
      if (w <= 0) return
      const next = stackCascadeFit(w, h, groupCount)
      setFit((prev) => (prev && prev.cardW === next.cardW && prev.stepX === next.stepX && prev.stepY === next.stepY && prev.shown === next.shown ? prev : next))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [groupCount])

  useLayoutEffect(() => {
    const el = zoneRef.current
    if (!el) return
    const measure = () => {
      const dock = document.querySelector('.game-dock')
      const base = (el.offsetParent ?? document.documentElement).getBoundingClientRect()
      const rect = dock?.getBoundingClientRect()
      if (!rect || rect.height <= 0) {
        setFloor(0)
        return
      }
      setFloor(Math.max(0, Math.round(base.bottom - rect.top)))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    const dock = document.querySelector('.game-dock')
    if (dock) observer.observe(dock)
    observer.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  useEffect(() => {
    if (modalOpen) {
      setHoverCard(null)
      setHoverRect(null)
    }
  }, [modalOpen])

  /** El hover solo se limpia con mouseLeave, pero la carta con hover puede
   *  desaparecer de la pila (se resuelve) sin que el navegador emita leave:
   *  su DOM se desmonta. Sin esta validación, el preview obsoleto reaparece
   *  al entrar la siguiente carta en la pila. También refresca el objeto
   *  (targets/reglas) y re-ancla el rect si la lista se recompone. */
  useLayoutEffect(() => {
    if (!hoverCard) return
    const id = hoverCard.id
    if (id == null) return
    const current: Record<string, CardView> = stack ?? {}
    if (!(id in current)) {
      setHoverCard(null)
      setHoverRect(null)
      onHover?.(null)
      return
    }
    const latest = current[id]
    if (latest && latest !== hoverCard) setHoverCard(latest)
    const safeId = id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    const el = zoneRef.current?.querySelector<HTMLElement>(`[data-card-id="${safeId}"]`)
    if (el) setHoverRect(el.getBoundingClientRect())
  }, [stack, hoverCard, onHover])

  const handleHover = useCallback(
    (card: CardView | null, rect?: DOMRect) => {
      if (modalOpen) {
        setHoverCard(null)
        setHoverRect(null)
        return
      }
      setHoverCard(card)
      setHoverRect(rect ?? null)
      onHover?.(card, rect)
    },
    [onHover, modalOpen]
  )

  const topId = shownGroups[0]?.items[0]?.[0] ?? null
  const hoverId = hoverCard?.id ?? null
  const bubbleOpen = !bubbleFolded
  const wantRead = bubbleHover || hoverId != null
  useEffect(() => {
    if (wantRead) {
      setReading(true)
      return
    }
    const back = setTimeout(() => setReading(false), BUBBLE_READ_MS)
    return () => clearTimeout(back)
  }, [wantRead])
  // Pushed aside, or a stack that has run out: the next one comes open again, as a fresh one does.
  useEffect(() => {
    if (pushed) setBubbleFolded(false)
  }, [pushed])
  useEffect(() => {
    if (groupCount === 0) setBubbleFolded(false)
  }, [groupCount])
  // The card last hovered stays the one read while the pointer crosses to the bubble; once the
  // pointer is gone, it goes back to the object about to resolve.
  const [readId, setReadId] = useState<string | null>(null)
  useEffect(() => {
    if (hoverId != null) setReadId(String(hoverId))
  }, [hoverId])
  useEffect(() => {
    if (!reading) setReadId(null)
  }, [reading])

  // TGT-7: a stack object the player is being asked to target brings the stack back; it is always
  // in view now, but it may have been pushed aside.
  const anyTargetable = entries.some(([id]) => targetIds.has(id))
  useEffect(() => {
    if (anyTargetable) setPushed(false)
  }, [anyTargetable])

  // STK-3: only two objects point at their targets: the one about to resolve, always, and the one
  // under the pointer. Every arrow at once is a thicket nobody reads.
  useEffect(() => {
    if (!onFocusIds) return
    const ids = new Set<string>()
    // Pushed aside, the stack is off the board and draws no arrows: the point of pushing it is to
    // see what was under it, and an arrow reaching for a card that has left is the worst of both.
    if (!pushed) {
      if (topId) ids.add(topId)
      if (hoverId) ids.add(hoverId)
    }
    onFocusIds(ids)
  }, [onFocusIds, topId, hoverId, pushed])

  useEffect(() => () => onFocusIds?.(null), [onFocusIds])

  // STK-10: the bubble hangs under the cascade when there is room for it above the dock, and over the
  // front card's lower half when there is not: it never lies over the button the player is about to
  // press, nor over the board.
  const hasEntries = entries.length > 0
  useEffect(() => {
    if (!hasEntries) setViewerOpen(false)
  }, [hasEntries])
  useLayoutEffect(() => {
    const cascade = cascadeRef.current
    const zone = zoneRef.current
    if (!cascade || !zone) return
    const measure = () => {
      const top = cascade.getBoundingClientRect().bottom
      const dock = document.querySelector('.game-dock')?.getBoundingClientRect()
      const base = (zone.offsetParent ?? document.documentElement).getBoundingClientRect()
      const limit = dock && dock.height > 0 ? Math.min(dock.top, base.bottom) : base.bottom
      const room = Math.floor(limit - top - BUBBLE_GAP)
      const next: StackBubblePlacement = room >= BUBBLE_MIN_BELOW ? 'below' : 'inside'
      setBubblePlacement(next)
      setBubbleMax(next === 'below' ? room : null)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [hasEntries, fit, floor])

  // STK-2: an empty stack draws nothing at all; it is a layer over the board, not a panel that
  // stays behind saying it is empty. It is read after the hooks above, never before them: an
  // empty stack publishes no focus and draws no arrows, which is the same answer by another road.
  if (entries.length === 0) return null

  const current = stack ?? {}
  const readingId = [hoverId, readId, topId].find((id): id is string => id != null && id in current) ?? null
  const readingCard = readingId ? current[readingId] : null
  const readingCtrl = readingCard && readingId ? getControllerInfo(readingCard, readingId, players, myPlayerId, t) : null

  const hoverCtrl = hoverCard?.id
    ? getControllerInfo(hoverCard, String(hoverCard.id), players, myPlayerId, t)
    : null

  return (
    <div
      ref={zoneRef}
      className={`stack-zone${pushed ? ' is-pushed' : ''}`}
      data-testid="stack-zone"
      /* The arrows are drawn from where the cards are, and pushing the stack aside moves them
         without changing any state the overlay watches: it has to be told, or an arrow keeps
         pointing at where its card used to be. */
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && e.propertyName === 'transform') {
          window.dispatchEvent(new Event(BOARD_RELAYOUT_EVENT))
        }
      }}
      style={fit ? ({
        '--card-w': `${fit.cardW}px`,
        '--stack-x': `${fit.stepX}px`,
        '--stack-y': `${fit.stepY}px`,
        '--stack-n': shownGroups.length,
        '--stack-floor': `${floor}px`,
        ...(bubbleMax != null ? { '--bubble-max': `${bubbleMax}px` } : {}),
      } as React.CSSProperties) : ({ '--stack-floor': `${floor}px` } as React.CSSProperties)}
    >
      {/* The room the cascade may use, declared in CSS and measured here: a box of its own, so the
          measurement can never read back the size the cascade chose. */}
      <div ref={roomRef} className="stack-room" aria-hidden="true" />
      <div className="stack-side">
        <IconButton
          className="stack-push"
          data-testid="stack-push"
          label={pushed ? t('game', 'stack_bring_back') : t('game', 'stack_push_aside')}
          variant="ghost"
          aria-pressed={pushed}
          onClick={() => setPushed((on) => !on)}
        >
          <Icon name={pushed ? 'chevronLeft' : 'chevronRight'} size={16} />
        </IconButton>
        <button
          type="button"
          className="stack-view-all"
          data-testid="stack-open-viewer"
          title={t('game', 'stack_view_all')}
          aria-label={`${t('game', 'stack_view_all')} (${entries.length})`}
          onClick={() => setViewerOpen(true)}
        >
          <Icon name="layers" size={14} />
          <span className="stack-view-all-count">{entries.length}</span>
        </button>
      </div>

      {/* STK-1: the stack is a cascade of cards, the one about to resolve in front and the rest
          peeking behind it by their title, the way a hand of cards lies over itself. */}
      <div
        ref={cascadeRef}
        className="stack-cascade"
        data-testid="stack-cascade"
      >
        {shownGroups.map((group, gi) => {
          const [id, card] = group.items[0]
          const count = group.items.length
          const idx = group.start
          const isTop = gi === 0
          const isAbility = isStackAbility(card)
          const isCopy = isCopyCard(card)
          const isTargetable = targetIds.has(id)
          const ctrlInfo = getControllerInfo(card, id, players, myPlayerId, t)
          const ownership = ctrlInfo.isMe ? 'mine' : 'opponent'
          const openGroup = count > 1 && openGroups.has(id)

          return (
            <Fragment key={group.items[count - 1][0]}>
            <RecordedStackEntry
              id={id}
              className={[
                'stack-card',
                isTop ? 'is-top' : '',
                isAbility ? 'is-ability' : 'is-spell',
                isCopy ? 'is-copy' : '',
                isTargetable ? 'targetable' : '',
                onCardClick || count > 1 ? 'clickable' : '',
                count > 1 ? 'is-group' : '',
                openGroup ? 'is-open' : '',
                reading && bubbleOpen && id === readingId ? 'is-reading' : '',
                `owner-${ownership}`,
              ].filter(Boolean).join(' ')}
              style={{ ['--i' as string]: gi, ['--seat' as string]: seatColorVar(seatIndexOf(players, ctrlInfo.id)) }}
              onClick={count > 1 ? () => toggleGroup(id) : onCardClick ? () => onCardClick(id) : undefined}
              onMouseEnter={(e) => handleHover(card, e.currentTarget.getBoundingClientRect())}
              onMouseLeave={() => handleHover(null)}
            >
              <div className="stack-card-face">
                <StackCardFace card={card} rendered={cardRender === 'rendered'} />
                {gi === 0 && foldedCount > 0 && (
                  <span className="stack-card-more" data-testid="stack-cascade-more">+{foldedCount}</span>
                )}
              </div>
            </RecordedStackEntry>
            {openGroup && group.items.map(([subId, subCard], k) => (
              <RecordedStackEntry
                key={subId}
                id={subId}
                className={['stack-card-sub', onCardClick ? 'clickable' : ''].filter(Boolean).join(' ')}
                onClick={onCardClick ? () => onCardClick(subId) : undefined}
                onMouseEnter={(e) => handleHover(subCard, e.currentTarget.getBoundingClientRect())}
                onMouseLeave={() => handleHover(null)}
              >
                <span className="stack-tl-pos">#{idx + k + 1}</span>
                <StackEntryCardName card={subCard} />
              </RecordedStackEntry>
            ))}
            </Fragment>
          )
        })}
        {readingCard && readingCtrl && (
          <StackBubble
            card={readingCard}
            ctrl={readingCtrl}
            depth={Math.max(0, shownGroups.findIndex((g) => g.items[0][0] === readingId))}
            open={bubbleOpen}
            placement={bubblePlacement}
            onToggle={() => setBubbleFolded((folded) => !folded)}
            onEnter={() => setBubbleHover(true)}
            onLeave={() => setBubbleHover(false)}
          />
        )}
      </div>
      {viewerOpen && (
        <StackViewer
          entries={entries}
          players={players}
          myPlayerId={myPlayerId}
          targetIds={targetIds}
          onCardClick={onCardClick}
          onClose={() => setViewerOpen(false)}
        />
      )}

      <FloatingCardPreview
        card={hoverCard}
        anchorRect={hoverRect}
        fixedSide="left"
        badge={hoverCtrl && (
          <span className={`stack-controller-pill ${hoverCtrl.isMe ? 'is-me' : 'is-opp'}`}>
            <span className="ctrl-icon"><Icon name={hoverCtrl.avatarIcon} size={12} /></span>
            <span className="ctrl-name">{hoverCtrl.name}</span>
          </span>
        )}
      />
    </div>
  )
}
