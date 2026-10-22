import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CardView, PermanentView } from '../net/types'
import { cardName, hiddenFaceDownName } from '../cards/cardImages'
import { useCardImageUrl } from '../cards/useCardImageUrl'
import RenderedCard from '../cards/rendered/RenderedCard'
import { getPreviousCardPosition, getPreviousCardSize, getPreviousCardZone, recordCardPosition } from './cardPositionRegistry'
import { startCardFlight, onFlightLanded, getActiveFlights, subscribeFlights, noteFlightEvent, flightLandingDelay, ENTER_FLIGHT_MS } from './flightManager'
import { combatHoldRemaining, isOffBattlefield } from './combatStrikes'
import { CONTROL_FLIGHT_MS, controlChangeTint } from './controlFx'
import { COMMAND_FLIGHT_MS, commandReturnSource } from './commandFx'
import { ANIMATE_FLIGHT_MS, SETTLE_FLIGHT_MS, animateTint, creatureShiftOf } from './creatureShiftFx'
import { DamageNumbers } from './DamageNumber'
import { useCombatHeld } from './useCombatHeld'
import { fxMotionAllowed, fxMotionDuration } from './fx'
import { counterPulseClass as pulseClass, useCounterPulse } from './useCounterPulse'
import { extractOwnedKeywords } from '../data/keywordExtractor'
import { keywordDisplayName, keywordSummary } from '../data/keywordI18n'
import { cardDesignations, gainedDesignations, pairedPartnerName, classLevelOf, evidenceCounts, protectorName, type Designation } from './designations'
import { roomDoorKey, roomSidesLabel } from '../game/rooms'
import { useChangeFlag } from '../game/useChangeFlag'
import CardIcons from './CardIcons'
import BadgeTip from '../ui/BadgeTip'
import { MAX_BADGES, mergeBadgeKeywords } from './cardBadges'
import { useBadgeFit } from './useBadgeFit'
import { useBadgeLayout } from './useBadgeLayout'
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
import type { KeywordAuraMode, KeywordIconSet, PtBadgeMode, SicknessStyle } from './cardOverlays'
import KeywordGlyph from './KeywordGlyph'
import { dominantAuraKeyword, gainedKeywordIds } from './keywordAura'
import { manaPoolElement, spawnManaParticle, type ManaSide } from './manaParticle'
import './CardSlot.css'
import './KeywordAura.css'
import './manaParticle.css'

