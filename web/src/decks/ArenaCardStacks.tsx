import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject } from 'react'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta, DroppedCardData } from './ArenaCardStrip'
import Icon from '../ui/Icon'
import IconButton from '../ui/IconButton'
import { useCustomCardArt } from '../cards/customCardArt'
import { useLocalizedCardName } from '../cards/cardLocalization'
import { useTranslation } from '../i18n'
import { layoutStack, type StackLayoutCard } from './stackLayout'
import { STACK_BASE_COLUMN_PX } from './useStackColumnWidth'
import './ArenaCardStacks.css'

export interface StackItem {
  key: string
  card: DeckCard
  meta?: CardStripMeta
  issue?: string
  loading?: boolean
}

export interface StackColumn {
  id: string
  label: string
  kind?: 'group' | 'pile' | 'unsorted' | 'loading' | 'commander' | 'single'
  items: StackItem[]
}

export interface NewPileColumn {
  label: string
  hint: string
}

export interface ArenaCardStacksProps {
  columns: StackColumn[]
  copies?: 'separate' | 'together'
  scale?: number
  selectedKey?: string | null
  zone?: 'main' | 'side'
  onSelect?: (key: string) => void
  onInc?: (key: string, pileId?: string) => void
  onDec?: (key: string, pileId?: string) => void
  onSwap?: (key: string, pileId?: string) => void
  onHover?: (card: DeckCard, meta?: CardStripMeta, rect?: DOMRect) => void
  onLeave?: () => void
  onDropCard?: (columnId: string, payload: DroppedCardData) => void
  newPileColumn?: NewPileColumn
  onRenamePile?: (id: string, label: string) => void
  onRemovePile?: (id: string) => void
}

type View = Omit<ArenaCardStacksProps, 'columns' | 'newPileColumn' | 'copies' | 'scale' | 'zone'> & {
  interactive: boolean
  copies: 'separate' | 'together'
  scale: number
  zone: 'main' | 'side'
}

interface DropHandlers {
  onDragOver?: (e: DragEvent<HTMLElement>) => void
  onDragLeave?: (e: DragEvent<HTMLElement>) => void
  onDrop?: (e: DragEvent<HTMLElement>) => void
}

const DRAG_TYPE = 'application/json'
const PEEK_PX = 34
const COPY_OFFSET_PX = 5
const MIN_COPY_OFFSET_PX = 3
const FACE_HEIGHT_PER_WIDTH = 680 / 488

function hasCardPayload(e: DragEvent<HTMLElement>): boolean {
  return Array.from(e.dataTransfer.types ?? []).includes(DRAG_TYPE)
}

function readPayload(e: DragEvent<HTMLElement>): DroppedCardData | null {
  try {
    const parsed: unknown = JSON.parse(e.dataTransfer.getData(DRAG_TYPE))
    return typeof parsed === 'object' && parsed !== null ? (parsed as DroppedCardData) : null
  } catch {
    return null
  }
}

function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return width
}

function useDropTarget(columnId: string, onDropCard: View['onDropCard']) {
  const [over, setOver] = useState(false)
  const handlers: DropHandlers = onDropCard
    ? {
        onDragOver: (e) => {
          if (!hasCardPayload(e)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = e.dataTransfer.effectAllowed === 'move' ? 'move' : 'copy'
          setOver(true)
        },
        onDragLeave: (e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
          setOver(false)
        },
        onDrop: (e) => {
          setOver(false)
          e.preventDefault()
          const payload = readPayload(e)
          if (payload) onDropCard(columnId, payload)
        },
      }
    : {}
  return { over, handlers }
}

function PileName({ id, label, onRename }: { id: string; label: string; onRename: (id: string, label: string) => void }) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<string | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const settled = useRef(false)
  const refocus = useRef(false)

  useEffect(() => {
    if (draft === null && refocus.current) {
      refocus.current = false
      buttonRef.current?.focus()
    }
  }, [draft])

  const start = () => {
    settled.current = false
    setDraft(label)
  }

  const finish = (keep: boolean, backToButton: boolean) => {
    if (settled.current || draft === null) return
    settled.current = true
    const next = draft.trim()
    refocus.current = backToButton
    setDraft(null)
    if (keep && next && next !== label) onRename(id, next)
  }

  if (draft !== null) {
    return (
      <input
        className="arena-stack-col-input"
        aria-label={t('decks', 'pile_rename')}
        value={draft}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            finish(true, true)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            finish(false, true)
          }
        }}
        onBlur={() => finish(true, false)}
      />
    )
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      className="arena-stack-col-name"
      aria-label={`${t('decks', 'pile_rename')}: ${label}`}
      title={t('decks', 'pile_rename')}
      onClick={start}
    >
      {label}
    </button>
  )
}

