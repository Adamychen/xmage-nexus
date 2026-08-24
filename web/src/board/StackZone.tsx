import { useCallback, useEffect, useState } from 'react'
import type { CardView, PlayerView } from '../net/types'
import { awaitImageUrl, isAbilityCard, cardName } from '../cards/cardImages'
import FloatingCardPreview from './FloatingCardPreview'
import FormattedText from '../game/FormattedText'
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

function stackTypeLabel(card: CardView): string {
  if (isStackAbility(card)) {
    const at = card.abilityType ?? ''
    if (at === 'Triggered' || at === 'Triggered Mana') return 'Disparada'
    if (at === 'Activated' || at === 'Mana') return 'Activada'
    if (at === 'Static') return 'Estática'
    if (at === 'Loyalty') return 'Lealtad'
    return 'Habilidad'
  }
  const types = card.cardTypes ?? []
  if (types.includes('INSTANT')) return 'Instantáneo'
  if (types.includes('SORCERY')) return 'Conjuro'
  if (types.includes('CREATURE')) return 'Criatura'
  if (types.includes('ENCHANTMENT')) return 'Encantamiento'
  if (types.includes('ARTIFACT')) return 'Artefacto'
  if (types.includes('PLANESWALKER')) return 'Planeswalker'
  if (types.includes('LAND')) return 'Tierra'
  return 'Hechizo'
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
): ControllerInfo {
  const ctrlId = (card as any).controllerId || (card as any).ownerId || (card as any).controller || (card as any).owner || card.parentId

  const me = players?.find((p) => p.controlled || (myPlayerId && p.playerId === myPlayerId))

  if (ctrlId && typeof ctrlId === 'string') {
    const matchedPlayer = players?.find((p) => p.playerId === ctrlId || p.name === ctrlId)
    if (matchedPlayer) {
      const isMe = !!me && (matchedPlayer.controlled || (myPlayerId != null && matchedPlayer.playerId === myPlayerId))
      return {
        id: ctrlId,
        name: isMe ? 'Tú' : matchedPlayer.name,
        isMe,
        isOpponent: !isMe,
        avatarIcon: isMe ? '👤' : (matchedPlayer.isHuman ? '👤' : '🤖'),
      }
    }
  }

  // Check if the card/ability is in a player's zones
  if (players) {
    for (const p of players) {
      if (id in (p.battlefield ?? {}) || id in (p.graveyard ?? {})) {
        const isMe = !!me && (p.controlled || (myPlayerId != null && p.playerId === myPlayerId))
        return {
          name: isMe ? 'Tú' : p.name,
          isMe,
          isOpponent: !isMe,
          avatarIcon: isMe ? '👤' : (p.isHuman ? '👤' : '🤖'),
        }
      }
    }
  }

  // Unknown controller — never label a spectator (no `me`) as "Tú".
  return {
    name: me ? 'Tú' : 'Desconocido',
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
          <span className="stack-empty-icon">⚡</span>
          <span className="stack-empty-title">Pila vacía</span>
          <span className="stack-empty-desc">Los hechizos y habilidades jugados aparecerán aquí para resolver.</span>
        </div>
      </div>
    )
  }

  const ordered = entries

  return (
    <div className={`stack-zone view-mode-${viewMode}`}>
      <div className="stack-header">
        <div className="stack-header-left">
          <span className="stack-header-title">Pila ({ordered.length})</span>
        </div>
        <div className="stack-header-actions">
          {canResolve && (
            <button
              type="button"
              className="stack-resolve-header-btn"
              onClick={onResolveClick}
            >
              ⚡ Resolver
            </button>
          )}
          <div className="stack-view-toggle">
            <button
              type="button"
              className={`toggle-mode-btn ${viewMode === 'compact' ? 'active' : ''}`}
              title="Vista compacta con timeline"
              onClick={() => setViewMode('compact')}
            >
              ▤
            </button>
            <button
              type="button"
              className={`toggle-mode-btn ${viewMode === 'expanded' ? 'active' : ''}`}
              title="Vista expandida con cartas"
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
          const typeLabel = stackTypeLabel(card)
          const subtype = stackSubtype(card)
          const rulesText = stackRulesText(card)
          const manaCost = (card.manaCostLeftStr ?? []).join('')
          const isTargetable = targetIds.has(id)
          const ctrlInfo = getControllerInfo(card, id, players, myPlayerId)
          const ownership = ctrlInfo.isMe ? 'mine' : 'opponent'
          const ptLine = !isAbility && card.power != null && card.toughness != null
            ? `${card.power}/${card.toughness}`
            : null

          return (
            <div
              key={id}
              data-card-id={id}
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
                  <span className={`stack-controller-pill ${ctrlInfo.isMe ? 'is-me' : 'is-opp'}`} title={`Controlador: ${ctrlInfo.name}`}>
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
                      {isCopy && <span className="stack-tl-copy-badge">✨ Copia</span>}
                    </div>
                    {rulesText && viewMode === 'expanded' && (
                      <div className="stack-tl-rules">
                        <FormattedText text={rulesText} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <FloatingCardPreview card={hoverCard} anchorRect={hoverRect} fixedSide="left" />
    </div>
  )
}
