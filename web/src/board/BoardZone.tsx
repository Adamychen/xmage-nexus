import { useMemo } from 'react'
import type { CardView, CardsView, PermanentView, PlayerView } from '../net/types'
import CardSlot from './CardSlot'
import HandZone from './HandZone'
import ResourceBar from '../game/ResourceBar'
import PlayerInfoBar from '../game/PlayerInfoBar'
import CommandZone, { hasCommandObjects } from './CommandZone'
import { useZoneScale } from './useZoneScale'
import { hasVigilance } from '../cards/cardImages'
import type { CrossZonePlayable } from './crossZone'
import { useTranslation } from '../i18n'
import Icon from '../ui/Icon'
import './BoardZone.css'

export interface BoardZoneProps {
  player: PlayerView | undefined
  position?: 'top' | 'bottom'
  isControlled?: boolean
  hand?: CardsView
  revealedCards?: Record<string, CardView>
  onCardClick?: (id: string) => void
  onHandCardClick?: (id: string, e?: React.MouseEvent) => void
  onCardHover?: (card: any, rect?: DOMRect) => void
  targetIds?: Set<string>
  playableIds?: Set<string>
  combatSelectable?: string[]
  combatMode?: 'attack' | 'block' | null
  combatChosen?: string[]
  attackingIds?: string[]
  blockingIds?: string[]
  crossZonePlayables?: CrossZonePlayable[]
  onPlayCrossZone?: (id: string) => void
  helperEmblems?: Record<string, CardView>
  compactPod?: boolean
  className?: string
  mirrored?: boolean
  showHand?: boolean
}

function permanentKind(perm: PermanentView): 'creatures' | 'lands' | 'other' {
  const types = perm.cardTypes ?? []
  if (types.some((t) => t === 'Land' || t.toLowerCase() === 'land')) return 'lands'
  if (types.some((t) => t === 'Creature' || t.toLowerCase() === 'creature')) return 'creatures'
  return 'other'
}