/** Cota del acuse optimista si el eco del servidor no llega nunca. */
const PENDING_ACK_MS = 3000
/** Grace after the clone's landing time before the real card is revealed anyway. */
const FLIGHT_BACKSTOP_MARGIN_MS = 40
const FLIGHT_LAND_FADE_MS = 180
const seenKeywordsByCard = new Map<string, string>()
const KEYWORD_GAIN_MS = 900

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
  /** Battlefield permanents only: draw the looping aura of the card's main keyword. */
  keywordAura?: boolean
  /** Settings previews only: local art (never a network lookup) and per-option overrides of the global overlay settings. */
  demo?: { artUrl: string | null; ptBadgeMode?: PtBadgeMode; sicknessStyle?: SicknessStyle; keywordIcons?: KeywordIconSet; keywordAura?: KeywordAuraMode }
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
  keywordAura = false,
  demo,
}: CardSlotProps) {
  const { t } = useTranslation()
  const settings = useSettings()
  const ptBadgeMode = demo?.ptBadgeMode ?? settings.ptBadgeMode
  const sicknessStyle = demo?.sicknessStyle ?? settings.sicknessStyle
  const keywordIcons = demo?.keywordIcons ?? settings.keywordIcons
  const auraMode = demo?.keywordAura ?? settings.keywordAura
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
  const [flightState, setFlightState] = useState<'none' | 'hidden' | 'landing'>('none')
  const [flightId, setFlightId] = useState<string | null>(null)
  const [held, setHeld] = useState(false)
  const [hold, setHold] = useState<{ ms: number } | null>(null)
  const holdFlyRef = useRef<((rect: DOMRect) => void) | null>(null)

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
  }, [])

  useEffect(() => {
    if (!hold) return
    const release = setTimeout(() => {
      setHold(null)
      setHeld(false)
      const fly = holdFlyRef.current
      holdFlyRef.current = null
      const el = slotRef.current
      if (el?.isConnected && fly) fly(el.getBoundingClientRect())
    }, hold.ms)
    return () => clearTimeout(release)
  }, [hold])

  useEffect(() => {
    if (!entering) return
    const release = setTimeout(() => setEntering(false), 250)
    return () => clearTimeout(release)
  }, [entering])

  useEffect(() => {
    if (flightState !== 'landing') return
    const fade = setTimeout(() => setFlightState('none'), FLIGHT_LAND_FADE_MS)
    return () => clearTimeout(fade)
  }, [flightState])

  useEffect(() => {
    if (!flightId) return
    let backstop: ReturnType<typeof setTimeout> | undefined
    const detach = () => {
      clearTimeout(backstop)
      offLanded()
      unsub()
    }
    const settle = () => {
      detach()
      setFlightState('landing')
    }
    const check = () => {
      const left = flightLandingDelay(flightId)
      if (left === null || left <= 0) settle()
      else backstop = setTimeout(check, left + FLIGHT_BACKSTOP_MARGIN_MS)
    }
    const offLanded = onFlightLanded(flightId, settle)
    const unsub = subscribeFlights(() => {
      if (!getActiveFlights().some((f) => f.flightId === flightId)) settle()
    })
    backstop = setTimeout(check, (flightLandingDelay(flightId) ?? 0) + FLIGHT_BACKSTOP_MARGIN_MS)
    return detach
  }, [flightId])

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
        const commandFrom = el.closest('.command-zone') ? commandReturnSource(String(effectiveId)) : null
        const prev = commandFrom?.rect ?? getPreviousCardPosition(effectiveId)
        const prevZone = getPreviousCardZone(effectiveId)
        if (prev && prev.width > 0) {
          const curZone = el.closest('.opponent-zone, .player-zone, .stack-zone, .hand-zone')
          const curZoneClass = curZone ? curZone.className.split(' ')[0] : ''
          const controlTint = controlChangeTint(String(effectiveId))
          const shift = el.closest('.creatures-band, .permanents-band, .bz-marquee') ? creatureShiftOf(String(effectiveId)) : null
          if (commandFrom || !prevZone || !curZoneClass || prevZone !== curZoneClass || controlTint || shift) {
            const sourceSize = commandFrom ? commandFrom.size : getPreviousCardSize(effectiveId)
            const flyIn = (toRect: DOMRect) => {
              const enteringLand = (card.cardTypes ?? []).some((t) => String(t).toUpperCase() === 'LAND')
              const onBattlefield = !!el.closest('.creatures-band, .permanents-band')
              const variant = commandFrom ? 'command' : !onBattlefield ? undefined : controlTint ? 'control' : shift === 'rise' ? 'animate' : shift ? undefined : enteringLand ? 'land' : 'enter'
              const duration = commandFrom ? COMMAND_FLIGHT_MS : !onBattlefield ? 340 : controlTint ? CONTROL_FLIGHT_MS : shift === 'rise' ? ANIMATE_FLIGHT_MS : shift ? SETTLE_FLIGHT_MS : ENTER_FLIGHT_MS
              const tint = controlTint ?? (shift === 'rise' ? animateTint(card) : null)
              const flightId = startCardFlight(card, prev, toRect, duration, `[data-card-id="${effectiveId}"]`, { sourceSize, toCompact: compact, variant, tint: tint ?? undefined })
              if (!flightId) return
              setFlightState('hidden')
              setFlightId(flightId)
            }
            const holdMs = combatHoldRemaining(String(effectiveId))
            if (holdMs > 0) {
              setHeld(true)
              holdFlyRef.current = flyIn
              setHold({ ms: holdMs })
            } else {
              flyIn(lastRect)
            }
          } else {
            noteFlightEvent({ kind: 'skip', reason: 'same-zone', cardId: String(effectiveId), detail: `slot:${prevZone || '?'}>${curZoneClass || '?'}` })
            setEntering(true)
          }
        } else {
          const mountZone = el.closest('.opponent-zone, .player-zone, .stack-zone, .hand-zone')
          noteFlightEvent({ kind: 'skip', reason: 'no-prev', cardId: String(effectiveId), detail: `slot-mount:${mountZone ? mountZone.className.split(' ')[0] : '?'}` })
          setEntering(true)
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

  const hideFaceDownKeywords = isFaceDownCard && (!localPlayerId || card.controllerId !== localPlayerId)
  const allKeywords = useMemo(() => {
    if (hideFaceDownKeywords) return []
    const merged = mergeBadgeKeywords(card.cardIcons, extractOwnedKeywords(card), Infinity)
    return perm.mutated === true ? [{ id: 'mutate', name: 'Mutate', icon: '', category: 'mechanic' as const }, ...merged] : merged
  }, [hideFaceDownKeywords, perm.mutated, card.rules, card.cardIcons, (card as unknown as { abilities?: unknown }).abilities, card.name])
  const keywordBadges = useMemo(() => allKeywords.slice(0, MAX_BADGES), [allKeywords])

  const allKeywordIdsKey = allKeywords.map((kw) => kw.id).join('|')
  const [seenKeywordIds, setSeenKeywordIds] = useState(() => seenKeywordsByCard.get(String(effectiveId)) ?? allKeywordIdsKey)
  const [gainedKeywords, setGainedKeywords] = useState<string[]>([])
  if (seenKeywordIds !== allKeywordIdsKey) {
    setSeenKeywordIds(allKeywordIdsKey)
    const fresh = gainedKeywordIds(seenKeywordIds.split('|'), allKeywordIdsKey.split('|'))
    setGainedKeywords((running) => [...running, ...fresh.filter((id) => !running.includes(id))])
  }
  useEffect(() => {
    const key = String(effectiveId)
    seenKeywordsByCard.set(key, allKeywordIdsKey)
    return () => {
      seenKeywordsByCard.delete(key)
    }
  }, [effectiveId, allKeywordIdsKey])
  useEffect(() => {
    if (gainedKeywords.length === 0) return
    const expire = setTimeout(() => setGainedKeywords([]), KEYWORD_GAIN_MS)
    return () => clearTimeout(expire)
  }, [gainedKeywords])
  const auraKeyword = keywordAura && auraMode !== 'off' && !showBack && !isFaceDownCard
    ? dominantAuraKeyword(allKeywords.map((kw) => kw.id))
    : null

  const badgeRowRef = useRef<HTMLDivElement>(null)
  const shownBadges = useBadgeFit(badgeRowRef, keywordBadges.length)
  const hiddenBadges = allKeywords.slice(shownBadges)
  useBadgeLayout(slotRef)

  const designations = useMemo(() => cardDesignations(card.rules), [card.rules])
  const [seenRules, setSeenRules] = useState(card.rules)
  const [gainedDes, setGainedDes] = useState<Designation[]>([])
  const [swell, setSwell] = useState(false)
  if (seenRules !== card.rules) {
    const fresh = gainedDesignations(seenRules, card.rules)
    setSeenRules(card.rules)
    setGainedDes([...gainedDes.filter((d) => designations.includes(d) && !fresh.includes(d)), ...fresh])
    if (fresh.includes('monstrous') || fresh.includes('renowned')) setSwell(true)
  }
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
        swell ? 'fx-designation-swell' : '',
        className,
      ].filter(Boolean).join(' ')}
      onClick={handleClick}
      onAnimationEnd={(e) => {
        if (e.animationName === 'designationSwell') setSwell(false)
        handleCastAnimationEnd(e)
      }}
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
        <div className="compact-mana-source" data-badge-zone="mana" data-testid="compact-mana-source" data-mana={manaSymbols.join('')}>
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
            <BadgeTip className="compact-tap-badge" data-testid="compact-tap-badge" data-badge-zone="tap" tip={{ title: t('game', 'tapped') }}>
              <ManaPip symbol="T" size={16} className="compact-tap-pip" />
            </BadgeTip>
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
        <BadgeTip
          className="pt-badge"
          data-badge-zone="stats"
          data-trend={pt.power !== 'same' || pt.toughness !== 'same' ? 'changed' : undefined}
          tip={{ title: `${perm.power}/${perm.toughness}`, body: ptTitle }}
        >
          <span className="pt-value" data-trend={pt.power}>{perm.power}</span>/<span className="pt-value" data-trend={pt.toughness}>{perm.toughness}</span>
        </BadgeTip>
      )}

      {isPlaneswalker && loyaltyVal > 0 && !renderedFace && (
        <BadgeTip className={`loyalty-badge${pulseClass(loyaltyPulse)}`} data-badge-zone="stats" tip={{ title: `${t('game', 'ability_loyalty')}: ${perm.loyalty}` }}>
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
        </BadgeTip>
      )}

      {isBattle && defenseVal > 0 && !renderedFace && (
        <BadgeTip className="defense-badge" data-badge-zone="stats" tip={{ title: `${t('game', 'damage')}: ${perm.defense}` }}>
          <span className="defense-icon"><Icon name="swords" size={11} /></span>
          <span className="defense-val">{perm.defense}</span>
        </BadgeTip>
      )}

      {showCounters && visibleCounters.length > 0 && !renderedFace && (
        <div className="card-counters-wrap" data-badge-zone="counters">
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
              <BadgeTip
                key={c.name}
                className={`counter-badge ${customClass}${pulseClass(pulse)}`}
                tip={{ title: `${c.name}: ${c.count}` }}
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
              </BadgeTip>
            )
          })}
        </div>
      )}

      {showDamage && isRealCreature && shownDamage > 0 && (
        <BadgeTip className="damage-badge" data-badge-zone="stats" tip={{ title: `${t('game', 'damage')}: ${shownDamage}` }}>{shownDamage}</BadgeTip>
      )}

      {enteredThisTurn && <span className="entered-glow" aria-hidden="true" />}

      {auraKeyword && (
        <span
          className={`kw-aura kw-aura--${auraKeyword}${auraMode === 'vivid' ? ' is-vivid' : ''}`}
          data-kw-aura={auraKeyword}
          aria-hidden="true"
        />
      )}
      {auraKeyword && gainedKeywords.includes(auraKeyword) && (
        <span key={`flare-${allKeywordIdsKey}`} className={`kw-aura-flare kw-aura-flare--${auraKeyword}`} aria-hidden="true" />
      )}

      {recapMark && (
        <div className="recap-mark-badge" data-mark={recapMark} data-testid="recap-mark">
          {t('game', recapMark === 'new' ? 'recap_mark_new' : 'recap_mark_changed')}
        </div>
      )}

      {hasSummoningSickness && sicknessStyle === 'badge' && (
        <BadgeTip className="sickness-badge" data-badge-zone="sickness" tip={{ title: t('game', 'summoning_sickness') }}>
          <Icon name="timer" size={11} />
        </BadgeTip>
      )}

      {hasSummoningSickness && sicknessStyle === 'veil' && (
        <div className="sickness-veil">
          <BadgeTip className="sickness-veil-icon" tip={{ title: t('game', 'summoning_sickness') }}>
            <Icon name="timer" size={28} />
          </BadgeTip>
        </div>
      )}

      {isFaceDownCard && (
        <div className="facedown-badges" data-badge-zone="facedown">
          {([['morphed', 'morph'], ['manifested', 'manifest'], ['disguised', 'disguise'], ['cloaked', 'cloak']] as const).map(([flag, id]) =>
            perm[flag] ? (
              <BadgeTip
                key={id}
                className={`facedown-type-badge ${id}`}
                tip={{ title: t('board', id), body: keywordSummary(id, (k) => t('keywords', k)) || undefined }}
              >
                {t('board', id)}
              </BadgeTip>
            ) : null,
          )}
        </div>
      )}

      {(card.transformable || card.secondCardFace != null || card.alternateName != null) && !isFaceDownCard && (
        <BadgeTip
          className={`card-transform-badge ${perm.transformed ? 'is-transformed' : ''}`}
          data-badge-zone="transform"
          tip={{ title: perm.transformed ? t('wiki', 'face_back') : t('wiki', 'face_front') }}
        >
          {perm.transformed ? <Icon name="moon" size={11} /> : <Icon name="sun" size={11} />}
        </BadgeTip>
      )}

      <CardIcons icons={hideFaceDownKeywords ? undefined : card.cardIcons} />

      {(designations.length > 0 || roomSides !== '') && (
        <div className="designation-badges" data-badge-zone="designation">
          {designations.map((d) => {
            const texts = designationTexts(d)
            return (
              <BadgeTip
                key={d === 'classlevel' ? `classlevel-${classLevel}` : d}
                className={`designation-badge is-${d}${gainedDes.includes(d) ? ` designation-gained designation-gained--${d}` : ''}`}
                tip={{ title: texts.title }}
              >
                {texts.label}
              </BadgeTip>
            )
          })}
          {roomSides !== '' && (
            <BadgeTip className="designation-badge is-room" tip={{ title: t('board', 'designation_room_title', { sides: roomSides }) }}>
              {roomSides}
            </BadgeTip>
          )}
        </div>
      )}

      {keywordBadges.length > 0 && (
        <div className="keyword-badges" data-badge-zone="keyword" ref={badgeRowRef} aria-label={t('wiki', 'tab_keywords')}>
          {keywordBadges.slice(0, shownBadges).map((kw) => (
            <BadgeTip
              key={kw.id}
              className={`keyword-badge kw-coin is-glyph cat-${kw.category} icons-${keywordIcons} kw-${kw.id}${kw.id === 'mutate' ? ' mutated-badge' : ''}${gainedKeywords.includes(kw.id) ? ' kw-gained' : ''}`}
              tip={{
                title: keywordDisplayName(kw.id, kw.name, (k) => t('keywords', k), kw.parameter),
                body: keywordSummary(kw.id, (k) => t('keywords', k), kw.parameter),
              }}
            >
              <KeywordGlyph id={kw.id} category={kw.category} set={keywordIcons} />
            </BadgeTip>
          ))}
          {hiddenBadges.length > 0 && (
            <BadgeTip
              className="keyword-badge keyword-badge-more"
              tip={{
                title: hiddenBadges.map((kw) => keywordDisplayName(kw.id, kw.name, (k) => t('keywords', k), kw.parameter)).join(', '),
              }}
            >
              {`+${hiddenBadges.length}`}
            </BadgeTip>
          )}
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
