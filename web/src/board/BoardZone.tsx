import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CardView, CardsView, PermanentView, PlayerView } from '../net/types'
import CardSlot from './CardSlot'
import HandZone from './HandZone'
import HandViewer from './HandViewer'
import ResourceBar from '../game/ResourceBar'
import PlayerInfoBar from '../game/PlayerInfoBar'
import CommandZone, { hasCommandObjects } from './CommandZone'
import { useZoneScale } from './useZoneScale'
import { useDragScroll } from './useDragScroll'
import { useBandFit } from './useBandFit'
import { useTapFlip } from './useTapFlip'
import { useUntapWave } from './useUntapWave'
import { useTokenPop } from './useTokenPop'
import { useBattlefieldDissolve } from './useBattlefieldDissolve'
import { hasVigilance } from '../cards/cardImages'
import type { CrossZonePlayable } from './crossZone'
import { switchedHandCards, switchableHandKeys } from './handSwitch'
import { useTranslation } from '../i18n'
import Icon from '../ui/Icon'
import { setState, setSwitchedHandKey, useStore } from '../state/store'
import { groupStackables } from './stackGroups'
import type { StackGroup } from './stackGroups'
import StackPile from './StackPile'
import { isMarqueePermanent } from './marquee'
import { bandFill, bandShares, permanentKind } from './bandWeights'
import { cardAspectFor } from './compactCard'
import { EMPTY_TARGET_ZONES, type TargetZoneKind } from './targetZones'
import { isPlayerDefeated, isPlayerOut } from './boardShared'
import { useBattlefieldPulse } from './seatFocus'
import { useMeasuredWidth } from './useMeasuredWidth'
import { pileCornerReaches } from './pileCorner'
import { useSeatColor } from './seatColor'
import './BoardZone.css'
import './PortraitBoard.css'
import './targetZone.css'

export interface BoardZoneProps {
  player: PlayerView | undefined
  position?: 'top' | 'bottom'
  isControlled?: boolean
  hand?: CardsView
  revealedCards?: Record<string, CardView>
  onCardClick?: (id: string) => void
  onHandCardClick?: (id: string, e?: React.MouseEvent) => void
  onCardHover?: (card: CardView | PermanentView | null, rect?: DOMRect) => void
  targetIds?: Set<string>
  targetZone?: TargetZoneKind | null
  targetZones?: ReadonlySet<TargetZoneKind>
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
  kindColumns?: boolean
  statusOnly?: boolean
  seatFocus?: SeatFocusControl
  /** BRD-12: the piles are cards in a corner of the board instead of chips on the status row. */
  pileCards?: boolean
  stackHand?: boolean
}

export interface SeatFocusControl {
  focused: boolean
  onToggle: () => void
  showAll: () => void
  /** Ancho de carta del propio tablero: la carta del foco nunca lo supera. */
  maxCardW?: number
}