interface ItemCopiesProps {
  item: StackItem
  entries: StackLayoutCard[]
  cardHeight: number
  selected: boolean
  pileId?: string
  view: View
}

function StackItemCopies({ item, entries, cardHeight, selected, pileId, view }: ItemCopiesProps) {
  const { displayName, originalName } = useLocalizedCardName(item.card)
  const customArt = useCustomCardArt(item.card.cardName)
  const name = displayName || originalName
  const artUrl = item.loading ? null : (customArt ?? item.meta?.imageUrl ?? item.meta?.artCropUrl ?? null)
  const { key, card, meta, issue } = item
  const amount = card.amount
  const interactive = view.interactive

  const preview = (el: HTMLElement) => view.onHover?.(card, meta, el.getBoundingClientRect())
  const interaction = interactive
    ? {
        onClick: (e: MouseEvent<HTMLDivElement>) => {
          if (e.shiftKey) {
            if (view.onSwap) view.onSwap(key, pileId)
            else view.onInc?.(key, pileId)
          } else if (view.onSelect) {
            view.onSelect(key)
          } else {
            view.onDec?.(key, pileId)
          }
        },
        onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
          switch (e.key) {
            case 'Enter':
            case ' ':
              if (view.onSelect) view.onSelect(key)
              else view.onDec?.(key, pileId)
              break
            case '-':
            case 'Delete':
              view.onDec?.(key, pileId)
              break
            case '+':
            case '=':
              view.onInc?.(key, pileId)
              break
            case 's':
            case 'S':
              view.onSwap?.(key, pileId)
              break
            default:
              return
          }
          e.preventDefault()
        },
        onContextMenu: (e: MouseEvent<HTMLDivElement>) => {
          e.preventDefault()
          view.onInc?.(key, pileId)
        },
        onDragStart: (e: DragEvent<HTMLDivElement>) => {
          view.onLeave?.()
          e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ source: view.zone === 'side' ? 'sideboard' : 'main', key, pileId }))
          e.dataTransfer.effectAllowed = 'move'
        },
      }
    : {}

  const className = ['arena-stack-card', issue && 'has-issue', selected && 'is-selected', item.loading && 'is-loading', interactive && 'is-interactive']
    .filter(Boolean)
    .join(' ')
  const title = issue ? `${name} — ! ${issue}` : name

  return (
    <>
      {entries.map((entry) => {
        const front = entry.front
        const active = interactive && front
        return (
          <div
            key={entry.key}
            role={active ? 'button' : undefined}
            tabIndex={active ? 0 : undefined}
            aria-hidden={front ? undefined : true}
            aria-label={active ? `${name} ×${amount}` : undefined}
            draggable={interactive || undefined}
            className={className}
            data-card-key={key}
            data-front={front ? 'true' : undefined}
            title={title}
            style={{ top: entry.top, zIndex: entry.z, height: cardHeight }}
            onMouseEnter={(e) => preview(e.currentTarget)}
            onMouseLeave={() => view.onLeave?.()}
            onFocus={(e: FocusEvent<HTMLDivElement>) => preview(e.currentTarget)}
            onBlur={() => view.onLeave?.()}
            onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
              if (e.pointerType === 'touch') preview(e.currentTarget)
            }}
            {...interaction}
          >
            <span className="arena-stack-face">
              {artUrl
                ? <img className="arena-stack-img" src={artUrl} alt="" draggable={false} loading="lazy" />
                : <span className="arena-stack-fallback">{name}</span>}
            </span>
            {front && amount > 1 && <span className="arena-stack-qty">{`×${amount}`}</span>}
            {front && issue && <span className="arena-stack-issue"><Icon name="alert" size={11} /></span>}
          </div>
        )
      })}
    </>
  )
}

