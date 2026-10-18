import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { CardView, PlayerView } from '../net/types'
import RenderedCard from '../cards/rendered/RenderedCard'
import { useCardImageUrl } from '../cards/useCardImageUrl'
import { artCropUrl } from './compactCard'
import { costSymbols } from '../cards/rendered/cardLayout'
import { symbolToSvgPath } from '../decks/ArenaManaSymbols'
import { seatColorVar, seatIndexOf } from './seatColor'
import { BOARD_RELAYOUT_EVENT } from './useBandFit'
import FloatingCardPreview from './FloatingCardPreview'
import { RecordedStackEntry, StackEntryCardName } from './StackZone'
import { groupAdjacent } from './groupAdjacent'
import { stackDeckFit, type DeckFit } from './stackDeckFit'
import {
  getControllerInfo,
  isStackAbility,
  resolveStackTargetLabels,
  stackEntrySignature,
  stackRulesText,
  stackTargetIds,
  stackTypeLabel,
} from './stackEntries'
import FormattedText from '../game/FormattedText'
import Icon from '../ui/Icon'
import IconButton from '../ui/IconButton'
import ChipButton from '../ui/ChipButton'
import { useTranslation } from '../i18n'
import { isBlockingModal, useStore } from '../state/store'
import './StackDeck.css'

export const STACK_DECK_MAX_TABS = 7

interface StackDeckProps {
  stack: Record<string, CardView> | null | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  onCardClick?: (id: string) => void
  targetIds?: Set<string>
  onResolveClick?: () => void
  canResolve?: boolean
  players?: PlayerView[]
  myPlayerId?: string | null
  onFocusIds?: (ids: ReadonlySet<string> | null) => void
}

const NO_TARGETS: Set<string> = new Set()

function StackDeckCaption({ card }: { card: CardView }) {
  const { t } = useTranslation()
  const rules = stackRulesText(card)
  return (
    <div className="stack-deck-caption" data-testid="stack-deck-caption">
      <span className="stack-deck-caption-kind">{stackTypeLabel(card, t)}</span>
      {rules && <div className="stack-deck-caption-rules"><FormattedText text={rules} cardName={card.displayName ?? card.name} /></div>}
    </div>
  )
}

function StackDeckThumb({ card }: { card: CardView }) {
  const imgUrl = useCardImageUrl(card)
  const art = artCropUrl(imgUrl) ?? imgUrl
  if (!art) return <span className="stack-deck-thumb stack-deck-thumb-empty" />
  return <img src={art} alt="" className="stack-deck-thumb" draggable={false} />
}

function StackDeckArt({ card, className }: { card: CardView; className: string }) {
  const imgUrl = useCardImageUrl(card)
  if (!imgUrl) return <div className={`${className} stack-deck-art-placeholder`} />
  return <img src={imgUrl} alt={card.name || card.alternateName || ''} className={`${className} stack-deck-art`} draggable={false} />
}

