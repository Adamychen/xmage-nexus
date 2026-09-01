import { useLayoutEffect, useRef, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { CardView, PlayerView } from '../net/types'
import { awaitImageUrl, isAbilityCard, cardName } from '../cards/cardImages'
import FloatingCardPreview from './FloatingCardPreview'
import FormattedText from '../game/FormattedText'
import { useStore, isBlockingModal } from '../state/store'
import { recordCardPosition } from './cardPositionRegistry'
import { useTranslation } from '../i18n'
import Icon from '../ui/Icon'
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

function isStackAbility(card: CardView): boolean {
  if (isAbilityCard(card)) return true
  const types = card.cardTypes ?? []
  return types.some((t) => typeof t === 'string' && /ability/i.test(t))
}

function isCopyCard(card: CardView): boolean {
  const name = card.name ?? ''
  const disp = card.displayName ?? ''
  return name.includes('[Copia') || name.includes('[Copy') || disp.includes('[Copia') || (card as any).isCopy === true
}

function stackTypeLabel(card: CardView, t: (cat: any, key: any) => string): string {
  if (isStackAbility(card)) {
    const at = card.abilityType ?? ''
    if (at === 'Triggered' || at === 'Triggered Mana') return t('game', 'ability_triggered')
    if (at === 'Activated' || at === 'Mana') return t('game', 'ability_activated')
    if (at === 'Static') return t('game', 'ability_static')
    if (at === 'Loyalty') return t('game', 'ability_loyalty')
    return t('game', 'ability_general')
  }
  const types = card.cardTypes ?? []
  if (types.includes('INSTANT')) return t('game', 'type_instant')
  if (types.includes('SORCERY')) return t('game', 'type_sorcery')
  if (types.includes('CREATURE')) return t('game', 'type_creature')
  if (types.includes('ENCHANTMENT')) return t('game', 'type_enchantment')
  if (types.includes('ARTIFACT')) return t('game', 'type_artifact')
  if (types.includes('PLANESWALKER')) return t('game', 'type_planeswalker')
  if (types.includes('LAND')) return t('game', 'type_land')
  return t('game', 'type_spell')
}

function stackSubtype(card: CardView): string | null {
  if (isStackAbility(card)) return null
  const types = card.cardTypes ?? []
  const subs = Array.isArray(card.subTypes)
    ? card.subTypes.flatMap((v: unknown) => (typeof v === 'string' ? [v] : typeof v === 'object' && v ? Object.keys(v as Record<string, unknown>) : []))
    : []
  const isCreature = types.includes('CREATURE')
  if (isCreature && subs.length) return subs.join(' ')
  if (isCreature && card.power != null && card.toughness != null) return `${card.power}/${card.toughness}`
  return null
}

function stackRulesText(card: CardView): string | null {
  const rules = card.rules ?? []
  if (rules.length) return rules.join('\n')
  return null
}

interface ControllerInfo {
  id?: string
  name: string
  isMe: boolean
  isOpponent: boolean
  avatarIcon: string
}

function getControllerInfo(
  card: CardView,
  id: string,
  players?: PlayerView[],
  myPlayerId?: string | null,
  t?: (cat: any, key: any) => string,
): ControllerInfo {
  const youLabel = t ? t('game', 'you') : 'Tú'
  const ctrlId = card.controllerId ?? card.sourceCard?.controllerId
  const ctrlName = card.controllerName ?? card.sourceCard?.controllerName
  const me = players?.find((p) => p.controlled || (myPlayerId != null && p.playerId === myPlayerId))

  // 1) Match by controller id (player uuid) — works for both your own game and watched games
  if (ctrlId && typeof ctrlId === 'string') {
    const matchedPlayer = players?.find((p) => p.playerId === ctrlId || p.name === ctrlId)
    if (matchedPlayer) {
      const isMe = !!me && (matchedPlayer.controlled || (myPlayerId != null && matchedPlayer.playerId === myPlayerId))
      return {
        id: ctrlId,
        name: isMe ? youLabel : matchedPlayer.name,
        isMe,
        isOpponent: !isMe,
        avatarIcon: isMe ? '👤' : (matchedPlayer.isHuman ? '👤' : '🤖'),
      }
    }
  }

  // 2) Match by controller name directly
  if (ctrlName && typeof ctrlName === 'string') {
    const matchedPlayer = players?.find((p) => p.name === ctrlName)
    if (matchedPlayer) {
      const isMe = !!me && (matchedPlayer.controlled || (myPlayerId != null && matchedPlayer.playerId === myPlayerId))
      return {
        name: isMe ? youLabel : matchedPlayer.name,
        isMe,
        isOpponent: !isMe,
        avatarIcon: isMe ? '👤' : (matchedPlayer.isHuman ? '👤' : '🤖'),
      }
    }
    // Controller name known but not in the player list (e.g. watcher without full roster) — show it
    return {
      name: ctrlName,
      isMe: false,
      isOpponent: true,
      avatarIcon: '🤖',
    }
  }

  // 3) Fallback: card/ability sitting in a player's zone
  if (players) {
    for (const p of players) {
      if (id in (p.battlefield ?? {}) || id in (p.graveyard ?? {})) {
        const isMe = !!me && (p.controlled || (myPlayerId != null && p.playerId === myPlayerId))
        return {
          name: isMe ? youLabel : p.name,
          isMe,
          isOpponent: !isMe,
          avatarIcon: isMe ? '👤' : (p.isHuman ? '👤' : '🤖'),
        }
      }
    }
  }

  // 4) Last resort — never label a spectator (no `me`) as "Tú".
  return {
    name: me ? youLabel : 'Desconocido',
    isMe: false,
    isOpponent: !me,
    avatarIcon: me ? '👤' : '❓',
  }
}

function StackThumbnail({ card }: { card: CardView }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null)

  useEffect(() => {
    if (isStackAbility(card)) {
      const src = card.sourceCard || card.ability
      if (src) {
        let cancelled = false
        awaitImageUrl(src).then((url) => {
          if (!cancelled) setImgUrl(toSmall(url))
        })
        return () => { cancelled = true }
      }
      return
    }
    let cancelled = false
    awaitImageUrl(card).then((url) => {
      if (!cancelled) setImgUrl(toSmall(url))
    })
    return () => { cancelled = true }
  }, [card.expansionSetCode, card.cardNumber, card.name, card.displayName])

  return (
    <div className="stack-thumb">
      {imgUrl ? (
        <img src={imgUrl} alt="" className="stack-thumb-img" draggable={false} />
      ) : (
        <div className="stack-thumb-placeholder">
          {isStackAbility(card) ? '⚡' : '🂠'}
        </div>
      )}
    </div>
  )
}