function pileOf(column: StackColumn): string | undefined {
  return column.kind === 'pile' || column.kind === 'unsorted' ? column.id : undefined
}

function StackColumnView({ column, view }: { column: StackColumn; view: View }) {
  const { t } = useTranslation()
  const bodyRef = useRef<HTMLDivElement>(null)
  const measured = useElementWidth(bodyRef)
  const { over, handlers } = useDropTarget(column.id, view.onDropCard)
  const cardHeight = Math.round((measured > 0 ? measured : STACK_BASE_COLUMN_PX) * FACE_HEIGHT_PER_WIDTH)
  const peek = Math.round(PEEK_PX * view.scale)
  const copyOffset = Math.max(MIN_COPY_OFFSET_PX, Math.round(COPY_OFFSET_PX * view.scale))
  const empty = column.items.length === 0
  const { height, groups } = useMemo(() => {
    const layout = layoutStack(column.items, { copies: view.copies, peek, copyOffset, cardHeight })
    const byKey = new Map(column.items.map((item) => [item.key, item]))
    const entries = new Map<string, StackLayoutCard[]>()
    for (const card of layout.cards) entries.set(card.itemKey, [...(entries.get(card.itemKey) ?? []), card])
    return {
      height: layout.height,
      groups: [...entries].map(([itemKey, cards]) => ({ item: byKey.get(itemKey)!, cards })),
    }
  }, [column.items, view.copies, peek, copyOffset, cardHeight])
  const total = column.items.reduce((s, it) => s + it.card.amount, 0)
  const renamable = column.kind === 'pile' && view.onRenamePile
  const removable = column.kind === 'pile' && view.onRemovePile

  return (
    <section
      className={`arena-stack-col${over ? ' is-drop-target' : ''}`}
      data-column={column.id}
      data-kind={column.kind ?? 'group'}
      {...handlers}
    >
      <header className="arena-stack-col-head">
        {renamable && view.onRenamePile
          ? <PileName id={column.id} label={column.label} onRename={view.onRenamePile} />
          : <span>{column.label}</span>}
        <span className="arena-stack-col-count">{total}</span>
      </header>
      <div ref={bodyRef} className="arena-stack-col-body" style={empty ? undefined : { height }}>
        {empty && column.kind === 'pile'
          ? (
            <div className="arena-stack-col-empty">
              <span>{t('decks', 'pile_empty')}</span>
              {removable && view.onRemovePile && (
                <IconButton label={t('decks', 'pile_remove')} icon="x" size="sm" onClick={() => view.onRemovePile?.(column.id)} />
              )}
            </div>
          )
          : groups.map(({ item, cards }) => (
            <StackItemCopies
              key={item.key}
              item={item}
              entries={cards}
              cardHeight={cardHeight}
              selected={item.key === view.selectedKey}
              pileId={pileOf(column)}
              view={view}
            />
          ))}
      </div>
    </section>
  )
}

function NewPileDrop({ column, onDropCard }: { column: NewPileColumn; onDropCard: View['onDropCard'] }) {
  const { over, handlers } = useDropTarget('__new__', onDropCard)
  return (
    <section className={`arena-stack-col arena-stack-col-new${over ? ' is-drop-target' : ''}`} data-column="__new__" data-kind="new" {...handlers}>
      <header className="arena-stack-col-head">
        <span>{column.label}</span>
      </header>
      <p className="arena-stack-col-hint">{column.hint}</p>
    </section>
  )
}

export function ArenaCardStacks({ columns, newPileColumn, copies = 'together', scale = 1, selectedKey = null, zone = 'main', ...handlers }: ArenaCardStacksProps) {
  const view: View = {
    ...handlers,
    selectedKey,
    copies,
    zone,
    scale: scale > 0 ? scale : 1,
    interactive: Boolean(handlers.onSelect || handlers.onInc || handlers.onDec || handlers.onSwap),
  }
  return (
    <div className="arena-stack-board">
      {columns.map((column) => <StackColumnView key={column.id} column={column} view={view} />)}
      {newPileColumn && <NewPileDrop column={newPileColumn} onDropCard={view.onDropCard} />}
    </div>
  )
}