/** BRD-12: whether the pile corner reaches into the lands/others row, which then keeps room for it. */
function usePileCornerReach(corner: HTMLElement | null): boolean {
  const [reach, setReach] = useState(false)
  useEffect(() => {
    const zone = corner?.parentElement
    const row = zone?.querySelector<HTMLElement>(':scope > .bz-permanents-row')
    if (!corner || !zone || !row || typeof ResizeObserver === 'undefined') {
      setReach(false)
      return
    }
    const shell = zone.closest<HTMLElement>('.board-shell')
    const hand = shell?.querySelector<HTMLElement>('[data-testid="hand-bar"]')
    const measure = () => {
      const next = pileCornerReaches(corner.getBoundingClientRect(), row.getBoundingClientRect())
      setReach((prev) => (prev === next ? prev : next))
    }
    const ro = new ResizeObserver(measure)
    for (const el of [zone, corner, row, shell, hand]) if (el) ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [corner])
  return reach
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
  targetZone = null,
  targetZones = EMPTY_TARGET_ZONES,
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
  kindColumns = false,
  statusOnly = false,
  seatFocus,
  pileCards = false,
  stackHand = false,
}: BoardZoneProps) {
  const effectivePosition = position ?? (mirrored ? 'bottom' : 'top')
  const effectiveControlled = isControlled ?? (player?.controlled === true)
  const statusSide = effectiveControlled ? 'my' : 'opp'
  const isTop = effectivePosition === 'top'

  const rendered = useStore((s) => s.settings.cardRender) === 'rendered'
  const portrait = useStore((s) => s.settings.gameUi) === 'v2'
  const seatColor = useSeatColor(player?.playerId)
  const isTurnZone = useStore((s) => (s.game?.activePlayerId ? s.game.activePlayerId === player?.playerId : !!player?.isActive))
  const cardStyle = useStore((s) => s.settings.cardStyle)
  const showManaSource = useStore((s) => s.settings.showManaSource)
  const compactCards = cardStyle === 'compact' && !rendered
  const tiltedTaps = useStore((s) => s.settings.tapStyle) === 'tilted'
  const cardAspect = cardAspectFor(compactCards ? 'compact' : 'classic')
  const boardFill = useStore((s) => s.settings.boardFill) && !compactPod
  const shares = useMemo(
    () => bandShares(boardFill
      ? bandFill(player?.battlefield, hasCommandObjects(player, effectiveControlled ? helperEmblems : undefined, statusSide), kindColumns)
      : { creatures: true, permanents: true }),
    [boardFill, player, effectiveControlled, helperEmblems, statusSide, kindColumns],
  )
  const { cardW, ref: zoneRef } = useZoneScale(cardAspect, shares.tallest, seatFocus?.focused ? seatFocus.maxCardW : undefined)
  const [creaturesBandEl, setCreaturesBandEl] = useState<HTMLDivElement | null>(null)
  const [permanentsBandEl, setPermanentsBandEl] = useState<HTMLDivElement | null>(null)
  const [marqueeEl, setMarqueeEl] = useState<HTMLDivElement | null>(null)
  const setCreaturesBand = useCallback((node: HTMLDivElement | null) => setCreaturesBandEl(node), [])
  const setPermanentsBand = useCallback((node: HTMLDivElement | null) => setPermanentsBandEl(node), [])
  const [landsBandEl, setLandsBandEl] = useState<HTMLDivElement | null>(null)
  const [othersBandEl, setOthersBandEl] = useState<HTMLDivElement | null>(null)
  const setLandsBand = useCallback((node: HTMLDivElement | null) => setLandsBandEl(node), [])
  const setOthersBand = useCallback((node: HTMLDivElement | null) => setOthersBandEl(node), [])
  useDragScroll(creaturesBandEl)
  useDragScroll(permanentsBandEl)
  useDragScroll(landsBandEl)
  useDragScroll(othersBandEl)
  useDragScroll(kindColumns ? null : marqueeEl)
  useBandFit(creaturesBandEl, cardW, compactPod, cardAspect)
  useBandFit(permanentsBandEl, cardW, compactPod, cardAspect)
  useBandFit(landsBandEl, cardW, compactPod, cardAspect)
  useBandFit(othersBandEl, cardW, compactPod, cardAspect)
  useTapFlip(permanentsBandEl)
  useTapFlip(landsBandEl)
  useTapFlip(othersBandEl)
  useLayoutEffect(() => {
    if (!kindColumns || !marqueeEl) return
    const sources = [creaturesBandEl, permanentsBandEl, landsBandEl, othersBandEl].filter((el): el is HTMLDivElement => el !== null)
    const sync = () => {
      let w = cardW
      for (const el of sources) {
        const applied = parseFloat(el.style.getPropertyValue('--card-w'))
        if (Number.isFinite(applied) && applied < w) w = applied
      }
      if (w < cardW) marqueeEl.style.setProperty('--card-w', `${w}px`)
      else marqueeEl.style.removeProperty('--card-w')
    }
    sync()
    const observer = new MutationObserver(sync)
    for (const el of sources) observer.observe(el, { attributes: true, attributeFilter: ['style'] })
    return () => {
      observer.disconnect()
      marqueeEl.style.removeProperty('--card-w')
    }
  }, [kindColumns, marqueeEl, cardW, creaturesBandEl, permanentsBandEl, landsBandEl, othersBandEl])
  const gameId = useStore((s) => s.gameId)
  const gamePlayers = useStore((s) => s.game?.players)
  const gameCycle = useStore((s) => s.game?.gameCycle)
  const bandEls = useMemo(
    () => [permanentsBandEl, landsBandEl, othersBandEl, creaturesBandEl],
    [permanentsBandEl, landsBandEl, othersBandEl, creaturesBandEl],
  )
  useUntapWave(bandEls, tiltedTaps)
  useTokenPop(bandEls, player)
  useBattlefieldDissolve(bandEls, gameId, player, { players: gamePlayers, gameCycle })
  const pulseTick = useBattlefieldPulse(player, statusOnly)
  const [pileCornerEl, setPileCornerEl] = useState<HTMLDivElement | null>(null)
  const pileCornerW = useMeasuredWidth(pileCornerEl)
  const pileCornerReach = usePileCornerReach(pileCornerEl)
  const { t } = useTranslation()

  // Switch Hands (Mindslaver & cía.): el servidor envía la mano controlada en `opponentHands`.
  const opponentHands = useStore((s) => s.game?.opponentHands)
  const switchKeys = useMemo(() => switchableHandKeys(opponentHands), [opponentHands])
  const switchedHandKey = useStore((s) => s.switchedHandKey)
  const canSwitchHands = effectiveControlled && switchKeys.length > 0
  // El abanico de la mano flota sobre la status row (z-index 20) y ningún
  // z-index dentro de la zona puede superarlo (la zona crea su propio contexto):
  // el botón se monta como hijo directo del tablero para quedar por encima.
  const [shellEl, setShellEl] = useState<HTMLElement | null>(null)
  const zoneRefWithShell = useCallback(
    (node: HTMLDivElement | null) => {
      zoneRef(node)
      const next = (node?.closest('.board-shell') as HTMLElement | null) ?? null
      setShellEl((prev) => (prev === next ? prev : next))
    },
    [zoneRef],
  )
  const switchedPlayerName = switchedHandKey
    ? (gamePlayers?.find((p) => p.playerId === switchedHandKey || p.name === switchedHandKey)?.name ?? switchedHandKey)
    : null

  const combatSelectableSet = useMemo(() => new Set(combatSelectable), [combatSelectable])
  const combatChosenSet = useMemo(() => new Set(combatChosen), [combatChosen])
  const promptChosenTargets = useStore((s) => (s.feedback?.method === 'GAME_TARGET' ? s.feedback.chosenTargets : undefined))
  const promptChosenSet = useMemo(() => new Set(promptChosenTargets ?? []), [promptChosenTargets])
  const attackingSet = useMemo(() => new Set(attackingIds), [attackingIds])
  const blockingSet = useMemo(() => new Set(blockingIds), [blockingIds])
  const busyIds = useMemo(() => {
    const busy = new Set<string>()
    for (const s of [combatSelectableSet, combatChosenSet, attackingSet, blockingSet]) {
      for (const id of s) busy.add(id)
    }
    return busy
  }, [combatSelectableSet, combatChosenSet, attackingSet, blockingSet])
  const stackExcludedIds = useMemo(() => new Set([...busyIds, ...targetIds]), [busyIds, targetIds])

  const finalHand = useMemo((): CardsView => {
    if (!player) return {}
    // Mano controlada ajena (Switch Hands, Mindslaver): sustituye a la propia.
    const switched = switchedHandCards(opponentHands, switchedHandKey)
    if (switched) return switched
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
  }, [hand, revealedCards, player?.handCount, player?.playerId, switchedHandKey, opponentHands])

  const handEntries = useMemo(() => Object.entries(finalHand), [finalHand])
  const knownHandEntries = useMemo(
    () => handEntries.filter((entry): entry is [string, CardView] => !entry[1].faceDown),
    [handEntries],
  )
  const unknownHandCount = handEntries.length - knownHandEntries.length
  const stackedHand = useMemo((): CardsView => (
    stackHand && unknownHandCount > 0
      ? Object.fromEntries(handEntries.filter(([, card]) => card.faceDown === true))
      : finalHand
  ), [stackHand, unknownHandCount, handEntries, finalHand])
  const [handViewerOpen, setHandViewerOpen] = useState(false)
  const handViewable = !effectiveControlled && knownHandEntries.length > 0

  // Target zone: a card in THIS hand is a target, or the server declares the
  // hand as the zone and nothing resolved (hidden opponent hand: Duress). The
  // own hand lives in the HandBar, so the fallback never touches it.
  const handTargeted = useMemo(() => {
    if (handEntries.some(([id]) => targetIds.has(id))) return true
    return targetZone === 'hand' && !targetZones.has('hand') && !effectiveControlled
  }, [handEntries, targetIds, targetZone, targetZones, effectiveControlled])

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
        ref={zoneRefWithShell}
        className={`board-zone empty ${isTop ? 'zone-top opponent-zone' : 'zone-bottom player-zone'} ${compactPod ? 'compact-pod' : ''} ${className}`}
        style={{ '--card-w': `${cardW}px` } as React.CSSProperties}
      />
    )
  }

  const isDefeated = isPlayerOut(player)
  const wasDefeated = isPlayerDefeated(player)

  const battlefield = player.battlefield ?? {}
  // Phasing (G12-4): lo faseado se trata como si no existiera (desktop: BattlefieldPanel.java:149).
  const permanents = Object.entries(battlefield).filter(([, p]) => p.phasedIn !== false)

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
  // Dock marquee (sagas/planeswalkers/batallas): sale de `others` antes del
  // stacking; tiene lealtad/defensa/lore individuales y nunca se apila.
  const marqueeEntries = others.filter(([, p]) => isMarqueePermanent(p))
  const marqueeIds = new Set(marqueeEntries.map(([id]) => id))
  const restOthers = others.filter(([id]) => !marqueeIds.has(id))

  // Target zone on the battlefield: highlight the row holding the pointed
  // card (or both when the server declares BATTLEFIELD and nothing resolved).
  const battlefieldFallback = targetZone === 'battlefield' && !targetZones.has('battlefield')
  const permanentsRowTargeted =
    battlefieldFallback ||
    lands.some(([id]) => targetIds.has(id)) ||
    restOthers.some(([id]) => targetIds.has(id))
  const creaturesRowTargeted =
    battlefieldFallback ||
    creatures.some(([id]) => targetIds.has(id)) ||
    (!kindColumns && marqueeEntries.some(([id]) => targetIds.has(id)))
  const hasMarqueeColumn = kindColumns && marqueeEntries.length > 0
  const marqueeColumnTargeted = battlefieldFallback || marqueeEntries.some(([id]) => targetIds.has(id))

  const renderCardItem = (id: string, perm: PermanentView, isCreature: boolean) => {
    const isSelectable = combatSelectableSet.has(id)
    const isChosen = combatChosenSet.has(id)
    const isAttacking = attackingSet.has(id)
    const isBlocking = blockingSet.has(id) || (isChosen && combatMode === 'block')
    const isTapped = perm.tapped === true || (isAttacking && !hasVigilance(perm))
    const attachments = (perm.attachments ?? []).filter((attId) => battlefield[attId])
    const mutateParts = perm.mutated
      ? Object.entries(perm.mutateView?.cards ?? {}).filter(([partId, part]) => part && partId !== id).map(([, part]) => part as CardView)
      : []

    const renderAttachments = (offsetPx = 0) => (
      <div className="attachments-list">
        {attachments.map((attId, ai) => {
          const attCard = battlefield[attId]
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
              compact={compactCards}
              showManaSource={showManaSource}
              keywordAura
              style={{ left: `calc(${offsetPx}px + ${ai + 1} * var(--attach-step))`, zIndex: attachments.length - ai }}
            />
          )
        })}
      </div>
    )

    const isTarget = targetIds.has(id)
    const isPlayable = playableIds.has(id) || isSelectable || isChosen

    if (mutateParts.length > 0) {
      return (
        <div
          key={id}
          className={`card-mutate-pile ${attachments.length > 0 ? 'has-attachments' : ''}`}
          data-attachment-host={attachments.length > 0 ? id : undefined}
          style={{ width: `calc(var(--card-w, 100px) + ${mutateParts.length * 14}px + ${attachments.length} * var(--attach-step))` }}
        >
          <div className="mutate-parts">
            {mutateParts.map((part, mi) => (
              <CardSlot
                key={part.id ?? `mp-${mi}`}
                card={part}
                className="mutate-part"
                keywordAura
                compact={compactCards}
                showManaSource={showManaSource}
                style={{ left: `${(mi + 1) * 12}px`, top: `${(mi + 1) * 6}px` }}
              />
            ))}
          </div>
          {attachments.length > 0 && renderAttachments(mutateParts.length * 14)}
          <CardSlot
            cardId={id}
            card={perm}
            onClick={onCardClick ? () => onCardClick(id) : undefined}
            onHover={onCardHover}
            isTarget={isTarget}
            isPlayable={isPlayable}
            isChosen={isChosen || promptChosenSet.has(id)}
            tapped={isTapped}
            attacking={isAttacking}
            blocking={isBlocking}
            showPt={isCreature}
            showCounters
            keywordAura
            showDamage={isCreature}
            compact={compactCards}
            showManaSource={showManaSource}
          />
        </div>
      )
    }

    if (attachments.length > 0) {
      return (
        <div
          key={id}
          className="card-attachment-group"
          data-attachment-host={id}
          style={{ width: `calc(var(--card-w, 100px) + ${attachments.length} * var(--attach-step))` }}
        >
          {renderAttachments()}
          <CardSlot
            cardId={id}
            card={perm}
            onClick={onCardClick ? () => onCardClick(id) : undefined}
            onHover={onCardHover}
            isTarget={isTarget}
            isPlayable={isPlayable}
            isChosen={isChosen || promptChosenSet.has(id)}
            tapped={isTapped}
            attacking={isAttacking}
            blocking={isBlocking}
            showPt={isCreature}
            showCounters
            keywordAura
            showDamage={isCreature}
            compact={compactCards}
            showManaSource={showManaSource}
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
        isChosen={isChosen || promptChosenSet.has(id)}
        tapped={isTapped}
        attacking={isAttacking}
        blocking={isBlocking}
        showPt={isCreature}
        showCounters
        keywordAura
        showDamage={isCreature}
        compact={compactCards}
        showManaSource={showManaSource}
      />
    )
  }

  const { groups: landGroups, solos: landSolos } = groupStackables(lands, 'lands', { excludeIds: stackExcludedIds })
  const { groups: tokenGroups, solos: otherSolos } = groupStackables(restOthers, 'other', { excludeIds: stackExcludedIds })
  const { groups: creatureTokenGroups, solos: creatureSolos } = groupStackables(creatures, 'creatures', { excludeIds: stackExcludedIds })

  const renderStackGroup = (group: StackGroup, isCreature: boolean) => (
    <StackPile
      key={`sg-${group.key}`}
      className={`stack-group${group.kind === 'land' ? ' land-group' : ''} stack-group--${group.kind}`}
      name={group.name}
      count={group.items.length}
      cardIds={group.items.map(([id]) => id)}
      landName={group.kind === 'land' ? group.name : undefined}
    >
      {group.items.map(([id, perm]) => renderCardItem(id, perm, isCreature))}
    </StackPile>
  )

  const handSwitchButton = (
    <button
      type="button"
      data-testid="hand-switch-btn"
      data-switched={switchedHandKey ?? undefined}
      className={`hand-switch-btn ${switchedHandKey ? 'is-switched' : ''}`}
      title={t('game', 'switch_hand')}
      onClick={() => setSwitchedHandKey(switchedHandKey ? null : (switchKeys[0] ?? null))}
    >
      <Icon name="swap" size={13} />
      <span>{switchedHandKey && switchedPlayerName ? switchedPlayerName : t('game', 'switch_hand')}</span>
    </button>
  )

  const statusRow = (
    <div
      key="status-row"
      className={`bz-row bz-status-row ${isTop ? 'oz-top-row' : 'pz-bottom-row'}${pileCards ? ' has-pile-corner' : ''}`}
    >
      <PlayerInfoBar
        player={player}
        side={statusSide}
        compact={compactPod}
        onClick={onCardClick ? () => onCardClick(player.playerId) : undefined}
        isTarget={targetIds.has(player.playerId)}
        onHover={onCardHover}
        onContextMenu={(e) => {
          e.preventDefault()
          setState({ playerMenu: { playerId: player.playerId, x: e.clientX, y: e.clientY } })
        }}
        stats={portrait ? (
          <>
          <ResourceBar
            player={player}
            side={statusSide}
            compact
            stats
            noPiles={pileCards}
            crossZonePlayables={effectiveControlled ? crossZonePlayables : undefined}
            onPlayCrossZone={effectiveControlled ? onPlayCrossZone : undefined}
            onCardHover={onCardHover}
            targetIds={targetIds}
            targetZone={targetZone}
            targetZones={targetZones}
            onTargetClick={onCardClick}
          />
          {effectiveControlled && compactPod && <ResourceBar player={player} side="my" poolOnly />}
          </>
        ) : undefined}
        handView={portrait && handViewable ? { known: knownHandEntries.length, onOpen: () => setHandViewerOpen(true) } : undefined}
        pool={portrait && effectiveControlled && !compactPod ? <ResourceBar player={player} side="my" poolOnly /> : undefined}
      />
      {seatFocus && (
        <button
          type="button"
          data-testid={`seat-focus-${player.playerId}`}
          className={`seat-focus-btn${seatFocus.focused ? ' is-focused' : ''}`}
          aria-pressed={seatFocus.focused}
          aria-label={t('board', 'seat_focus')}
          title={t('board', 'seat_focus')}
          onClick={(e) => {
            e.stopPropagation()
            seatFocus.onToggle()
          }}
        >
          <Icon name="maximize" size={12} />
        </button>
      )}
      {seatFocus?.focused && (
        <button
          type="button"
          data-testid="seat-focus-all"
          className="seat-focus-all"
          title={t('board', 'seat_focus_all')}
          onClick={(e) => {
            e.stopPropagation()
            seatFocus.showAll()
          }}
        >
          {t('board', 'seat_focus_all')}
        </button>
      )}
      {!statusOnly && showHand && (!portrait || handTargeted || effectiveControlled) && (
        <HandZone
          cards={stackedHand}
          onCardClick={onHandCardClick ?? onCardClick}
          onHover={onCardHover}
          playableIds={playableIds}
          targetIds={targetIds}
          isTargetZone={handTargeted}
          compact={isTop || compactPod || stackHand}
          stackBacks={compactPod || stackHand}
          alwaysStack={stackHand}
          viewable={handViewable}
          viewKnownCount={knownHandEntries.length}
          onViewHand={() => setHandViewerOpen(true)}
        />
      )}
      {canSwitchHands &&
        (shellEl
          ? createPortal(handSwitchButton, shellEl)
          : handSwitchButton)}
      {!portrait && <ResourceBar
        player={player}
        side={statusSide}
        compact
        micro={compactPod}
        noPiles={pileCards}
        crossZonePlayables={effectiveControlled ? crossZonePlayables : undefined}
        onPlayCrossZone={effectiveControlled ? onPlayCrossZone : undefined}
        onCardHover={onCardHover}
        targetIds={targetIds}
        targetZone={targetZone}
        targetZones={targetZones}
        onTargetClick={onCardClick}
      />}
    </div>
  )

  if (statusOnly) {
    const stripTargetable = targetIds.has(player.playerId)
    const stripTargeted = stripTargetable || Object.keys(battlefield).some((id) => targetIds.has(id))
    const onStripClick = seatFocus
      ? (e: React.MouseEvent) => {
          const target = e.target as Element
          if (target.closest('.player-avatar')) return
          if (stripTargetable && target.closest('.player-info-bar')) return
          seatFocus.onToggle()
        }
      : undefined
    return (
      <div
        ref={zoneRefWithShell}
        className={`board-zone ${effectivePosition === 'top' ? 'zone-top' : 'zone-bottom'} opponent-zone seat-strip${stripTargeted ? ' target-zone' : ''}`}
        data-player-id={player.playerId}
        data-player-name={player.name}
        data-role={effectivePosition === 'top' ? 'opponent' : 'player'}
        data-seat-mode="status"
        onClick={onStripClick}
        style={{ '--seat': seatColor } as React.CSSProperties}
      >
        {pulseTick > 0 && <span key={pulseTick} className="seat-strip-pulse" aria-hidden="true" />}
        {statusRow}
      </div>
    )
  }


  const landSlots = landGroups.length + landSolos.length
  const otherSlots = tokenGroups.length + otherSolos.length

  const pileCorner = pileCards ? (
    <div
      ref={setPileCornerEl}
      className="bz-pile-corner"
      data-testid="pile-corner"
      style={{ '--pile-card-w': 'calc(var(--card-w) * 0.45)' } as React.CSSProperties}
    >
      <ResourceBar
        player={player}
        side={statusSide}
        pileCards
        crossZonePlayables={effectiveControlled ? crossZonePlayables : undefined}
        onPlayCrossZone={effectiveControlled ? onPlayCrossZone : undefined}
        onCardHover={onCardHover}
        targetIds={targetIds}
        targetZone={targetZone}
        targetZones={targetZones}
        onTargetClick={onCardClick}
      />
    </div>
  ) : null

  const permanentsRow = (
    <div
      key="permanents-row"
      className={`bz-row bz-permanents-row oz-permanents-row pz-permanents-row${permanentsRowTargeted ? ' target-zone' : ''}${pileCornerReach ? ' pile-corner-reach' : ''}`}
    >
      {kindColumns ? (
        <>
          {landSlots > 0 && (
            <div
              ref={setLandsBand}
              className="bz-band oz-band pz-band permanents-band bz-lands-band"
              data-testid="lands-band"
              style={{ flexGrow: landSlots }}
            >
              {landGroups.map((group) => renderStackGroup(group, false))}
              {landSolos.map(([id, perm]) => renderCardItem(id, perm, false))}
            </div>
          )}
          {otherSlots > 0 && (
            <div
              ref={setOthersBand}
              className="bz-band oz-band pz-band bz-others-band"
              data-testid="others-band"
              style={{ flexGrow: otherSlots }}
            >
              {tokenGroups.map((group) => renderStackGroup(group, false))}
              {otherSolos.map(([id, perm]) => renderCardItem(id, perm, false))}
            </div>
          )}
        </>
      ) : (
        <div ref={setPermanentsBand} className="bz-band oz-band pz-band permanents-band full-width">
          {landGroups.map((group) => renderStackGroup(group, false))}
          {tokenGroups.map((group) => renderStackGroup(group, false))}
          {landSolos.map(([id, perm]) => renderCardItem(id, perm, false))}
          {otherSolos.map(([id, perm]) => renderCardItem(id, perm, false))}
        </div>
      )}
    </div>
  )

  const creaturesRow = (
    <div
      key="creatures-row"
      className={`bz-row bz-creatures-row oz-creatures-row pz-creatures-row${creaturesRowTargeted ? ' target-zone' : ''}`}
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
            compact={compactPod}
            compactCards={compactCards}
          />
        </div>
      )}
      <div ref={setCreaturesBand} className={`bz-band oz-band pz-band creatures-band ${!hasCommander && !(marqueeEntries.length > 0 && !kindColumns) ? 'full-width' : ''}`}>
        {creatureTokenGroups.map((group) => renderStackGroup(group, true))}
        {creatureSolos.map(([id, perm]) => renderCardItem(id, perm, true))}
      </div>
      {marqueeEntries.length > 0 && !kindColumns && (
        <div ref={setMarqueeEl} className="bz-marquee oz-marquee pz-marquee">
          {marqueeEntries.map(([id, perm]) => renderCardItem(id, perm, false))}
        </div>
      )}
    </div>
  )

  const marqueeColumn = hasMarqueeColumn ? (
    <div
      key="marquee-column"
      ref={setMarqueeEl}
      className={`bz-marquee oz-marquee pz-marquee bz-marquee--column${marqueeColumnTargeted ? ' target-zone' : ''}`}
    >
      {marqueeEntries.map(([id, perm]) => renderCardItem(id, perm, false))}
    </div>
  ) : null

  const hasAnyBoardCards = creatures.length > 0 || hasCommander || lands.length > 0 || others.length > 0
  const noCreatures = hasAnyBoardCards && creatures.length === 0 && !hasCommander
  const noPermanents = hasAnyBoardCards && lands.length === 0 && others.length === 0

  const zoneClasses = [
    'board-zone',
    isTop ? 'zone-top' : 'zone-bottom',
    effectiveControlled ? 'player-zone' : 'opponent-zone',
    mirrored ? 'mirrored' : '',
    compactPod ? 'compact-pod' : '',
    compactCards ? 'card-style-compact' : '',
    hasMarqueeColumn ? 'has-marquee-column' : '',
    pileCards ? 'has-pile-corner' : '',
    tiltedTaps ? 'tap-tilted' : '',
    noCreatures ? 'no-creatures' : '',
    noPermanents ? 'no-permanents' : '',
    !hasAnyBoardCards ? 'zone-empty' : '',
    isDefeated ? 'is-defeated' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div
      className={zoneClasses}
      ref={zoneRefWithShell}
      data-player-id={player.playerId}
      data-player-name={player.name}
      data-role={isTop ? 'opponent' : 'player'}
      data-turn={isTurnZone || undefined}
      data-priority={(player.hasPriority && !isDefeated) || undefined}
      style={{
        '--card-w': `${cardW}px`,
        '--seat': seatColor,
        ...(pileCards ? { '--pile-corner-w': `${pileCornerW}px` } : null),
        ...(shares.uneven
          ? { gridTemplateRows: isTop ? `auto ${shares.permanentsFr}fr ${shares.creaturesFr}fr` : `${shares.creaturesFr}fr ${shares.permanentsFr}fr auto` }
          : null),
      } as React.CSSProperties}
    >
      {isDefeated && (
        <div className="zone-defeated-overlay">
          <div className="zone-defeated-card">
            <span className="zone-defeated-icon">{wasDefeated ? <Icon name="skull" size={28} /> : <Icon name="door" size={28} />}</span>
            <span className="zone-defeated-title">
              {player.name} {wasDefeated ? t('game', 'player_defeated') : t('game', 'player_left')}
            </span>
            <span className="zone-defeated-sub">
              {wasDefeated ? t('game', 'life_zero_desc') : t('game', 'player_left_desc')}
            </span>
          </div>
        </div>
      )}

      {isTop ? [statusRow, permanentsRow, creaturesRow] : [creaturesRow, permanentsRow, statusRow]}
      {pileCorner}
      {marqueeColumn}
      {handViewerOpen && (
        <HandViewer
          playerName={player?.name ?? ''}
          known={knownHandEntries}
          unknownCount={unknownHandCount}
          targetIds={targetIds}
          playableIds={playableIds}
          onCardClick={onHandCardClick ?? onCardClick}
          onClose={() => setHandViewerOpen(false)}
        />
      )}
    </div>
  )
}
