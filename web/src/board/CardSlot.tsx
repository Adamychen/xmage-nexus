import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CardView, PermanentView } from '../net/types'
import { cardName, hiddenFaceDownName } from '../cards/cardImages'
import { useCardImageUrl } from '../cards/useCardImageUrl'
import RenderedCard from '../cards/rendered/RenderedCard'
import { getPreviousCardPosition, getPreviousCardSize, getPreviousCardZone, recordCardPosition } from './cardPositionRegistry'
import { startCardFlight, onFlightLanded, getActiveFlights, subscribeFlights, noteFlightEvent, ENTER_FLIGHT_MS } from './flightManager'
import { combatHoldRemaining, isOffBattlefield } from './combatStrikes'
import { DamageNumbers } from './DamageNumber'
import { useCombatHeld } from './useCombatHeld'
import { fxMotionAllowed, fxMotionDuration } from './fx'
import { useCounterPulse, type CounterPulse } from './useCounterPulse'
import { extractOwnedKeywords } from '../data/keywordExtractor'
import { keywordDisplayName, keywordSummary } from '../data/keywordI18n'
import { cardDesignations, pairedPartnerName, classLevelOf, evidenceCounts, protectorName, type Designation } from './designations'
import { roomDoorKey, roomSidesLabel } from '../game/rooms'
import { useChangeFlag } from '../game/useChangeFlag'
import CardIcons from './CardIcons'
import { basePtValue, ptTrend } from './ptTrend'
import Icon from '../ui/Icon'
import { clickableProps } from '../ui/clickable'
import { useTranslation } from '../i18n'
import { soundManager } from '../audio/soundManager'
import { setState, useSettings, useStore } from '../state/store'
import { useSleeveFor } from '../appearance/useSleeve'
import { perfMark } from '../system/perfProbe'
import { ManaPip } from '../decks/ArenaManaSymbols'
import { artCropUrl, landTapColor, manaSourceSymbols, primaryCardType } from './compactCard'
import type { KeywordIconSet, PtBadgeMode, SicknessStyle } from './cardOverlays'
import KeywordGlyph, { isGlyphKeyword } from './KeywordGlyph'
import { manaPoolElement, spawnManaParticle, type ManaSide } from './manaParticle'
import './CardSlot.css'
import './manaParticle.css'

/** Cota del acuse optimista si el eco del servidor no llega nunca. */
const PENDING_ACK_MS = 3000

function pulseClass(pulse: CounterPulse | undefined): string {
  if (!pulse) return ''
  return ` counter-badge-changed counter-badge-${pulse.direction}${pulse.scale ? ' counter-badge-pulse' : ''}`
}

interface CardSlotProps {
  cardId?: string
  card: CardView | PermanentView
  onClick?: () => void
  onHover?: (card: CardView | PermanentView | null, rect?: DOMRect) => void
  isTarget?: boolean
  isPlayable?: boolean
  isChosen?: boolean
  /** Solo para `onClick` con semántica de selección (toggle) — aria-pressed en el elemento interactivo. */
  ariaPressed?: boolean
  tapped?: boolean
  attacking?: boolean
  blocking?: boolean
  faceDown?: boolean
  className?: string
  style?: React.CSSProperties
  showPt?: boolean
  showCounters?: boolean
  showDamage?: boolean
  /** Compact battlefield tile: art crop with the name, type and mana source overlaid. */
  compact?: boolean
  /** Classic battlefield card: overlay its mana source too (the compact tile always does). */
  showManaSource?: boolean
  /** Settings previews only: local art (never a network lookup) and per-option overrides of the global overlay settings. */
  demo?: { artUrl: string | null; ptBadgeMode?: PtBadgeMode; sicknessStyle?: SicknessStyle; keywordIcons?: KeywordIconSet }
}

