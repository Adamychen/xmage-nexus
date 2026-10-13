import { useEffect, useMemo, useRef, useState } from 'react'
import type { CardView, PermanentView, PlayerView } from '../net/types'
import PileOverlay from '../board/PileOverlay'
import CrossZoneOverlay from '../board/CrossZoneOverlay'
import { crossZoneCounts } from '../board/crossZone'
import type { CrossZonePlayable } from '../board/crossZone'
import { cardsContainTarget, EMPTY_TARGET_IDS, EMPTY_TARGET_ZONES, type TargetZoneKind } from '../board/targetZones'
import CardSlot from '../board/CardSlot'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import ManaPoolView, { type ManaPoolKey } from './ManaPoolView'
import { useStore } from '../state/store'
import { sendPlayerManaType } from '../net/commands'
import { manaTypeOf } from './manaPayment'
import { useSleeveFor } from '../appearance/useSleeve'
import { useTopCardPeek, visibleTopCardPeek } from './topCardPeek'
import './ResourceBar.css'
import '../board/targetZone.css'

type PileKind = 'graveyard' | 'exile' | 'library'

interface ResourceBarProps {
  player: PlayerView
  side: 'opp' | 'my'
  compact?: boolean
  micro?: boolean
  crossZonePlayables?: CrossZonePlayable[]
  onPlayCrossZone?: (id: string) => void
  onCardHover?: (card: CardView | PermanentView | null, rect?: DOMRect) => void
  targetIds?: Set<string>
  targetZone?: TargetZoneKind | null
  targetZones?: ReadonlySet<TargetZoneKind>
  onTargetClick?: (id: string) => void
}

function extractCards(cardsView: unknown): CardView[] {
  if (!cardsView || typeof cardsView !== 'object') return []
  if (Array.isArray(cardsView)) return cardsView.filter(Boolean) as CardView[]
  return Object.values(cardsView).filter(Boolean) as CardView[]
}