function toSmall(url: string | null): string | null {
  if (!url) return null
  return url.replace('/normal/', '/small/')
}

/** Entry del stack que registra su rect al desmontar (useLayoutEffect cleanup,
 *  como CardSlot) para que los vuelos de resolución salgan del slot exacto. */
function RecordedStackEntry({
  id,
  className,
  onClick,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  id: string
  className: string
  onClick?: () => void
  onMouseEnter?: (e: React.MouseEvent) => void
  onMouseLeave?: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    return () => {
      if (el && id) recordCardPosition(id, el.getBoundingClientRect(), 'stack-zone')
    }
  }, [id])

  return (
    <div ref={ref} data-card-id={id} className={className} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
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
  const { t } = useTranslation()

  const modalOpen = useStore(isBlockingModal)
  useEffect(() => {
    if (modalOpen) {
      setHoverCard(null)
      setHoverRect(null)
    }
  }, [modalOpen])

  const handleHover = useCallback(
    (card: CardView | null, rect?: DOMRect) => {
      setHoverCard(card)
      setHoverRect(rect ?? null)
      onHover?.(card, rect)
    },
    [onHover]
  )

  const entries = Object.entries(stack ?? {})

  if (entries.length === 0) {
    return (
      <div className="stack-zone empty">
        <div className="stack-empty-state">
          <span className="stack-empty-icon"><Icon name="bolt" size={24} /></span>
          <span className="stack-empty-title">{t('game', 'stack_empty')}</span>
          <span className="stack-empty-desc">{t('game', 'stack_empty_desc')}</span>
        </div>
      </div>
    )
  }

  const ordered = entries

  return (
    <div className={`stack-zone view-mode-${viewMode}`}>
      <div className="stack-header">
        <div className="stack-header-left">
          <span className="stack-header-title">{t('game', 'stack')} ({ordered.length})</span>
        </div>
        <div className="stack-header-actions">
          {canResolve && (
            <button
              type="button"
              className="stack-resolve-header-btn"
              onClick={onResolveClick}
            >
              <Icon name="bolt" size={13} /> {t('game', 'resolve')}
            </button>
          )}
          <div className="stack-view-toggle">
            <button
              type="button"
              className={`toggle-mode-btn ${viewMode === 'compact' ? 'active' : ''}`}
              title={t('game', 'compact_view')}
              onClick={() => setViewMode('compact')}
            >
              ▤
            </button>
            <button
              type="button"
              className={`toggle-mode-btn ${viewMode === 'expanded' ? 'active' : ''}`}
              title={t('game', 'expanded_view')}
              onClick={() => setViewMode('expanded')}
            >
              ▦
            </button>
          </div>
        </div>
      </div>

      <div className="stack-timeline">
        {ordered.map(([id, card], idx) => {
          const isTop = idx === 0
          const isLast = idx === ordered.length - 1
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

          return (
            <RecordedStackEntry
              key={id}
              id={id}
              className={[
                'stack-tl-entry',
                isTop ? 'is-top' : '',
                isAbility ? 'is-ability' : 'is-spell',
                isCopy ? 'is-copy' : '',
                isTargetable ? 'targetable' : '',
                onCardClick ? 'clickable' : '',
                `owner-${ownership}`,
              ].filter(Boolean).join(' ')}
              onClick={onCardClick ? () => onCardClick(id) : undefined}
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
                {/* Position and Controller ribbon */}
                <div className="stack-tl-pos-row">
                  <span className="stack-tl-pos">
                    {isTop ? '▶ #1' : `#${idx + 1}`}
                  </span>
                  <span className={`stack-controller-pill ${ctrlInfo.isMe ? 'is-me' : 'is-opp'}`} title={`${t('game', 'controller')}: ${ctrlInfo.name}`}>
                    <span className="ctrl-icon">{ctrlInfo.avatarIcon}</span>
                    <span className="ctrl-name">{ctrlInfo.name}</span>
                  </span>
                </div>

                <div className="stack-tl-card">
                  {viewMode === 'compact' && <StackThumbnail card={card} />}

                  <div className="stack-tl-info">
                    <div className="stack-tl-name-row">
                      <span className="stack-tl-name">{cardName(card)}</span>
                      {manaCost && (
                        <span className="stack-tl-mana">
                          <FormattedText text={manaCost} />
                        </span>
                      )}
                    </div>
                    <div className="stack-tl-type-row">
                      <span className={`stack-tl-type-badge ${isAbility ? 'type-ability' : 'type-spell'}`}>
                        {isAbility ? (typeLabel.includes('Disparada') ? '🔔' : '⚡') : ''} {typeLabel}
                      </span>
                      {subtype && <span className="stack-tl-subtype">{subtype}</span>}
                      {ptLine && <span className="stack-tl-pt">{ptLine}</span>}
                      {isCopy && <span className="stack-tl-copy-badge">✨ {t('game', 'copy_badge')}</span>}
                    </div>
                    {rulesText && viewMode === 'expanded' && (
                      <div className="stack-tl-rules">
                        <FormattedText text={rulesText} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </RecordedStackEntry>
          )
        })}
      </div>

      <FloatingCardPreview card={hoverCard} anchorRect={hoverRect} fixedSide="left" />
    </div>
  )
}