export default function StackDeck({
  stack,
  open,
  onOpenChange,
  onCardClick,
  targetIds = NO_TARGETS,
  players,
  myPlayerId,
  onFocusIds,
}: StackDeckProps) {
  const { t } = useTranslation()
  const modalOpen = useStore(isBlockingModal)
  const cardRender = useStore((s) => s.settings.cardRender)
  const stackCaption = useStore((s) => s.settings.stackCaption)
  const [hoverCard, setHoverCard] = useState<CardView | null>(null)
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const [fit, setFit] = useState<DeckFit | null>(null)

  const entries = useMemo(() => Object.entries(stack ?? {}), [stack])
  const groups = useMemo(
    () => groupAdjacent(entries, ([id, card]) => stackEntrySignature(id, card, targetIds, players, myPlayerId)),
    [entries, targetIds, players, myPlayerId],
  )
  const topId = groups[0]?.items[0]?.[0] ?? null
  const hasTop = topId !== null
  const restCount = Math.max(0, groups.length - 1)
  const hoverId = hoverCard?.id ?? null

  useLayoutEffect(() => {
    const wrap = sectionRef.current?.parentElement
    if (!wrap) return
    const measure = () => {
      if (wrap.offsetHeight <= 0) return
      const dock = parseFloat(getComputedStyle(wrap).getPropertyValue('--dock-bottom')) || 104
      const next = stackDeckFit(wrap.offsetHeight, dock, restCount, STACK_DECK_MAX_TABS)
      setFit((prev) => (prev && prev.cardW === next.cardW && prev.maxTabs === next.maxTabs && prev.avail === next.avail ? prev : next))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [restCount, hasTop])

  useEffect(() => {
    if (modalOpen) {
      setHoverCard(null)
      setHoverRect(null)
    }
  }, [modalOpen])

  useLayoutEffect(() => {
    if (hoverId != null && !(stack && hoverId in stack)) {
      setHoverCard(null)
      setHoverRect(null)
    }
  }, [stack, hoverId])

  useEffect(() => {
    if (!onFocusIds) return
    const ids = new Set<string>()
    if (topId) ids.add(topId)
    if (hoverId) ids.add(hoverId)
    onFocusIds(ids)
  }, [onFocusIds, topId, hoverId])

  useEffect(() => () => onFocusIds?.(null), [onFocusIds])

  const handleHover = useCallback(
    (card: CardView | null, rect?: DOMRect) => {
      if (modalOpen) return
      setHoverCard(card)
      setHoverRect(rect ?? null)
    },
    [modalOpen],
  )

  const relayout = useCallback((e: React.TransitionEvent) => {
    if (e.target === e.currentTarget && e.propertyName === 'width') window.dispatchEvent(new Event(BOARD_RELAYOUT_EVENT))
  }, [])

  if (entries.length === 0 || !topId) return null

  const total = entries.length
  const deckStyle = fit ? ({ '--card-w': `${fit.cardW}px`, '--deck-avail': `${fit.avail}px` } as CSSProperties) : undefined
  const head = (
    <div className="stack-deck-head">
      <span className="stack-deck-title">
        {t('game', 'stack')}
        <span className="stack-deck-count" data-testid="stack-count">{total}</span>
      </span>
      <IconButton
        icon={open ? 'x' : 'maximize'}
        label={open ? t('game', 'compact_view') : t('game', 'expanded_view')}
        variant="ghost"
        size="sm"
        className="stack-deck-toggle"
        data-testid="stack-deck-toggle"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      />
    </div>
  )

  if (open) {
    return (
      <section ref={sectionRef} className="stack-deck is-open" data-testid="stack-deck" data-state="open" style={deckStyle} onTransitionEnd={relayout}>
        {head}
        <div className="stack-timeline" data-testid="stack-timeline">
          {groups.map((group, i) => {
            const [id, card] = group.items[0]
            const count = group.items.length
            const ability = isStackAbility(card)
            const ctrl = getControllerInfo(card, id, players, myPlayerId, t)
            const rules = stackRulesText(card)
            const targets = resolveStackTargetLabels(stackTargetIds(card), stack ?? {}, players)
            const targetable = targetIds.has(id)
            const cost = ability ? [] : costSymbols(card)
            return (
              <RecordedStackEntry
                key={group.items[count - 1][0]}
                id={id}
                className={`stack-trow${i === 0 ? ' is-first' : ''}${targetable ? ' targetable' : ''}${hoverId === id ? ' is-hover' : ''}`}
                onClick={targetable && onCardClick ? () => onCardClick(id) : undefined}
                onMouseEnter={(e) => handleHover(card, e.currentTarget.getBoundingClientRect())}
                onMouseLeave={() => handleHover(null)}
              >
                <span className="stack-trow-inner" style={{ ['--seat' as string]: seatColorVar(seatIndexOf(players, ctrl.id)) }}>
                  <span className="stack-trow-pos">{i === 0 ? '\u25b6' : group.start + 1}</span>
                  <span className="stack-trow-body">
                    <span className="stack-trow-name">
                      <StackEntryCardName card={card} />
                      {count > 1 && <span className="stack-deck-tab-x">\u00d7{count}</span>}
                      {cost.length > 0 && (
                        <span className="stack-trow-cost">
                          {cost.map((sym, k) => (
                            <img key={`${sym}-${k}`} className="stack-trow-pip" src={symbolToSvgPath(sym.replace(/^\{|\}$/g, ''))} alt={sym} draggable={false} />
                          ))}
                        </span>
                      )}
                    </span>
                    <span className="stack-trow-by">{ctrl.name} {'\u00b7'} {stackTypeLabel(card, t)}</span>
                    {rules && (
                      <span className="stack-trow-text">
                        <FormattedText text={rules} cardName={card.sourceCard?.name ?? card.name} />
                      </span>
                    )}
                    {targets.length > 0 && (
                      <span className="stack-trow-target">
                        <Icon name="target" size={12} />
                        {targets.join(', ')}
                      </span>
                    )}
                  </span>
                </span>
              </RecordedStackEntry>
            )
          })}
        </div>
        <FloatingCardPreview card={hoverCard} anchorRect={hoverRect} fixedSide="left" />
      </section>
    )
  }

  const topGroup = groups[0]
  const [topEntryId, topCard] = topGroup.items[0]
  const topTargetable = targetIds.has(topEntryId)
  const topCtrl = getControllerInfo(topCard, topEntryId, players, myPlayerId, t)
  const topTargets = resolveStackTargetLabels(stackTargetIds(topCard), stack ?? {}, players)
  const rest = groups.slice(1)
  const shown = rest.slice(0, fit ? Math.min(STACK_DECK_MAX_TABS, fit.maxTabs) : STACK_DECK_MAX_TABS)
  const hidden = rest.length - shown.length

  return (
    <section ref={sectionRef} className="stack-deck" data-testid="stack-deck" data-state="collapsed" style={deckStyle} onTransitionEnd={relayout}>
      {head}
      <div className={`stack-deck-top owner-${topCtrl.isMe ? 'mine' : 'opponent'}`} data-testid="stack-deck-top" style={{ ['--seat' as string]: seatColorVar(seatIndexOf(players, topCtrl.id)) }}>
        <span className="stack-deck-ctrl" title={`${t('game', 'controller')}: ${topCtrl.name}`}>
          <Icon name={topCtrl.avatarIcon} size={12} />
          <span>{topCtrl.name}</span>
        </span>
        <RecordedStackEntry
          key={topEntryId}
          id={topEntryId}
          className={`stack-deck-face${isStackAbility(topCard) ? ' is-ability' : ''}${topTargetable ? ' targetable' : ''}${topGroup.items.length > 1 ? ' is-group' : ''}`}
          onClick={topTargetable && onCardClick ? () => onCardClick(topEntryId) : undefined}
          onMouseEnter={(e) => handleHover(topCard, e.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => handleHover(null)}
        >
          {cardRender === 'rendered'
            ? <RenderedCard card={topCard} className="stack-deck-card" />
            : <><StackDeckArt card={topCard} className="stack-deck-card" />{stackCaption && <StackDeckCaption card={topCard} />}</>}
          {topGroup.items.length > 1 && <span className="stack-deck-count" data-testid="stack-deck-top-count">×{topGroup.items.length}</span>}
        </RecordedStackEntry>
        {topTargets.length > 0 && (
          <div className="stack-deck-targets" data-testid="stack-targets" title={topTargets.join(', ')}>
            <Icon name="target" size={12} />
            <span>{topTargets.join(', ')}</span>
          </div>
        )}
      </div>
      {shown.length > 0 && (
        <div className="stack-deck-tabs" data-testid="stack-deck-tabs">
          {shown.map((group, i) => {
            const [id, card] = group.items[0]
            const count = group.items.length
            const targetable = targetIds.has(id)
            const ctrl = getControllerInfo(card, id, players, myPlayerId, t)
            const hasTargets = stackTargetIds(card).length > 0
            const position = group.start + 1
            return (
              <RecordedStackEntry
                key={group.items[count - 1][0]}
                id={id}
                style={{ ['--seat' as string]: seatColorVar(seatIndexOf(players, ctrl.id)), ['--z' as string]: i + 1 }}
                className={`stack-deck-tab owner-${ctrl.isMe ? 'mine' : 'opponent'}${targetable ? ' targetable' : ''}${hoverId === id ? ' is-hover' : ''}${count > 1 ? ' is-group' : ''}`}
                onClick={targetable && onCardClick ? () => onCardClick(id) : () => onOpenChange(true)}
                onMouseEnter={(e) => handleHover(card, e.currentTarget.getBoundingClientRect())}
                onMouseLeave={() => handleHover(null)}
              >
                <span className="stack-deck-tab-inner" style={{ ['--inset' as string]: `${Math.min(i * 3, 18)}px` }}>
                  {cardRender !== 'rendered' && <StackDeckThumb card={card} />}
                  <span className="stack-deck-tab-pos">{position}</span>
                  <span className="stack-deck-tab-name"><StackEntryCardName card={card} /></span>
                  <span className="stack-deck-tab-by" title={ctrl.name}>{ctrl.name}</span>
                  {count > 1 && <span className="stack-deck-tab-x">×{count}</span>}
                  {hasTargets && <span className="stack-deck-tab-target"><Icon name="target" size={11} /></span>}
                  <span className="stack-deck-tab-kind">{stackTypeLabel(card, t)}</span>
                </span>
              </RecordedStackEntry>
            )
          })}
          {hidden > 0 && (
            <ChipButton size="xs" pill className="stack-deck-more" data-testid="stack-deck-more" onClick={() => onOpenChange(true)}>
              +{hidden}
            </ChipButton>
          )}
        </div>
      )}
      <FloatingCardPreview card={hoverCard} anchorRect={hoverRect} fixedSide="left" />
    </section>
  )
}
