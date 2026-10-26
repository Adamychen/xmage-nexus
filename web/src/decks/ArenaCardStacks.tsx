import { useRef } from 'react'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'
import Icon from '../ui/Icon'
import { useCustomCardArt } from '../cards/customCardArt'
import { useLocalizedCardName } from '../cards/cardLocalization'
import { useTranslation } from '../i18n'
import './ArenaCardStacks.css'

export interface StackItem {
  key: string
  card: DeckCard
  meta?: CardStripMeta
  issue?: string
}

export interface StackColumn {
  id: string
  label: string
  items: StackItem[]
}

interface ArenaCardStacksProps {
  columns: StackColumn[]
  /** Without these handlers the stacks are read-only: no buttons, no clicks. */
  onInc?: (key: string) => void
  onDec?: (key: string) => void
  /** Shift+click moves one copy to the other zone; without it Shift+click adds one. */
  onSwap?: (key: string) => void
  onHover?: (card: DeckCard, meta?: CardStripMeta, rect?: DOMRect) => void
  onLeave?: () => void
}

function StackTile({ item, onInc, onDec, onSwap, onHover, onLeave }: Omit<ArenaCardStacksProps, 'columns'> & { item: StackItem }) {
  const { t } = useTranslation()
  const { displayName, originalName } = useLocalizedCardName(item.card)
  const customArt = useCustomCardArt(item.card.cardName)
  const artUrl = customArt ?? item.meta?.imageUrl ?? item.meta?.artCropUrl ?? null
  const name = displayName || originalName
  const ref = useRef<HTMLDivElement>(null)
  const interactive = onDec !== undefined
  const handlePreview = () => {
    if (ref.current) onHover?.(item.card, item.meta, ref.current.getBoundingClientRect())
  }

  return (
    <div
      ref={ref}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={`arena-stack-card${item.issue ? ' has-issue' : ''}`}
      data-card-key={item.key}
      aria-label={interactive ? `${name} ×${item.card.amount}` : undefined}
      title={interactive
        ? (item.issue ? `${name} — ! ${item.issue}` : `${name} — ${t('decks', 'strip_click_hint')}`)
        : name}
      onClick={interactive ? (e) => {
        if (!e.shiftKey) onDec(item.key)
        else if (onSwap) onSwap(item.key)
        else onInc?.(item.key)
      } : undefined}
      onKeyDown={interactive ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onDec(item.key)
        }
      } : undefined}
      onContextMenu={interactive ? (e) => {
        e.preventDefault()
        onInc?.(item.key)
      } : undefined}
      onPointerDown={(e) => { if (e.pointerType === 'touch') handlePreview() }}
      onMouseEnter={handlePreview}
      onMouseLeave={onLeave}
      onFocus={handlePreview}
      onBlur={onLeave}
    >
      <span className="arena-stack-face">
        {artUrl
          ? <img className="arena-stack-img" src={artUrl} alt="" draggable={false} loading="lazy" />
          : <span className="arena-stack-fallback">{name}</span>}
      </span>
      <span className="arena-stack-qty">{item.card.amount}x</span>
      {item.issue && <span className="arena-stack-issue"><Icon name="alert" size={11} /></span>}
    </div>
  )
}

export function ArenaCardStacks({ columns, onInc, onDec, onSwap, onHover, onLeave }: ArenaCardStacksProps) {
  return (
    <div className="arena-stack-board">
      {columns.map((column) => {
        const total = column.items.reduce((s, it) => s + it.card.amount, 0)
        return (
          <section key={column.id} className="arena-stack-col" data-column={column.id}>
            <header className="arena-stack-col-head">
              <span>{column.label}</span>
              <span className="arena-stack-col-count">{total}</span>
            </header>
            <div className="arena-stack-col-body">
              {column.items.map((item) => (
                <StackTile key={item.key} item={item} onInc={onInc} onDec={onDec} onSwap={onSwap} onHover={onHover} onLeave={onLeave} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