export default function BoardZone({
  player,
  position,
  isControlled,
  hand,
  revealedCards,
  onCardClick,
  onHandCardClick,
  onCardHover,
  targetIds = new Set(),
  playableIds = new Set(),
  combatSelectable = [],
  combatMode = null,
  combatChosen = [],
  attackingIds = [],
  blockingIds = [],
  crossZonePlayables,
  onPlayCrossZone,
  helperEmblems,
  compactPod = false,
  className = '',
  mirrored = false,
  showHand = true,
}: BoardZoneProps) {
  const effectivePosition = position ?? (mirrored ? 'bottom' : 'top')
  const effectiveControlled = isControlled ?? (player?.controlled === true)
  const statusSide = effectiveControlled ? 'my' : 'opp'
  const isTop = effectivePosition === 'top'

  const { cardW, ref: zoneRef } = useZoneScale()
  const { t } = useTranslation()

  const combatSelectableSet = useMemo(() => new Set(combatSelectable), [combatSelectable])
  const combatChosenSet = useMemo(() => new Set(combatChosen), [combatChosen])
  const attackingSet = useMemo(() => new Set(attackingIds), [attackingIds])
  const blockingSet = useMemo(() => new Set(blockingIds), [blockingIds])

  const finalHand = useMemo((): CardsView => {
    if (!player) return {}
    const handCount = player.handCount ?? 0

    // 1. Explicit full hand passed (e.g. human player or spectator bottom)
    if (hand && Object.keys(hand).length > 0) {
      const given = Object.entries(hand)
      if (given.length < handCount) {
        const res: Record<string, CardView> = { ...hand }
        for (let i = given.length; i < handCount; i++) {
          const id = `${player.playerId}-unknown-${i}`
          res[id] = {
            id,
            name: '?',
            manaValue: 0,
            expansionSetCode: '',
            cardNumber: '0',
            faceDown: true,
          }
        }
        return res
      }
      return hand
    }

    // 2. Revealed cards (e.g. opponent known cards)
    if (revealedCards && Object.keys(revealedCards).length > 0) {
      const knownCards = Object.entries(revealedCards)
      const knownCount = Math.min(handCount, knownCards.length)
      const unknownCount = Math.max(0, handCount - knownCount)
      const res: Record<string, CardView> = {}

      knownCards.slice(0, knownCount).forEach(([id, card]) => {
        res[id] = {
          ...card,
          id,
          faceDown: false,
        }
      })

      for (let i = 0; i < unknownCount; i++) {
        const id = `opp-${player.playerId}-unknown-${i}`
        res[id] = {
          id,
          name: '?',
          manaValue: 0,
          expansionSetCode: '',
          cardNumber: '0',
          faceDown: true,
        }
      }
      return res
    }

    // 3. Fallback: unknown face-down cards
    if (handCount > 0) {
      const res: Record<string, CardView> = {}
      for (let i = 0; i < handCount; i++) {
        const id = `${player.playerId}-unknown-${i}`
        res[id] = {
          id,
          name: '?',
          manaValue: 0,
          expansionSetCode: '',
          cardNumber: '0',
          faceDown: true,
        }
      }
      return res
    }

    return {}
  }, [hand, revealedCards, player?.handCount, player?.playerId])

  const hasCommander = useMemo(() => {
    return hasCommandObjects(
      player,
      effectiveControlled ? helperEmblems : undefined,
      statusSide
    )
  }, [player, effectiveControlled, helperEmblems, statusSide])

  if (!player) {
    return (
      <div
        className={`board-zone empty ${isTop ? 'zone-top opponent-zone' : 'zone-bottom player-zone'} ${compactPod ? 'compact-pod' : ''} ${className}`}
      />
    )
  }

  const isDefeated = player.hasLeft === true || player.life <= 0

  const battlefield = player.battlefield ?? {}
  const permanents = Object.entries(battlefield)

  // Track attachments to nest them under host permanents
  const attachedIds = new Set<string>()
  permanents.forEach(([, p]) => {
    if (p.attachments && Array.isArray(p.attachments)) {
      p.attachments.forEach((attId) => attachedIds.add(attId))
    }
  })

  const creatures = permanents.filter(([id, p]) => permanentKind(p) === 'creatures' && !attachedIds.has(id))
  const others = permanents.filter(([id, p]) => permanentKind(p) === 'other' && !attachedIds.has(id))
  const lands = permanents.filter(([id, p]) => permanentKind(p) === 'lands' && !attachedIds.has(id))

  const renderCardItem = (id: string, perm: PermanentView, isCreature: boolean) => {
    const isSelectable = combatSelectableSet.has(id)
    const isChosen = combatChosenSet.has(id)
    const isAttacking = attackingSet.has(id) || (isChosen && combatMode === 'attack')
    const isBlocking = blockingSet.has(id) || (isChosen && combatMode === 'block')
    const isTapped = perm.tapped === true || (isAttacking && !hasVigilance(perm))
    const attachments = perm.attachments ?? []
    const mutateParts = perm.mutated
      ? (Object.values(perm.mutateView ?? {}).filter(Boolean) as CardView[])
      : []

    const isTarget = targetIds.has(id)
    const isPlayable = playableIds.has(id) || isSelectable || isChosen

    if (mutateParts.length > 0) {
      return (
        <div
          key={id}
          className={`card-mutate-pile ${attachments.length > 0 ? 'has-attachments' : ''}`}
          style={{ width: `calc(var(--card-w, 100px) + ${(mutateParts.length + attachments.length) * 14}px)` }}
        >
          <div className="mutate-parts">
            {mutateParts.map((part, mi) => (
              <CardSlot
                key={(part as any).id ?? `mp-${mi}`}
                card={part}
                className="mutate-part"
                style={{ left: `${(mi + 1) * 12}px`, top: `${(mi + 1) * 6}px` }}
              />
            ))}
          </div>
          {attachments.length > 0 && (
            <div className="attachments-list">
              {attachments.map((attId, ai) => {
                const attCard = battlefield[attId]
                if (!attCard) return null
                return (
                  <CardSlot
                    key={attId}
                    cardId={attId}
                    card={attCard}
                    onClick={onCardClick ? () => onCardClick(attId) : undefined}
                    onHover={onCardHover}
                    isTarget={targetIds.has(attId)}
                    isPlayable={playableIds.has(attId)}
                    className="attachment-subcard"
                    style={{ left: `${(ai + 1) * 16}px` }}
                  />
                )
              })}
            </div>
          )}
          <CardSlot
            cardId={id}
            card={perm}
            onClick={onCardClick ? () => onCardClick(id) : undefined}
            onHover={onCardHover}
            isTarget={isTarget}
            isPlayable={isPlayable}
            isChosen={isChosen}
            tapped={isTapped}
            attacking={isAttacking}
            blocking={isBlocking}
            showPt={isCreature}
            showCounters
            showDamage={isCreature}
          />
        </div>
      )
    }

    if (attachments.length > 0) {
      return (
        <div
          key={id}
          className="card-attachment-group"
          style={{ width: `calc(var(--card-w, 100px) + ${attachments.length * 16}px)` }}
        >
          <div className="attachments-list">
            {attachments.map((attId, ai) => {
              const attCard = battlefield[attId]
              if (!attCard) return null
              return (
                <CardSlot
                  key={attId}
                  cardId={attId}
                  card={attCard}
                  onClick={onCardClick ? () => onCardClick(attId) : undefined}
                  onHover={onCardHover}
                  isTarget={targetIds.has(attId)}
                  isPlayable={playableIds.has(attId)}
                  className="attachment-subcard"
                  style={{ left: `${(ai + 1) * 16}px` }}
                />
              )
            })}
          </div>
          <CardSlot
            cardId={id}
            card={perm}
            onClick={onCardClick ? () => onCardClick(id) : undefined}
            onHover={onCardHover}
            isTarget={isTarget}
            isPlayable={isPlayable}
            isChosen={isChosen}
            tapped={isTapped}
            attacking={isAttacking}
            blocking={isBlocking}
            showPt={isCreature}
            showCounters
            showDamage={isCreature}
          />
        </div>
      )
    }

    return (
      <CardSlot
        key={id}
        cardId={id}
        card={perm}
        onClick={onCardClick ? () => onCardClick(id) : undefined}
        onHover={onCardHover}
        isTarget={isTarget}
        isPlayable={isPlayable}
        isChosen={isChosen}
        tapped={isTapped}
        attacking={isAttacking}
        blocking={isBlocking}
        showPt={isCreature}
        showCounters
        showDamage={isCreature}
      />
    )
  }

  const statusRow = (
    <div
      key="status-row"
      className={`bz-row bz-status-row ${isTop ? 'oz-top-row' : 'pz-bottom-row'}`}
    >
      <PlayerInfoBar
        player={player}
        side={statusSide}
        onClick={onCardClick ? () => onCardClick(player.playerId) : undefined}
        isTarget={targetIds.has(player.playerId)}
        onHover={onCardHover}
      />
      {showHand && (
        <HandZone
          cards={finalHand}
          onCardClick={onHandCardClick ?? onCardClick}
          onHover={onCardHover}
          playableIds={playableIds}
          targetIds={targetIds}
          compact={isTop || compactPod}
        />
      )}
      <ResourceBar
        player={player}
        side={statusSide}
        compact
        crossZonePlayables={effectiveControlled ? crossZonePlayables : undefined}
        onPlayCrossZone={effectiveControlled ? onPlayCrossZone : undefined}
        onCardHover={onCardHover}
      />
    </div>
  )

  const permanentsRow = (
    <div
      key="permanents-row"
      className="bz-row bz-permanents-row oz-permanents-row pz-permanents-row"
    >
      <div className="bz-band oz-band pz-band permanents-band full-width">
        {lands.map(([id, perm]) => renderCardItem(id, perm, false))}
        {others.map(([id, perm]) => renderCardItem(id, perm, false))}
      </div>
    </div>
  )

  const creaturesRow = (
    <div
      key="creatures-row"
      className="bz-row bz-creatures-row oz-creatures-row pz-creatures-row"
    >
      {hasCommander && (
        <div className="bz-commander oz-commander pz-commander">
          <CommandZone
            player={player}
            side={statusSide}
            onCardClick={onCardClick}
            onHover={onCardHover}
            playableIds={playableIds}
            targetIds={targetIds}
            helperEmblems={effectiveControlled ? helperEmblems : undefined}
          />
        </div>
      )}
      <div className={`bz-band oz-band pz-band creatures-band ${!hasCommander ? 'full-width' : ''}`}>
        {creatures.map(([id, perm]) => renderCardItem(id, perm, true))}
      </div>
    </div>
  )

  const zoneClasses = [
    'board-zone',
    isTop ? 'zone-top opponent-zone' : 'zone-bottom player-zone',
    mirrored ? 'mirrored' : '',
    compactPod ? 'compact-pod' : '',
    isDefeated ? 'is-defeated' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div
      className={zoneClasses}
      ref={zoneRef}
      data-player-id={player.playerId}
      data-player-name={player.name}
      style={{ '--card-w': `${cardW}px` } as React.CSSProperties}
    >
      {isDefeated && (
        <div className="zone-defeated-overlay">
          <div className="zone-defeated-card">
            <span className="zone-defeated-icon">{player.hasLeft ? <Icon name="door" size={28} /> : <Icon name="skull" size={28} />}</span>
            <span className="zone-defeated-title">
              {player.name} {player.hasLeft ? t('game', 'player_left') : t('game', 'player_defeated')}
            </span>
            <span className="zone-defeated-sub">
              {player.hasLeft ? t('game', 'player_left_desc') : t('game', 'life_zero_desc')}
            </span>
          </div>
        </div>
      )}

      {isTop ? [statusRow, permanentsRow, creaturesRow] : [creaturesRow, permanentsRow, statusRow]}
    </div>
  )
}
