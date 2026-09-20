import { useRef, useState } from 'react'
import CloseButton from '../ui/CloseButton'
import type { DeckCard } from '../lobby/decks'
import { ManaCost } from './ArenaManaSymbols'
import { setFloatingStripDragImage } from './arenaDragHelpers'
import { useLocalizedCardName } from '../cards/cardLocalization'
import Icon from '../ui/Icon'
import { confirmDialog } from '../ui/confirmDialog'
import { useTranslation } from '../i18n'
import './ArenaCardStrip.css'

export interface CardStripMeta {
  name?: string
  artCropUrl?: string | null
  imageUrl?: string | null
  backImageUrl?: string | null
  manaCost?: string
  cmc?: number
  typeLine?: string
  colors?: string[]
  oracleText?: string
  keywords?: string[]
  rarity?: string
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
  onSetCommander,
  commanderEligible,
  onHover,
  onLeave,
  onChangePrinting,
  sideboard = false,
  onSwap,
  swapLabel,
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
  onSetCommander?: (c: DeckCard) => void
  commanderEligible?: boolean
  onHover?: (card: DeckCard, meta?: CardStripMeta, rect?: DOMRect) => void
  onLeave?: () => void
  onChangePrinting?: (c: DeckCard) => void
  sideboard?: boolean
  onSwap?: (key: string) => void
  swapLabel?: string
}) {
  const { t } = useTranslation()
  const { displayName, originalName } = useLocalizedCardName(card)
  const hoverTitle = displayName && displayName !== originalName ? `${displayName} (${originalName})` : (displayName || originalName)
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
    onLeave?.()
    setIsDraggingSelf(true)
    e.dataTransfer.setData('application/json', JSON.stringify({
      cardName: card.cardName,
      printedName: displayName !== originalName ? displayName : undefined,
      setCode: card.setCode,
      cardNumber: card.cardNumber,
      source: sideboard ? 'sideboard' : 'main',
      key: actionKey,
    }))
    e.dataTransfer.effectAllowed = 'move'
    setFloatingStripDragImage(e, displayName || card.cardName, meta?.artCropUrl)
  }

  const handleDragEnd = () => {
    setIsDraggingSelf(false)
  }

  const handleClick = (e: React.MouseEvent) => {
    if (onSwap) {
      onSwap(actionKey)
      return
    }
    // Left-click decreases count (like Arena), unless shift is held
    if (e.shiftKey) {
      onInc?.(actionKey)
    } else {
      focusNeighborAfterRemoval()
      onDec?.(actionKey)
    }
  }

  /** Si la tira desaparece al quitar la última copia, el foco cae a <body>:
   *  lo movemos al vecino más próximo (antes de que React desmonte). */
  const focusNeighborAfterRemoval = () => {
    const el = ref.current
    if (!el) return
    const next = el.nextElementSibling as HTMLElement | null
    const prev = el.previousElementSibling as HTMLElement | null
    requestAnimationFrame(() => {
      if (document.activeElement && document.activeElement !== document.body) return
      const pick = (n: HTMLElement | null): HTMLElement | null =>
        n?.classList.contains('arena-card-strip') ? n : n?.querySelector<HTMLElement>('.arena-card-strip') ?? null
      ;(pick(next) ?? pick(prev))?.focus()
    })
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    if (onSwap) {
      onSwap(actionKey)
      return
    }
    // Right-click increases count (like Arena)
    onInc?.(actionKey)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (onSwap) onSwap(actionKey)
      else {
        focusNeighborAfterRemoval()
        onDec?.(actionKey)
      }
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      onInc?.(actionKey)
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      focusNeighborAfterRemoval()
      onDec?.(actionKey)
    }
  }

  const handleRemoveAll = async () => {
    if (!onRemove) return
    if (card.amount > 1) {
      const ok = await confirmDialog(
        t('decks', 'strip_remove_all_confirm', { count: card.amount, name: displayName || originalName }),
      )
      if (!ok) return
    }
    focusNeighborAfterRemoval()
    onRemove(actionKey)
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
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      title={issue ? `${hoverTitle} — ! ${issue}` : (onSwap ? `${hoverTitle} — ${swapLabel ?? '⇄'}` : `${hoverTitle} — ${t('decks', 'strip_click_hint')}`)}
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
        {isCommander ? <Icon name="crown" size={13} /> : `${card.amount}x`}
      </div>

      {/* Card Name */}
      <div className="strip-name" title={hoverTitle}>
        {displayName || originalName}
      </div>

      {/* Issue warning icon */}
      {issue && <span className="strip-issue-badge" title={issue}><Icon name="alert" size={12} /></span>}

      {/* Mana Cost */}
      <div className="strip-mana">
        <ManaCost manaCost={meta?.manaCost} size={15} />
      </div>

      {/* Quick Hover Controls */}
      <div
        className="strip-actions"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {onSwap && (
          <button
            type="button"
            className="strip-btn swap"
            onClick={() => onSwap(actionKey)}
            title={swapLabel ?? (sideboard ? t('decks', 'strip_move_to_main') : t('decks', 'strip_move_to_side'))}
          >
            <Icon name="swap" size={13} />
          </button>
        )}
        <button
          type="button"
          className="strip-btn"
          onClick={() => {
            focusNeighborAfterRemoval()
            onDec?.(actionKey)
          }}
          title={t('decks', 'strip_remove_one')}
        >
          −
        </button>
        <button
          type="button"
          className="strip-btn"
          onClick={() => onInc?.(actionKey)}
          title={t('decks', 'strip_add_one')}
        >
          +
        </button>
        {onChangePrinting && (
          <button
            type="button"
            className="strip-btn print"
            onClick={() => onChangePrinting(card)}
            title={t('decks', 'strip_change_art')}
          >
            <Icon name="palette" size={13} />
          </button>
        )}
        {onSetCover && (
          <button
            type="button"
            className={`strip-btn star ${isCover ? 'active' : ''}`}
            onClick={() => onSetCover(card)}
            title={isCover ? t('decks', 'strip_cover_current') : t('decks', 'strip_cover_use')}
          >
            ★
          </button>
        )}
        {onSetCommander && (
          <button
            type="button"
            className={`strip-btn crown ${isCommander ? 'active' : ''}`}
            disabled={!isCommander && commanderEligible === false}
            onClick={() => onSetCommander(card)}
            title={
              isCommander
                ? t('decks', 'commander_unset')
                : commanderEligible === false
                  ? t('decks', 'commander_not_eligible')
                  : t('decks', 'commander_set')
            }
          >
            <Icon name="crown" size={13} />
          </button>
        )}
        <CloseButton
          size="sm"
          className="strip-btn danger"
          label={t('decks', 'strip_remove_all')}
          onClick={() => void handleRemoveAll()}
        />
      </div>
    </div>
  )
}
