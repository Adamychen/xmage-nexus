import { useLayoutEffect, useRef, useState, useCallback, useEffect, useContext } from 'react'
import { createPortal } from 'react-dom'
import Tabs from '../ui/Tabs'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import type { ReactNode } from 'react'
import type { CardView, PlayerView } from '../net/types'
import { isAbilityCard } from '../cards/cardImages'
import { useCardImageUrl } from '../cards/useCardImageUrl'
import { useLocalizedCardName } from '../cards/cardLocalization'
import FloatingCardPreview from './FloatingCardPreview'
import FormattedText from '../game/FormattedText'
import { useStore, isBlockingModal } from '../state/store'
import { recordCardPosition } from './cardPositionRegistry'
import { useTranslation } from '../i18n'
import Icon, { type IconName } from '../ui/Icon'
import { clickableProps } from '../ui/clickable'
import { groupAdjacent } from './groupAdjacent'
import { DrawerHeadSlotContext } from '../game/drawerHeadSlot'
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

function stackAbilityIcon(card: CardView): IconName {
  const at = card.abilityType ?? ''
  return at === 'Triggered' || at === 'Triggered Mana' ? 'bell' : 'zap'
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

/** Ids objetivo de un hechizo/habilidad (mismo criterio que las flechas). */
function stackTargetIds(card: CardView): string[] {
  const obj = card as unknown as Record<string, unknown>
  const raw = obj.targets ?? obj.targetIds ?? obj.chosenTargets ?? []
  if (Array.isArray(raw)) {
    return raw
      .map((t) => (typeof t === 'string' ? t : (t as { id?: unknown } | null)?.id))
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
  }
  if (raw && typeof raw === 'object') return Object.keys(raw)
  return []
}

function findZoneCard(players: PlayerView[] | undefined, stack: Record<string, CardView>, id: string): CardView | null {
  for (const p of players ?? []) {
    for (const zone of [p.battlefield, p.graveyard, p.exile]) {
      const hit = (zone as Record<string, CardView> | undefined)?.[id]
      if (hit) return hit
    }
    const cmd = p.commandList as unknown
    if (Array.isArray(cmd)) {
      const hit = (cmd as CardView[]).find((c) => (c as { id?: string } | null)?.id === id)
      if (hit) return hit
    } else if (cmd && typeof cmd === 'object') {
      const hit = (cmd as Record<string, CardView>)[id]
      if (hit) return hit
    }
  }
  return stack[id] ?? null
}

/** Etiquetas legibles de los objetivos: nombre de jugador o de carta permanente. */
function resolveStackTargetLabels(
  ids: string[],
  stack: Record<string, CardView>,
  players?: PlayerView[],
): string[] {
  return ids.map((tid) => {
    const pl = players?.find((p) => p.playerId === tid || p.name === tid)
    if (pl) return pl.name
    const hit = findZoneCard(players, stack, tid)
    return hit?.displayName ?? hit?.name ?? tid
  })
}

interface ControllerInfo {
  id?: string
  name: string
  isMe: boolean
  isOpponent: boolean
  avatarIcon: IconName
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
        avatarIcon: isMe ? 'user' : (matchedPlayer.isHuman ? 'user' : 'bot'),
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
        avatarIcon: isMe ? 'user' : (matchedPlayer.isHuman ? 'user' : 'bot'),
      }
    }
    // Controller name known but not in the player list (e.g. watcher without full roster) — show it
    return {
      name: ctrlName,
      isMe: false,
      isOpponent: true,
      avatarIcon: 'bot',
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
          avatarIcon: isMe ? 'user' : (p.isHuman ? 'user' : 'bot'),
        }
      }
    }
  }

  // 4) Last resort — never label a spectator (no `me`) as "Tú".
  return {
    name: me ? youLabel : (t ? t('lobby', 'deck_unknown') : 'Unknown'),
    isMe: false,
    isOpponent: !me,
    avatarIcon: me ? 'user' : 'info',
  }
}

function stackEntrySignature(
  id: string,
  card: CardView,
  targetIds: Set<string>,
  players: PlayerView[] | undefined,
  myPlayerId: string | null | undefined,
): string | null {
  if (!isStackAbility(card) || targetIds.has(id)) return null
  const ctrl = getControllerInfo(card, id, players, myPlayerId)
  const source = card.sourceCard ?? card
  return [
    ctrl.isMe ? 'me' : ctrl.name,
    card.abilityType ?? '',
    source.name ?? '',
    source.expansionSetCode ?? '',
    source.cardNumber ?? '',
    stackRulesText(card) ?? '',
    stackTargetIds(card).join(','),
  ].join('|')
}

function StackThumbnail({ card }: { card: CardView }) {
  const imgUrl = useCardImageUrl(card)

  return (
    <div className="stack-thumb">
      {imgUrl ? (
        <img src={imgUrl} alt="" className="stack-thumb-img" draggable={false} />
      ) : (
        <div className="stack-thumb-placeholder">
          <Icon name={isStackAbility(card) ? 'zap' : 'layers'} size={18} />
        </div>
      )}
    </div>
  )
}

function StackEntryCardName({ card }: { card: CardView }) {
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
    <div ref={ref} data-card-id={id} className={className} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} {...clickableProps(onClick)}>
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
            <RecordedStackEntry
              key={group.items[count - 1][0]}
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
              </div>
            </RecordedStackEntry>
          )
        })}
      </div>

      <FloatingCardPreview card={hoverCard} anchorRect={hoverRect} fixedSide="left" />
    </div>
  )
}