export default function CardSlot({
  cardId,
  card,
  onClick,
  onHover,
  isTarget = false,
  isPlayable = false,
  isChosen = false,
  ariaPressed,
  tapped = false,
  attacking = false,
  blocking = false,
  faceDown = false,
  className = '',
  style,
  showPt = false,
  showCounters = false,
  showDamage = false,
  compact = false,
  showManaSource = false,
  demo,
}: CardSlotProps) {
  const { t } = useTranslation()
  const settings = useSettings()
  const ptBadgeMode = demo?.ptBadgeMode ?? settings.ptBadgeMode
  const sicknessStyle = demo?.sicknessStyle ?? settings.sicknessStyle
  const keywordIcons = demo?.keywordIcons ?? settings.keywordIcons
  const sleeve = useSleeveFor(card.controllerId)
  const resolvedImgUrl = useCardImageUrl(card, !faceDown && !demo)
  const imgUrl = demo ? demo.artUrl : resolvedImgUrl
  const isFaceDownCard = faceDown || card.faceDown === true
  const showBack = faceDown || (card.faceDown === true && !imgUrl)
  const renderedFace = settings.cardRender === 'rendered' && !compact && !demo && !showBack
  const cropUrl = compact ? (demo ? demo.artUrl : artCropUrl(imgUrl)) : null
  const [cropFailed, setCropFailed] = useState<string | null>(null)
  const [pendingAck, setPendingAck] = useState<'pending' | 'chosen-pending' | null>(null)
  const [castPhase, setCastPhase] = useState<'press' | 'pop' | null>(null)
  const [pendingRun, setPendingRun] = useState(0)
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const slotRef = useRef<HTMLDivElement>(null)
  const isFirstMountRef = useRef(true)
  const [entering, setEntering] = useState(false)
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [flightState, setFlightState] = useState<'none' | 'hidden' | 'landing'>('none')
  const flightStateRef = useRef(flightState)
  flightStateRef.current = flightState
  const [held, setHeld] = useState(false)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const effectiveId = cardId || card.id
  const recapMark = useStore((s) => (effectiveId ? s.turnRecap?.marks[effectiveId] : undefined))
  const enteredThisTurn = useStore((s) => (effectiveId ? s.enteredThisTurn[effectiveId] === true : false))
  const shownDamage = useCombatHeld(effectiveId ? String(effectiveId) : null, (card as PermanentView).damage ?? 0)
  const targetOptional = useStore((s) => s.feedback?.method === 'GAME_TARGET' && s.feedback.required === false)
  const [tapChanged] = useChangeFlag(tapped)
  const tapManaColor = useMemo(() => landTapColor(card), [card])
  const localPlayerId = useStore((s) => s.game?.players?.find((p) => p.controlled)?.playerId)

  useEffect(() => {
    if (!tapChanged || !tapped || !tapManaColor || !localPlayerId || !card.controllerId) return
    const from = slotRef.current?.getBoundingClientRect()
    const side: ManaSide = card.controllerId === localPlayerId ? 'my' : 'opp'
    const pool = manaPoolElement(side)
    if (from && pool && from.width > 0) spawnManaParticle(from, pool, tapManaColor)
  }, [tapChanged, tapped, tapManaColor, localPlayerId, card.controllerId])

  const clearPending = useCallback(() => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current)
      pendingTimerRef.current = null
    }
    setPendingAck(null)
  }, [])

  // GAME_UPDATE/GAME_SELECT: el GameView se refresca con objetos nuevos, así que
  // un `card` nuevo es el eco del servidor y el acuse optimista ya sobra.
  useEffect(() => {
    clearPending()
  }, [card, clearPending])

  // Reconciliación con el eco sin vista nueva (chosenTargets/playableIds).
  useEffect(() => {
    if (pendingAck === 'chosen-pending' && (isChosen || !isTarget)) clearPending()
    else if (pendingAck === 'pending' && !isPlayable && !isChosen && !attacking && !blocking) clearPending()
  }, [pendingAck, isChosen, isTarget, isPlayable, attacking, blocking, clearPending])

  useEffect(() => () => {
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current)
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
  }, [])

  useLayoutEffect(() => {
    const el = slotRef.current
    if (!el || !effectiveId) return

    if (isFirstMountRef.current) {
      isFirstMountRef.current = false
      if (el.closest('.feedback-dialog, .library-order-dialog, .card-grid, .mechanics-tray')) {
        return
      }
      const lastRect = el.getBoundingClientRect()
      if (lastRect.width > 0 && lastRect.height > 0) {
        const prev = getPreviousCardPosition(effectiveId)
        const prevZone = getPreviousCardZone(effectiveId)
        if (prev && prev.width > 0) {
          const curZone = el.closest('.opponent-zone, .player-zone, .stack-zone, .hand-zone')
          const curZoneClass = curZone ? curZone.className.split(' ')[0] : ''
          if (!prevZone || !curZoneClass || prevZone !== curZoneClass) {
            const sourceSize = getPreviousCardSize(effectiveId)
            const flyIn = (toRect: DOMRect) => {
              const enteringLand = (card.cardTypes ?? []).some((t) => String(t).toUpperCase() === 'LAND')
              const onBattlefield = !!el.closest('.creatures-band, .permanents-band')
              const variant = !onBattlefield ? undefined : enteringLand ? 'land' : 'enter'
              const flightId = startCardFlight(card, prev, toRect, onBattlefield ? ENTER_FLIGHT_MS : 340, `[data-card-id="${effectiveId}"]`, { sourceSize, toCompact: compact, variant })
              if (!flightId) return
              setFlightState('hidden')
              const land = () => {
                if (flightStateRef.current !== 'hidden') return
                setFlightState('landing')
                setTimeout(() => setFlightState('none'), 180)
              }
              const offLanded = onFlightLanded(flightId, land)
              const unsub = subscribeFlights(() => {
                if (!getActiveFlights().some((f) => f.flightId === flightId)) {
                  land()
                  offLanded()
                  unsub()
                }
              })
            }
            const holdMs = combatHoldRemaining(String(effectiveId))
            if (holdMs > 0) {
              setHeld(true)
              holdTimerRef.current = setTimeout(() => {
                holdTimerRef.current = null
                setHeld(false)
                if (el.isConnected) flyIn(el.getBoundingClientRect())
              }, holdMs)
            } else {
              flyIn(lastRect)
            }
          } else {
            noteFlightEvent({ kind: 'skip', reason: 'same-zone', cardId: String(effectiveId), detail: `slot:${prevZone || '?'}>${curZoneClass || '?'}` })
            setEntering(true)
            enterTimerRef.current = setTimeout(() => { enterTimerRef.current = null; setEntering(false) }, 250)
          }
        } else {
          const mountZone = el.closest('.opponent-zone, .player-zone, .stack-zone, .hand-zone')
          noteFlightEvent({ kind: 'skip', reason: 'no-prev', cardId: String(effectiveId), detail: `slot-mount:${mountZone ? mountZone.className.split(' ')[0] : '?'}` })
          setEntering(true)
          enterTimerRef.current = setTimeout(() => { enterTimerRef.current = null; setEntering(false) }, 250)
        }
      }
    }

    return () => {
      if (el && effectiveId) {
        const zone = el.closest('.opponent-zone, .player-zone, .stack-zone, .hand-zone')
        const zoneClass = zone ? zone.className.split(' ')[0] : ''
        recordCardPosition(
          effectiveId,
          el.getBoundingClientRect(),
          zoneClass,
          { w: el.offsetWidth, h: el.offsetHeight, compact: el.classList.contains('is-compact') }
        )
      }
    }
  }, [effectiveId, card])

  useLayoutEffect(() => {
    const el = slotRef.current
    if (!el || !effectiveId) return
    const holdMs = combatHoldRemaining(String(effectiveId))
    if (holdMs <= 0 || !isOffBattlefield(el)) return
    setHeld(true)
    const release = setTimeout(() => setHeld(false), holdMs + 40 + fxMotionDuration(420))
    return () => clearTimeout(release)
  }, [effectiveId])

  useEffect(() => {
    if (flightState !== 'hidden') return
    const safety = setTimeout(() => setFlightState('landing'), 700)
    return () => clearTimeout(safety)
  }, [flightState])

  const perm = card as PermanentView
  const counters = card.counters ?? []
  const counterPulses = useCounterPulse(counters)

  const types = (card.cardTypes ?? []).map((t) => String(t).toLowerCase())
  const isCreature = types.includes('creature') || String(card.mageObjectType ?? '').toUpperCase().includes('CREATURE')
  const isLand = types.includes('land')
  const isRealCreature = isCreature && (!isLand || types.includes('creature'))
  const isPlaneswalker = types.includes('planeswalker') || String(card.mageObjectType ?? '').toUpperCase().includes('PLANESWALKER')
  const isBattle = types.includes('battle') || String(card.mageObjectType ?? '').toUpperCase().includes('BATTLE')
  const isFlipped = perm.flipped === true

  const loyaltyVal = perm.loyalty ? parseInt(String(perm.loyalty), 10) : 0
  const loyaltySamples = useMemo(
    () => (Number.isFinite(loyaltyVal) && loyaltyVal > 0 ? [{ name: 'loyalty', count: loyaltyVal }] : []),
    [loyaltyVal],
  )
  const loyaltyPulse = useCounterPulse(loyaltySamples).loyalty
  const defenseVal = perm.defense ? parseInt(String(perm.defense), 10) : 0

  const hasSummoningSickness = isRealCreature && !tapped && perm.summoningSickness === true
  const pt = ptTrend(perm)
  const basePower = basePtValue(perm.originalPower)
  const baseToughness = basePtValue(perm.originalToughness)
  const ptTitle = (pt.power !== 'same' || pt.toughness !== 'same') && basePower != null && baseToughness != null
    ? t('game', 'pt_base', { pt: `${basePower}/${baseToughness}` })
    : undefined

  const keywordBadges = useMemo(() => {
    const kws = extractOwnedKeywords(card)
    return kws.filter((k) => ['combat', 'evasion', 'protection'].includes(k.category)).slice(0, 4)
  }, [card.rules, (card as unknown as { abilities?: unknown }).abilities, card.name])

  const designations = useMemo(() => cardDesignations(card.rules), [card.rules])
  // Duskmourn Room doors never travel in the DTO; the unlocked sides are
  // sniffed from the server chat (`sniffRoomDoor`), keyed by card name.
  const roomSides = useStore((s) => {
    const rawSubs = (card as CardView).subTypes
    const subs = Array.isArray(rawSubs) ? rawSubs : []
    if (!subs.some((x) => String(x).toLowerCase() === 'room') || !s.gameId) return ''
    return roomSidesLabel(s.roomDoors[roomDoorKey(s.gameId, cardName(card))])
  })
  const pairPartner = useMemo(() => pairedPartnerName(card.rules), [card.rules])
  const classLevel = useMemo(() => classLevelOf(card.rules), [card.rules])
  const evidence = useMemo(() => evidenceCounts(card.rules), [card.rules])
  const protector = useMemo(() => protectorName(card.rules), [card.rules])
  const manaSymbols = useMemo(() => (compact || showManaSource ? manaSourceSymbols(card) : []), [compact, showManaSource, card.rules, card.subTypes])
  const showManaPill = (compact || showManaSource) && !showBack && !renderedFace && manaSymbols.length > 0
  const tileType = compact ? primaryCardType(card) : null
  // In 'changed' mode the badge only appears when we can PROVE the P/T moved: an
