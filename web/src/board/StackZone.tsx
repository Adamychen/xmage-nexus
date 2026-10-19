import { Fragment, useLayoutEffect, useRef, useState, useCallback, useEffect, useContext } from 'react'
import { createPortal } from 'react-dom'
import Tabs from '../ui/Tabs'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import type { ReactNode } from 'react'
import type { CardView, PlayerView } from '../net/types'
import { useCardImageUrl } from '../cards/useCardImageUrl'
import { useLocalizedCardName } from '../cards/cardLocalization'
import FloatingCardPreview from './FloatingCardPreview'
import FormattedText from '../game/FormattedText'
import { useStore, isBlockingModal } from '../state/store'
import { recordCardPosition } from './cardPositionRegistry'
import { useActiveFlights } from './flightManager'
import { useTranslation } from '../i18n'
import Icon from '../ui/Icon'
import { clickableProps } from '../ui/clickable'
import { groupAdjacent } from './groupAdjacent'
import {
  getControllerInfo,
  isCopyCard,
  isStackAbility,
  resolveStackTargetLabels,
  stackAbilityIcon,
  stackEntrySignature,
  stackRulesText,
  stackSubtype,
  stackTargetIds,
  stackTypeLabel,
} from './stackEntries'
import { DrawerHeadSlotContext } from '../game/drawerHeadSlot'
import { artCropUrl } from './compactCard'
import './StackZone.css'

interface StackZoneProps {
  stack: Record<string, CardView> | null | undefined
  onCardClick?: (id: string) => void
  onHover?: (card: CardView | null, rect?: DOMRect) => void
  targetIds?: Set<string>
  onResolveClick?: () => void
  canResolve?: boolean
  players?: PlayerView[]
  myPlayerId?: string | null
}

function StackThumbnail({ card }: { card: CardView }) {
  const imgUrl = useCardImageUrl(card)
  const artUrl = artCropUrl(imgUrl) ?? imgUrl

  return (
    <div className="stack-thumb">
      {artUrl ? (
        <img src={artUrl} alt="" className="stack-thumb-img" draggable={false} />
      ) : (
        <div className="stack-thumb-placeholder">
          <Icon name={isStackAbility(card) ? 'zap' : 'layers'} size={18} />
        </div>
      )}
    </div>
  )
}

export function StackEntryCardName({ card }: { card: CardView }) {
  const { displayName, originalName } = useLocalizedCardName(card)
  const isTranslated = displayName !== originalName

  return (
    <span
      className="stack-tl-name"
      title={isTranslated ? `${originalName} (${displayName})` : undefined}
    >
      {displayName}
    </span>
  )
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
  onMouseEnter?: (e: React.MouseEvent) => void
  onMouseLeave?: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const flights = useActiveFlights()
  const arriving = flights.some((f) => f.cardId === id && f.toSelector?.startsWith(`[data-card-id="${id}"]`))
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
        { w: source.offsetWidth, h: source.offsetHeight }
      )
    }
  }, [id])

  return (
    <div ref={ref} data-card-id={id} className={arriving ? `${className} stack-entry-arriving` : className} style={style} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} {...clickableProps(onClick)}>
      {children}
    </div>
  )
}