export default function ResourceBar({
  player,
  side,
  compact = false,
  micro = false,
  crossZonePlayables,
  onPlayCrossZone,
  onCardHover,
  targetIds,
  targetZone = null,
  targetZones = EMPTY_TARGET_ZONES,
  onTargetClick,
}: ResourceBarProps) {
  const { t } = useTranslation()
  const [openPile, setOpenPile] = useState<'graveyard' | 'exile' | 'crosszone' | 'library' | null>(null)
  const gameId = useStore((s) => s.gameId)
  const librarySleeve = useSleeveFor(side === 'my' ? player.playerId : null)
  const pool = player.manaPool ?? {}
  const canPayMana = side === 'my' && !!gameId
  const manaPromptOpen = useStore((s) => s.feedback?.mode === 'mana')
  const playableIds = useStore((s) => s.playableIds)
  const topCardPeek = useTopCardPeek()
  const peekedCard = side === 'my' ? visibleTopCardPeek(topCardPeek, player) : null
  const peekId = peekedCard?.id && peekedCard.id !== player.topCard?.id ? peekedCard.id : null
  const peekCard = peekId ? peekedCard : null
  const peekPlayable = !!peekId && !!onPlayCrossZone && (playableIds ?? []).includes(peekId)
  const peekSlot = peekCard ? (
    <div
      className="library-peek"
      data-testid="library-peek"
      title={t('game', 'top_card_peek', { name: peekCard.displayName || peekCard.name })}
    >
      <CardSlot
        cardId={peekId ?? undefined}
        card={peekCard}
        className="library-peek-card"
        isPlayable={peekPlayable}
        onClick={peekPlayable && peekId ? () => onPlayCrossZone?.(peekId) : undefined}
        onHover={onCardHover}
      />
      <span className="top-card-badge">
        <Icon name="eye" size={micro ? 10 : 12} />
      </span>
    </div>
  ) : null
  const payMana = (key: ManaPoolKey) => {
    const manaType = manaTypeOf(key)
    if (gameId && manaType) void sendPlayerManaType(gameId, player.playerId, manaType)
  }

  const graveyardCards = useMemo(() => extractCards(player.graveyard), [player.graveyard])
  const graveyardCount = graveyardCards.length
  const topGraveyardCard = useMemo(() => (graveyardCards.length > 0 ? graveyardCards[graveyardCards.length - 1] : null), [graveyardCards])

  const exileCards = useMemo(() => extractCards(player.exile), [player.exile])
  const exileCount = exileCards.length
  const topExileCard = useMemo(() => (exileCards.length > 0 ? exileCards[exileCards.length - 1] : null), [exileCards])

  const crossZone = crossZonePlayables ?? []
  const counts = useMemo(() => crossZoneCounts(crossZone), [crossZone])
  const topCrossZoneCard = useMemo(() => (crossZone.length > 0 ? crossZone[0].card : null), [crossZone])

  const playableByZone = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    for (const p of crossZone) {
      const key = p.zone === 'graveyard' ? 'graveyard' : p.zone === 'library' ? 'library' : 'exile'
      if (!map[key]) map[key] = new Set()
      map[key].add(p.id)
    }
    return map
  }, [crossZone])

  const libraryCards = useMemo(() => {
    const res: Record<string, CardView> = {}
    const count = player.libraryCount ?? 0
    if (count <= 0) return res

    if (player.topCard) {
      const topId = player.topCard.id || `lib-top-${player.playerId}`
      res[topId] = {
        ...player.topCard,
        id: topId,
        faceDown: false,
      }
    }

    const startIndex = player.topCard ? 2 : 1
    for (let i = startIndex; i <= count; i++) {
      const id = `lib-${player.playerId}-${i}`
      res[id] = {
        id,
        name: t('game', 'card_number', { count: i }),
        manaValue: 0,
        expansionSetCode: '',
        cardNumber: '0',
        faceDown: true,
        controllerId: player.playerId,
      }
    }
    return res
  }, [player.libraryCount, player.topCard, player.playerId])

  // ── Target zone (GAME_TARGET with targetZone): highlight the pile holding
  //    the card to pick. The local id match rules; if the prompt declares the
  //    zone but no id resolved there, the own pile stays as a "look here"
  //    fallback.
  const targetSet: ReadonlySet<string> = targetIds ?? EMPTY_TARGET_IDS
  const graveyardTargeted = useMemo(() => cardsContainTarget(player.graveyard, targetSet), [player.graveyard, targetSet])
  const exileTargeted = useMemo(() => cardsContainTarget(player.exile, targetSet), [player.exile, targetSet])
  const libraryTargeted = useMemo(() => {
    const top = player.topCard
    if (!top) return false
    return (top.id != null && targetSet.has(top.id)) || (top.parentId != null && targetSet.has(top.parentId))
  }, [player.topCard, targetSet])

  const pendingZone = (kind: PileKind) => targetZone === kind && !targetZones.has(kind) && side === 'my'
  const graveyardHighlight = graveyardTargeted || (pendingZone('graveyard') && graveyardCount > 0)
  const exileHighlight = exileTargeted || (pendingZone('exile') && exileCount > 0)
  const libraryHighlight = libraryTargeted || (pendingZone('library') && (player.libraryCount ?? 0) > 0)

  // Auto-opens the target pile (only when the real card is located: the
  // library overlay paints synthetic backs that are not clickable targets) and
  // closes it when the targeting ends.
  const autoOpenPile: PileKind | null =
    targetZone === 'graveyard' && graveyardTargeted ? 'graveyard'
      : targetZone === 'exile' && exileTargeted ? 'exile'
        : targetZone === 'library' && libraryTargeted ? 'library'
          : null
  const autoOpenedRef = useRef<PileKind | null>(null)
  useEffect(() => {
    if (autoOpenPile) {
      autoOpenedRef.current = autoOpenPile
      setOpenPile(autoOpenPile)
      return
    }
    const previous = autoOpenedRef.current
    if (previous) {
      autoOpenedRef.current = null
      setOpenPile((current) => (current === previous ? null : current))
    }
  }, [autoOpenPile])

  return (
    <div className={`resource-bar ${side} ${compact ? 'compact' : ''} ${micro ? 'micro' : ''}`}>
      <div className="resource-mana-wrap">
        <ManaPoolView pool={pool} canPay={canPayMana} onPay={payMana} showAll={manaPromptOpen && side === 'my'} />
      </div>

      <div className={`resource-piles ${micro ? 'micro' : ''}`}>
        {micro ? (
          <>
            {peekSlot}

            <button
              type="button"
              data-library-count={player.libraryCount}
              className={`resource-chip library-chip clickable-pile ${player.topCard ? 'has-top-revealed' : ''}${libraryHighlight ? ' target-zone' : ''}`}
              title={
                player.topCard
                  ? `${t('game', 'pile_library')}: ${player.libraryCount} (${player.topCard.name})`
                  : `${t('game', 'pile_library')}: ${player.libraryCount}`
              }
              onClick={() => setOpenPile('library')}
              onMouseEnter={(e) =>
                player.topCard && onCardHover?.(player.topCard, e.currentTarget.getBoundingClientRect())
              }
              onMouseLeave={() => onCardHover?.(null)}
            >
              <span className="chip-icon"><Icon name="bookOpen" size={12} /></span>
              <span className="chip-count">{player.libraryCount}</span>
              {player.topCard && (
                <span className="chip-indicator" title={t('board', 'zone_revealed')}>
                  <Icon name="target" size={10} />
                </span>
              )}
            </button>

            <button
              type="button"
              data-graveyard-count={graveyardCount}
              className={`resource-chip graveyard-chip clickable-pile ${counts.graveyard > 0 ? 'has-playable' : ''}${graveyardHighlight ? ' target-zone' : ''}`}
              title={
                topGraveyardCard
                  ? `${t('game', 'pile_graveyard')}: ${graveyardCount} (${topGraveyardCard.name || topGraveyardCard.displayName})`
                  : `${t('game', 'pile_graveyard')}: 0`
              }
              onClick={() => setOpenPile('graveyard')}
              onMouseEnter={(e) =>
                topGraveyardCard && onCardHover?.(topGraveyardCard, e.currentTarget.getBoundingClientRect())
              }
              onMouseLeave={() => onCardHover?.(null)}
            >
              <span className="chip-icon">
                <Icon name="skull" size={12} />
              </span>
              <span className="chip-count">{graveyardCount}</span>
              {counts.graveyard > 0 && <span className="chip-playable-dot" />}
            </button>

            <button
              type="button"
              data-exile-count={exileCount}
              className={`resource-chip exile-chip clickable-pile ${counts.exile > 0 ? 'has-playable' : ''}${exileHighlight ? ' target-zone' : ''}`}
              title={
                topExileCard
                  ? `${t('game', 'pile_exile')}: ${exileCount} (${topExileCard.name || topExileCard.displayName})`
                  : `${t('game', 'pile_exile')}: 0`
              }
              onClick={() => setOpenPile('exile')}
              onMouseEnter={(e) =>
                topExileCard && onCardHover?.(topExileCard, e.currentTarget.getBoundingClientRect())
              }
              onMouseLeave={() => onCardHover?.(null)}
            >
              <span className="chip-icon">
                <Icon name="portal" size={12} />
              </span>
              <span className="chip-count">{exileCount}</span>
              {counts.exile > 0 && <span className="chip-playable-dot" />}
            </button>

            {side === 'my' && (
              <button
                type="button"
                className={`resource-chip ray-chip clickable-pile ${crossZone.length > 0 ? 'has-playable' : ''}`}
                title={`${t('game', 'cross_zone_title')}: ${crossZone.length}`}
                onClick={() => setOpenPile('crosszone')}
                onMouseEnter={(e) =>
                  topCrossZoneCard && onCardHover?.(topCrossZoneCard, e.currentTarget.getBoundingClientRect())
                }
                onMouseLeave={() => onCardHover?.(null)}
              >
                <span className="chip-icon">
                  <Icon name="bolt" size={12} />
                </span>
                <span className="chip-count">{crossZone.length}</span>
                {crossZone.length > 0 && <span className="chip-playable-dot" />}
              </button>
            )}
          </>
        ) : (
          <>
            {peekSlot}

            <button
              type="button"
              data-library-count={player.libraryCount}
              className={`resource-stack library-stack clickable-pile ${player.topCard ? 'has-top-revealed' : ''}${libraryHighlight ? ' target-zone' : ''}`}
              title={
                player.topCard
                  ? `${t('game', 'pile_library')}: ${player.libraryCount} (${player.topCard.name})`
                  : `${t('game', 'pile_library')}: ${player.libraryCount}`
              }
              onClick={() => setOpenPile('library')}
              onMouseEnter={(e) =>
                player.topCard && onCardHover?.(player.topCard, e.currentTarget.getBoundingClientRect())
              }
              onMouseLeave={() => onCardHover?.(null)}
            >
              {player.topCard ? (
                <CardSlot card={player.topCard} className="library-top-card" />
              ) : (
                librarySleeve.kind === 'css' ? (
                  <div className="stack-back-img sleeve-css-back" style={{ background: librarySleeve.css }} data-sleeve-id={librarySleeve.id}>
                    <span className="sleeve-emblem" style={{ color: librarySleeve.accent }}>{librarySleeve.emblem}</span>
                  </div>
                ) : (
                  <img className="stack-back-img" src={librarySleeve.imageUrl} alt="" draggable={false} data-sleeve-id={librarySleeve.id} />
                )
              )}
              <span className="stack-count">{player.libraryCount}</span>
              {player.topCard && (
                <span className="top-card-badge" title={t('board', 'zone_revealed')}>
                  <Icon name="target" size={12} />
                </span>
              )}
            </button>

            <button
              type="button"
              data-graveyard-count={graveyardCount}
              className={`resource-stack graveyard-stack clickable-pile ${counts.graveyard > 0 ? 'has-playable' : ''} ${topGraveyardCard ? 'has-card-img' : 'is-empty'}${graveyardHighlight ? ' target-zone' : ''}`}
              title={
                topGraveyardCard
                  ? `${t('game', 'pile_graveyard')}: ${graveyardCount} (${topGraveyardCard.name || topGraveyardCard.displayName})`
                  : `${t('game', 'pile_graveyard')}: 0`
              }
              onClick={() => setOpenPile('graveyard')}
              onMouseEnter={(e) =>
                topGraveyardCard && onCardHover?.(topGraveyardCard, e.currentTarget.getBoundingClientRect())
              }
              onMouseLeave={() => onCardHover?.(null)}
            >
              {topGraveyardCard ? (
                <CardSlot card={topGraveyardCard} className="graveyard-top-card" />
              ) : (
                <div className="stack-card-back graveyard-back">
                  <span className="stack-mark">
                    <Icon name="skull" size={20} />
                  </span>
                </div>
              )}
              <span className="stack-count">{graveyardCount}</span>
              {counts.graveyard > 0 && <span className="playable-badge">{counts.graveyard}</span>}
            </button>

            <button
              type="button"
              data-exile-count={exileCount}
              className={`resource-stack exile-stack clickable-pile ${counts.exile > 0 ? 'has-playable' : ''} ${topExileCard ? 'has-card-img' : 'is-empty'}${exileHighlight ? ' target-zone' : ''}`}
              title={
                topExileCard
                  ? `${t('game', 'pile_exile')}: ${exileCount} (${topExileCard.name || topExileCard.displayName})`
                  : `${t('game', 'pile_exile')}: 0`
              }
              onClick={() => setOpenPile('exile')}
              onMouseEnter={(e) =>
                topExileCard && onCardHover?.(topExileCard, e.currentTarget.getBoundingClientRect())
              }
              onMouseLeave={() => onCardHover?.(null)}
            >
              {topExileCard ? (
                <CardSlot card={topExileCard} className="exile-top-card" />
              ) : (
                <div className="stack-card-back exile-back">
                  <span className="stack-mark">
                    <Icon name="portal" size={20} />
                  </span>
                </div>
              )}
              <span className="stack-count">{exileCount}</span>
              {counts.exile > 0 && <span className="playable-badge">{counts.exile}</span>}
            </button>

            {side === 'my' && (
              <button
                type="button"
                className={`resource-stack ray-stack clickable-pile ${crossZone.length > 0 ? 'has-playable' : ''} ${topCrossZoneCard ? 'has-card-img' : 'is-empty'}`}
                title={`${t('game', 'cross_zone_title')}: ${crossZone.length}`}
                onClick={() => setOpenPile('crosszone')}
                onMouseEnter={(e) =>
                  topCrossZoneCard && onCardHover?.(topCrossZoneCard, e.currentTarget.getBoundingClientRect())
                }
                onMouseLeave={() => onCardHover?.(null)}
              >
                {topCrossZoneCard ? (
                  <>
                    <CardSlot card={topCrossZoneCard} className="ray-top-card" />
                    <div className="ray-mini-badge" title={t('game', 'cross_zone_title')}>
                      <Icon name="bolt" size={10} />
                    </div>
                  </>
                ) : (
                  <div className="stack-card-back ray-back">
                    <Icon name="bolt" size={18} />
                  </div>
                )}
                <span className="stack-count">{crossZone.length}</span>
                {crossZone.length > 0 && <span className="playable-badge">{crossZone.length}</span>}
              </button>
            )}
          </>
        )}
      </div>

         {openPile === 'library' && (
           <PileOverlay
            title={`${t('game', 'pile_library')} - ${player.name || t('common', 'player')}`}
            cards={libraryCards}
            onClose={() => setOpenPile(null)}
            playableIds={playableByZone.library}
            onPlayCard={onPlayCrossZone}
            targetIds={targetIds}
            onTargetClick={onTargetClick}
            isLibrary={true}
           />
         )}
         {openPile === 'graveyard' && (
           <PileOverlay
            title={t('game', 'pile_graveyard')}
            cards={player.graveyard ?? {}}
            onClose={() => setOpenPile(null)}
            playableIds={playableByZone.graveyard}
            onPlayCard={onPlayCrossZone}
            targetIds={targetIds}
            onTargetClick={onTargetClick}
           />
         )}
         {openPile === 'exile' && (
           <PileOverlay
            title={t('game', 'pile_exile')}
            cards={player.exile ?? {}}
            onClose={() => setOpenPile(null)}
            playableIds={playableByZone.exile}
            onPlayCard={onPlayCrossZone}
            targetIds={targetIds}
            onTargetClick={onTargetClick}
           />
         )}
         {openPile === 'crosszone' && (
           <CrossZoneOverlay
            playables={crossZone}
            onClose={() => setOpenPile(null)}
            onPlay={(id) => {
             setOpenPile(null)
             onPlayCrossZone?.(id)
            }}
           />
         )}
       </div>
      )
}