// unknown printed value (token, cloak, disguise — the server sends no
// originalPower) reads as 'same' from ptTrend and would hide the numbers
// forever, so a missing base counts as "show".
const ptBaseKnown = basePower != null || baseToughness != null
const showPtBadge =
    showPt
    && ptBadgeMode !== 'hidden'
    && isRealCreature && perm.power != null && perm.toughness != null
    && (ptBadgeMode === 'always' || !ptBaseKnown || pt.power !== 'same' || pt.toughness !== 'same')
  const hasCornerStat = showPtBadge || (isPlaneswalker && loyaltyVal > 0) || (isBattle && defenseVal > 0)
  const tileArt = cropUrl && cropFailed !== cropUrl ? cropUrl : null
  const visibleCounters = compact
    ? counters.filter((c) => {
      const n = c.name.toLowerCase()
      if (n === 'loyalty') return !(isPlaneswalker && loyaltyVal > 0)
      if (n === 'defense') return !(isBattle && defenseVal > 0)
      return true
    })
    : counters

  const handleClick = onClick ? () => {
    if (isPlayable && fxMotionAllowed()) setCastPhase('press')
    const ackKind = isTarget ? 'chosen-pending' : 'pending'
    // No reenviar el mismo objetivo mientras el eco no lo confirme; el resto
    // de selecciones (jugable/combate) pueden re-clicarse (toggle del servidor).
    if (pendingAck === 'chosen-pending' && !isChosen) return
    setPendingAck(ackKind)
    setPendingRun((n) => n + 1)
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current)
    pendingTimerRef.current = setTimeout(() => {
      pendingTimerRef.current = null
      setPendingAck(null)
    }, PENDING_ACK_MS)
    perfMark('ack', ackKind, undefined, { cardId: String(effectiveId ?? '') })
    soundManager.play('tap', 'game')
    onClick()
  } : undefined

  const handleCastAnimationEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    if (e.animationName === 'castPress') setCastPhase('pop')
    else if (e.animationName === 'castPop' || e.animationName === 'castFade') setCastPhase(null)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    if (isFaceDownCard && !hiddenFaceDownName(card as CardView)) return
    setState({ inspectedCard: card })
  }

  const designationTexts = (d: Designation): { label: string; title: string } => {
    if (d === 'paired' && pairPartner) {
      return {
        label: t('board', 'designation_paired'),
        title: t('board', 'designation_paired_title', { name: pairPartner }),
      }
    }
    if (d === 'classlevel' && classLevel != null) {
      return {
        label: t('board', 'designation_classlevel', { level: String(classLevel) }),
        title: t('board', 'designation_classlevel_title', { level: String(classLevel) }),
      }
    }
    if (d === 'evidence' && evidence) {
      return {
        label: t('board', 'designation_evidence'),
        title: t('board', 'designation_evidence_title', { need: String(evidence.need), collect: String(evidence.canCollect) }),
      }
    }
    if (d === 'protector' && protector) {
      return {
        label: t('board', 'designation_protector'),
        title: t('board', 'designation_protector_title', { name: protector }),
      }
    }
    return { label: t('board', `designation_${d}`), title: t('board', `designation_${d}_title`) }
  }

  return (
    <div
      ref={slotRef}
      data-card-id={cardId ?? effectiveId}
      data-card-name={cardName(card)}
      data-tapped={tapped ? '1' : '0'}
      data-pt={showPt && isRealCreature && perm.power != null && perm.toughness != null ? `${perm.power}/${perm.toughness}` : undefined}
      data-damage={showDamage && isRealCreature && (perm.damage ?? 0) > 0 ? String(perm.damage) : undefined}
      data-recap={recapMark}
      data-entered={enteredThisTurn ? 'turn' : undefined}
      data-counters={showCounters && counters.length > 0 ? counters.map((c) => `${c.name}:${c.count}`).join('|') : undefined}
      className={[
        'card-slot',
        tapped ? 'tapped' : '',
        attacking ? 'attacking' : '',
        blocking ? 'blocking' : '',
        isTarget ? 'targetable' : '',
        isTarget && targetOptional && !isChosen ? 'target-optional' : '',
        isTarget && !targetOptional && !isChosen && pendingAck !== 'chosen-pending' ? 'target-beacon' : '',
        isPlayable ? 'playable' : '',
        isChosen ? 'chosen' : '',
        pendingAck === 'pending' ? 'is-pending' : '',
        tapChanged && tapped && tapManaColor ? `mana-${tapManaColor}` : '',
        pendingAck === 'chosen-pending' ? 'is-chosen-pending' : '',
        castPhase === 'press' ? 'casting-press' : '',
        castPhase === 'pop' ? 'casting-pop' : '',
        isFaceDownCard ? 'face-down' : '',
        isFlipped ? 'is-flipped-card' : '',
        compact ? 'is-compact' : '',
        showManaPill && !compact ? 'has-mana-pill' : '',
        onClick ? 'clickable' : '',
        entering ? 'entering' : '',
        flightState === 'hidden' || held ? 'flight-hidden' : '',
        flightState === 'landing' ? 'flight-land' : '',
        className,
      ].filter(Boolean).join(' ')}
      onClick={handleClick}
      onAnimationEnd={handleCastAnimationEnd}
      {...clickableProps(handleClick)}
      aria-label={onClick ? cardName(card) : undefined}
      aria-pressed={onClick && ariaPressed !== undefined ? ariaPressed : undefined}
      onMouseEnter={onHover ? (e) => onHover(card, e.currentTarget.getBoundingClientRect()) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      onContextMenu={handleContextMenu}
      style={style}
    >
      {showBack ? (
        sleeve.kind === 'css' ? (
          <div className="sleeve-css-back" style={{ background: sleeve.css }} data-sleeve-id={sleeve.id} title={sleeve.name}>
            <span className="sleeve-emblem" style={{ color: sleeve.accent }}>{sleeve.emblem}</span>
          </div>
        ) : (
          <img src={sleeve.imageUrl} alt="" className="card-image" draggable={false} data-sleeve-id={sleeve.id} />
        )
      ) : renderedFace ? (
        <>
          <RenderedCard card={card} />
          <span className="visually-hidden">{card.name || card.alternateName || '?'}</span>
        </>
      ) : imgUrl ? (
        <>
          <img
            src={compact && tileArt ? tileArt : imgUrl}
            alt={cardName(card)}
            className={compact ? (tileArt ? 'card-image card-art-crop' : 'card-image card-art-fallback') : 'card-image'}
            draggable={false}
            onError={tileArt ? () => setCropFailed(tileArt) : undefined}
          />
          {/* Nombre siempre presente como texto (a11y + selectores estables):
              con arte no hay .card-placeholder-name y el nombre visible puede
              estar localizado; este span oculto conserva el inglés estable. */}
          <span className="visually-hidden">{card.name || card.alternateName || '?'}</span>
        </>
      ) : (
        <div className="card-placeholder">
          {!compact && <span className="card-placeholder-name">{cardName(card)}</span>}
        </div>
      )}

      {showManaPill && (
        <div className="compact-mana-source" data-testid="compact-mana-source" data-mana={manaSymbols.join('')}>
          {manaSymbols.map((sym) => (
            sym === 'ANY'
              ? <span key={sym} className="compact-mana-any" />
              : <ManaPip key={sym} symbol={sym} size={16} className="compact-mana-pip" />
          ))}
        </div>
      )}

      {compact && !showBack && (
        <>
          {tapped && (
            <div className="compact-tap-badge" data-testid="compact-tap-badge" title={t('game', 'tapped')}>
              <ManaPip symbol="T" size={16} className="compact-tap-pip" />
            </div>
          )}
          <div className={`compact-plate${hasCornerStat ? ' has-stat' : ''}`} aria-hidden="true">
            <span className="compact-name">{cardName(card)}</span>
            {tileType && !hasCornerStat && (
              <span className="compact-type">{t('game', `type_${tileType}`)}</span>
            )}
          </div>
        </>
      )}

      {showPtBadge && !renderedFace && (
        <div
          className="pt-badge"
          data-trend={pt.power !== 'same' || pt.toughness !== 'same' ? 'changed' : undefined}
          title={ptTitle}
        >
          <span className="pt-value" data-trend={pt.power}>{perm.power}</span>/<span className="pt-value" data-trend={pt.toughness}>{perm.toughness}</span>
        </div>
      )}

      {isPlaneswalker && loyaltyVal > 0 && !renderedFace && (
        <div className={`loyalty-badge${pulseClass(loyaltyPulse)}`} title={`${t('game', 'ability_loyalty')}: ${perm.loyalty}`}>
          <span className="loyalty-icon"><Icon name="shield" size={11} /></span>
          <span className={`loyalty-val${loyaltyPulse?.tick ? ` counter-tick is-${loyaltyPulse.direction}` : ''}`}>{perm.loyalty}</span>
          {loyaltyPulse?.scale && <span key={`ring-${loyaltyPulse.seq}`} className="counter-change-ring" aria-hidden="true" />}
          {loyaltyPulse?.label && (
            <span
              key={`label-${loyaltyPulse.seq}`}
              className={`counter-change-label is-${loyaltyPulse.direction}${loyaltyPulse.scale ? ' counter-change-rise' : ''}`}
              aria-hidden="true"
            >
              {loyaltyPulse.delta > 0 ? `+${loyaltyPulse.delta}` : `${loyaltyPulse.delta}`}
            </span>
          )}
        </div>
      )}

      {isBattle && defenseVal > 0 && !renderedFace && (
        <div className="defense-badge" title={`${t('game', 'damage')}: ${perm.defense}`}>
          <span className="defense-icon"><Icon name="swords" size={11} /></span>
          <span className="defense-val">{perm.defense}</span>
        </div>
      )}

      {perm.mutated === true && (
        <div className="mutated-badge" title={t('board', 'zone_battlefield')}>
          <span className="mutated-icon"><Icon name="dna" size={12} /></span>
        </div>
      )}

      {showCounters && visibleCounters.length > 0 && !renderedFace && (
        <div className="card-counters-wrap">
          {visibleCounters.map((c) => {
            const n = c.name.toLowerCase()
            let iconElement: React.ReactNode = null
            let customClass = ''
            let label = ''

            if (n.includes('+1/+1') || n === 'p1p1') {
              label = `+${c.count}`
              customClass = 'p1p1'
            } else if (n.includes('-1/-1') || n === 'm1m1') {
              label = `-${c.count}`
              customClass = 'm1m1'
            } else if (n.includes('shield')) {
              iconElement = <Icon name="shield" size={10} />
              label = c.count > 1 ? `${c.count}` : ''
              customClass = 'shield'
            } else if (n.includes('stun')) {
              iconElement = <Icon name="bolt" size={10} />
              label = c.count > 1 ? `${c.count}` : ''
              customClass = 'stun'
            } else if (n.includes('oil')) {
              iconElement = <Icon name="drop" size={10} />
              label = `${c.count}`
              customClass = 'oil'
            } else if (n.includes('finality')) {
              iconElement = <Icon name="timer" size={10} />
              customClass = 'finality'
            } else if (n.includes('lore')) {
              iconElement = <Icon name="book" size={10} />
              label = `${c.count}`
              customClass = 'lore'
            } else {
              label = `+${c.count}`
            }

            const pulse = counterPulses[c.name]
            return (
              <div
                key={c.name}
                className={`counter-badge ${customClass}${pulseClass(pulse)}`}
                title={`${c.name}: ${c.count}`}
              >
                {iconElement && <span className="counter-icon-symbol">{iconElement}</span>}
                {label && <span className={`counter-text-val${pulse?.tick ? ` counter-tick is-${pulse.direction}` : ''}`}>{label}</span>}
                {pulse?.scale && <span key={`ring-${pulse.seq}`} className="counter-change-ring" aria-hidden="true" />}
                {pulse?.label && (
                  <span
                    key={`label-${pulse.seq}`}
                    className={`counter-change-label is-${pulse.direction}${pulse.scale ? ' counter-change-rise' : ''}`}
                    aria-hidden="true"
                  >
                    {pulse.delta > 0 ? `+${pulse.delta}` : `${pulse.delta}`}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showDamage && isRealCreature && shownDamage > 0 && (
        <div className="damage-badge">{shownDamage}</div>
      )}

      {enteredThisTurn && <span className="entered-glow" aria-hidden="true" />}

      {recapMark && (
        <div className="recap-mark-badge" data-mark={recapMark} data-testid="recap-mark">
          {t('game', recapMark === 'new' ? 'recap_mark_new' : 'recap_mark_changed')}
        </div>
      )}

      {hasSummoningSickness && sicknessStyle === 'badge' && (
        <div className="sickness-badge" title={t('game', 'summoning_sickness')} aria-label={t('game', 'summoning_sickness')}>
          <Icon name="timer" size={11} />
        </div>
      )}

      {hasSummoningSickness && sicknessStyle === 'veil' && (
        <div className="sickness-veil" aria-hidden="true">
          <Icon name="timer" size={28} />
        </div>
      )}

      {isFaceDownCard && (
        <div className="facedown-badges">
          {perm.morphed && <span className="facedown-type-badge morph" title={t('board', 'morph')}>{t('board', 'morph')}</span>}
          {perm.manifested && <span className="facedown-type-badge manifest" title={t('board', 'manifest')}>{t('board', 'manifest')}</span>}
          {perm.disguised && <span className="facedown-type-badge disguise" title={t('board', 'disguise')}>{t('board', 'disguise')}</span>}
          {perm.cloaked && <span className="facedown-type-badge cloak" title={t('board', 'cloak')}>{t('board', 'cloak')}</span>}
        </div>
      )}

      {(card.transformable || card.secondCardFace != null || card.alternateName != null) && !isFaceDownCard && (
        <div
          className={`card-transform-badge ${perm.transformed ? 'is-transformed' : ''}`}
          title={perm.transformed ? t('wiki', 'face_back') : t('wiki', 'face_front')}
        >
          {perm.transformed ? <Icon name="moon" size={11} /> : <Icon name="sun" size={11} />}
        </div>
      )}

      <CardIcons icons={card.cardIcons} />

      {(designations.length > 0 || roomSides !== '') && (
        <div className="designation-badges">
          {designations.map((d) => {
            const texts = designationTexts(d)
            return (
              <span key={d} className={`designation-badge is-${d}`} title={texts.title}>
                {texts.label}
              </span>
            )
          })}
          {roomSides !== '' && (
            <span className="designation-badge is-room" title={t('board', 'designation_room_title', { sides: roomSides })}>
              {roomSides}
            </span>
          )}
        </div>
      )}

      {keywordBadges.length > 0 && (
        <div className="keyword-badges" aria-label={t('wiki', 'tab_keywords')}>
          {keywordBadges.map((kw) => (
            <span
              key={kw.id}
              className={isGlyphKeyword(kw.id) ? `keyword-badge is-glyph icons-${keywordIcons} kw-${kw.id}` : `keyword-badge cat-${kw.category}`}
              title={`${keywordDisplayName(kw.id, kw.name, (k) => t('keywords', k), kw.parameter)} — ${keywordSummary(kw.id, (k) => t('keywords', k), kw.parameter)}`}
            >
              {isGlyphKeyword(kw.id) ? <KeywordGlyph keyword={kw.id} set={keywordIcons} /> : kw.icon}
            </span>
          ))}
        </div>
      )}

      <DamageNumbers targetKey={`card:${effectiveId}`} />

      {pendingAck === 'pending' && (
        <span
          key={pendingRun}
          className="pending-ack-bar"
          aria-hidden="true"
          style={{ animationDuration: `${PENDING_ACK_MS}ms` }}
        />
      )}
    </div>
  )
}