export default function StackZone({
  stack,
  onCardClick,
  onHover,
  targetIds = new Set(),
  onResolveClick,
  canResolve = false,
  players,
  myPlayerId,
}: StackZoneProps) {
  const [hoverCard, setHoverCard] = useState<CardView | null>(null)
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null)
  const [viewMode, setViewMode] = useState<'compact' | 'expanded'>('compact')
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
  const headSlot = useContext(DrawerHeadSlotContext)

  const zoneRef = useRef<HTMLDivElement>(null)

  const modalOpen = useStore(isBlockingModal)
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
  }, [stack, hoverCard, viewMode, onHover])

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

  const entries = Object.entries(stack ?? {})
  const groups = groupAdjacent(entries, ([id, card]) => stackEntrySignature(id, card, targetIds, players, myPlayerId))

  if (entries.length === 0) {
    return (
      <EmptyState fill icon="bolt" iconSize={24} title={t('game', 'stack_empty')}>
        {t('game', 'stack_empty_desc')}
      </EmptyState>
    )
  }

  const headerActions = (
    <div className="stack-header-actions">
      {canResolve && (
        <Button variant="success" size="sm" data-testid="stack-resolve-header-btn"
          onClick={onResolveClick}>
          <Icon name="bolt" size={13} /> {t('game', 'resolve')}
        </Button>
      )}
      <Tabs
        variant="segmented"
        size="sm"
        value={viewMode}
        onChange={setViewMode}
        items={[
          { id: 'compact', icon: 'list', title: t('game', 'compact_view') },
          { id: 'expanded', icon: 'layoutGrid', title: t('game', 'expanded_view') },
        ]}
      />
    </div>
  )

  return (
    <div ref={zoneRef} className={`stack-zone view-mode-${viewMode}`}>
      {headSlot ? createPortal(headerActions, headSlot) : (
        <div className="stack-header">
          <div className="stack-header-left">
            <span className="stack-header-title">{t('game', 'stack')} ({entries.length})</span>
          </div>
          {headerActions}
        </div>
      )}

      <div className="stack-timeline">
        {groups.map((group, gi) => {
          const [id, card] = group.items[0]
          const count = group.items.length
          const idx = group.start
          const isTop = gi === 0
          const isLast = gi === groups.length - 1
          const isAbility = isStackAbility(card)
          const isCopy = isCopyCard(card)
          const typeLabel = stackTypeLabel(card, t)
          const subtype = stackSubtype(card)
          const rulesText = stackRulesText(card)
          const manaCost = (card.manaCostLeftStr ?? []).join('')
          const isTargetable = targetIds.has(id)
          const ctrlInfo = getControllerInfo(card, id, players, myPlayerId, t)
          const ownership = ctrlInfo.isMe ? 'mine' : 'opponent'
          const ptLine = !isAbility && card.power != null && card.toughness != null
            ? `${card.power}/${card.toughness}`
            : null
          const tgtLabels = resolveStackTargetLabels(stackTargetIds(card), stack ?? {}, players)

          return (
            <Fragment key={group.items[count - 1][0]}>
            <RecordedStackEntry
              id={id}
              className={[
                'stack-tl-entry',
                isTop ? 'is-top' : '',
                isTop ? 'stack-top-pulse' : '',
                isAbility ? 'is-ability' : 'is-spell',
                isCopy ? 'is-copy' : '',
                isTargetable ? 'targetable' : '',
                onCardClick || count > 1 ? 'clickable' : '',
                count > 1 ? 'is-group' : '',
                count > 1 && openGroups.has(id) ? 'is-open' : '',
                `owner-${ownership}`,
              ].filter(Boolean).join(' ')}
              onClick={count > 1 ? () => toggleGroup(id) : onCardClick ? () => onCardClick(id) : undefined}
              onMouseEnter={(e) => handleHover(card, e.currentTarget.getBoundingClientRect())}
              onMouseLeave={() => handleHover(null)}
            >
              {/* Timeline node + connector */}
              <div className="stack-tl-rail">
                <div className={`stack-tl-node ${isTop ? 'node-top' : ''}`} />
                {!isLast && <div className={`stack-tl-line ${isTop ? 'line-top' : ''}`} />}
              </div>

              {/* Card content */}
              <div className="stack-tl-body">
                <div className="stack-tl-card">
                  {viewMode === 'compact' && <StackThumbnail card={card} />}

                  <div className="stack-tl-info">
                    <div className="stack-tl-name-row">
                      <span className="stack-tl-pos">
                        {isTop && <Icon name="play" size={9} />}
                        {count > 1 ? `#${idx + 1}–${idx + count}` : `#${idx + 1}`}
                      </span>
                      <StackEntryCardName card={card} />
                      {count > 1 && <span className="stack-tl-count" data-testid="stack-group-count">×{count}</span>}
                      {manaCost && (
                        <span className="stack-tl-mana">
                          <FormattedText text={manaCost} />
                        </span>
                      )}
                    </div>
                    <div className="stack-tl-type-row">
                      <span className={`stack-tl-type-badge ${isAbility ? 'type-ability' : 'type-spell'}`}>
                        {isAbility ? (<><Icon name={stackAbilityIcon(card)} size={11} /> </>) : ''}{typeLabel}
                      </span>
                      {subtype && <span className="stack-tl-subtype">{subtype}</span>}
                      {ptLine && <span className="stack-tl-pt">{ptLine}</span>}
                      {isCopy && <span className="stack-tl-copy-badge"><Icon name="sparkles" size={11} /> {t('game', 'copy_badge')}</span>}
                      <span className={`stack-controller-pill ${ctrlInfo.isMe ? 'is-me' : 'is-opp'}`} title={`${t('game', 'controller')}: ${ctrlInfo.name}`}>
                        <span className="ctrl-icon"><Icon name={ctrlInfo.avatarIcon} size={12} /></span>
                        <span className="ctrl-name">{ctrlInfo.name}</span>
                      </span>
                    </div>
                    {tgtLabels.length > 0 && (
                      <div
                        className="stack-tl-targets"
                        data-testid="stack-targets"
                        title={tgtLabels.join(', ')}
                        tabIndex={0}
                        aria-label={`${t('game', 'choose_target')}: ${tgtLabels.join(', ')}`}
                      >
                        <span className="stack-target-arrow" aria-hidden="true"><Icon name="target" size={11} /> →</span>
                        <span className="stack-target-names" aria-hidden="true">{tgtLabels.join(', ')}</span>
                      </div>
                    )}
                    {rulesText && (viewMode === 'expanded' || isAbility) && (
                      <div className={`stack-tl-rules${viewMode === 'compact' ? ' is-clamped' : ''}`} title={viewMode === 'compact' ? rulesText : undefined}>
                        <FormattedText text={rulesText} cardName={card.displayName ?? card.name} />
                      </div>
                    )}
                  </div>
                </div>
                {isTop && <span key={id} className="stack-top-wait-bar" aria-hidden="true" />}
              </div>
            </RecordedStackEntry>
            {count > 1 && openGroups.has(id) && group.items.map(([subId, subCard], k) => (
              <RecordedStackEntry
                key={subId}
                id={subId}
                className={['stack-tl-entry', 'stack-tl-sub', onCardClick ? 'clickable' : ''].filter(Boolean).join(' ')}
                onClick={onCardClick ? () => onCardClick(subId) : undefined}
                onMouseEnter={(e) => handleHover(subCard, e.currentTarget.getBoundingClientRect())}
                onMouseLeave={() => handleHover(null)}
              >
                <div className="stack-tl-rail">
                  <div className="stack-tl-node" />
                </div>
                <div className="stack-tl-body">
                  <div className="stack-tl-card">
                    <div className="stack-tl-info">
                      <div className="stack-tl-name-row">
                        <span className="stack-tl-pos">#{idx + k + 1}</span>
                        <StackEntryCardName card={subCard} />
                      </div>
                    </div>
                  </div>
                </div>
              </RecordedStackEntry>
            ))}
            </Fragment>
          )
        })}
      </div>

      <FloatingCardPreview card={hoverCard} anchorRect={hoverRect} fixedSide="left" />
    </div>
  )
}
