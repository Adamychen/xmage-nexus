import { useRef, useState } from 'react'
import type { DeckCard } from '../lobby/decks'
import { ManaCost } from './ArenaManaSymbols'
import { setFloatingStripDragImage } from './arenaDragHelpers'
import './ArenaCardStrip.css'

export interface CardStripMeta {
  artCropUrl?: string | null
  imageUrl?: string | null
  backImageUrl?: string | null
  manaCost?: string
  cmc?: number
  typeLine?: string
  colors?: string[]
  legalities?: Record<string, 'legal' | 'not_legal' | 'banned' | 'restricted'>
}

function getColorClass(colors?: string[]): string {
  if (!colors || colors.length === 0) return 'color-colorless'
  if (colors.length > 1) return 'color-multi'
  const c = colors[0].toUpperCase()
  if (c === 'W') return 'color-w'
  if (c === 'U') return 'color-u'
  if (c === 'B') return 'color-b'
  if (c === 'R') return 'color-r'
  if (c === 'G') return 'color-g'
  return 'color-colorless'
}

export function ArenaCardStrip({
  card,
  meta,
  isCommander = false,
  isCover = false,
  issue,
  onInc,
  onDec,
  onRemove,
  onSetCover,
  onHover,
  onLeave,
  sideboard = false,
}: {
  card: DeckCard
  meta?: CardStripMeta
  isCommander?: boolean
  isCover?: boolean
  issue?: string
  onInc?: (key: string) => void
  onDec?: (key: string) => void
  onRemove?: (key: string) => void
  onSetCover?: (c: DeckCard) => void
  onHover?: (card: DeckCard, meta?: CardStripMeta, rect?: DOMRect) => void
  onLeave?: () => void
  sideboard?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [isDraggingSelf, setIsDraggingSelf] = useState(false)
  const cardKey = `${card.setCode}:${card.cardNumber}:${card.cardName}`
  const actionKey = sideboard ? `sb:${cardKey}` : cardKey

  const colorClass = getColorClass(meta?.colors)

  const handleMouseEnter = () => {
    if (ref.current && onHover) {
      onHover(card, meta, ref.current.getBoundingClientRect())
    }
  }

  const handleDragStart = (e: React.DragEvent) => {
    setIsDraggingSelf(true)
    e.dataTransfer.setData('application/json', JSON.stringify({
      cardName: card.cardName,
      setCode: card.setCode,
      cardNumber: card.cardNumber,
      source: sideboard ? 'sideboard' : 'main',
      key: actionKey,
    }))
    e.dataTransfer.effectAllowed = 'move'
    setFloatingStripDragImage(e, card.cardName, meta?.artCropUrl)
  }

  const handleDragEnd = () => {
    setIsDraggingSelf(false)
  }

  const handleClick = (e: React.MouseEvent) => {
    // Left-click decreases count (like Arena), unless shift is held
    if (e.shiftKey) {
      onInc?.(actionKey)
    } else {
      onDec?.(actionKey)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    // Right-click increases count (like Arena)
    onInc?.(actionKey)
  }

  return (
    <div
      ref={ref}
      className={`arena-card-strip ${isCommander ? 'is-commander' : ''} ${isCover ? 'is-cover' : ''} ${isDraggingSelf ? 'is-dragging' : ''} ${issue ? 'has-issue' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onLeave}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      title={issue ? `${card.cardName} — ⚠️ ${issue}` : `${card.cardName} — Clic izquierdo: restar 1 · Clic derecho: sumar 1`}
    >
      {/* Background card art crop */}
      {meta?.artCropUrl && (
        <div
          className="strip-bg-art"
          style={{ backgroundImage: `url(${meta.artCropUrl})` }}
        />
      )}
      <div className="strip-gradient-overlay" />

      {/* Color trim bar */}
      <div className={`strip-color-bar ${colorClass}`} />

      {/* Quantity badge */}
      <div className={`strip-qty ${isCommander ? 'commander-badge' : ''}`}>
        {isCommander ? '👑' : `${card.amount}x`}
      </div>

      {/* Card Name */}
      <div className="strip-name" title={card.cardName}>
        {card.cardName}
      </div>

      {/* Issue warning icon */}
      {issue && <span className="strip-issue-badge" title={issue}>⚠️</span>}

      {/* Mana Cost */}
      <div className="strip-mana">
        <ManaCost manaCost={meta?.manaCost} size={15} />
      </div>

      {/* Quick Hover Controls */}
      <div className="strip-actions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="strip-btn"
          onClick={() => onDec?.(actionKey)}
          title="Quitar 1"
        >
          −
        </button>
        <button
          type="button"
          className="strip-btn"
          onClick={() => onInc?.(actionKey)}
          title="Añadir 1"
        >
          +
        </button>
        {onSetCover && (
          <button
            type="button"
            className={`strip-btn star ${isCover ? 'active' : ''}`}
            onClick={() => onSetCover(card)}
            title={isCover ? 'Portada actual' : 'Usar como portada'}
          >
            ★
          </button>
        )}
        <button
          type="button"
          className="strip-btn danger"
          onClick={() => onRemove?.(actionKey)}
          title="Eliminar todas las copias"
        >
          ×
        </button>
      </div>
    </div>
  )
}
