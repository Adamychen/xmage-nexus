import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CardView, PermanentView } from '../net/types'
import { awaitImageUrl, cardName } from '../cards/cardImages'
import { consumePreviousCardPosition, recordCardPosition } from './cardPositionRegistry'
import { startCardFlight } from './flightManager'
import { extractKeywordsFromCard } from '../data/keywordExtractor'
import CardIcons from './CardIcons'
import Icon from '../ui/Icon'
import './CardSlot.css'

const CARD_BACK_URL = 'https://cards.scryfall.io/back.png'

interface CardSlotProps {
  cardId?: string
  card: CardView | PermanentView
  onClick?: () => void
  onHover?: (card: CardView | PermanentView | null, rect?: DOMRect) => void
  isTarget?: boolean
  isPlayable?: boolean
  isChosen?: boolean
  tapped?: boolean
  faceDown?: boolean
  className?: string
  style?: React.CSSProperties
  showPt?: boolean
  showCounters?: boolean
  showDamage?: boolean
}

export default function CardSlot({
  cardId,
  card,
  onClick,
  onHover,
  isTarget = false,
  isPlayable = false,
  isChosen = false,
  tapped = false,
  faceDown = false,
  className = '',
  style,
  showPt = false,
  showCounters = false,
  showDamage = false,
}: CardSlotProps) {
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const slotRef = useRef<HTMLDivElement>(null)
  const isFirstMountRef = useRef(true)

  const effectiveId = cardId || (card as any).id

  useLayoutEffect(() => {
    const el = slotRef.current
    if (!el || !effectiveId) return

    let timerId: ReturnType<typeof setTimeout> | null = null

    if (isFirstMountRef.current) {
      isFirstMountRef.current = false
      if (el.closest('.feedback-dialog, .library-order-dialog, .card-grid, .mechanics-tray')) {
        return
      }
      const lastRect = el.getBoundingClientRect()
      if (lastRect.width > 0 && lastRect.height > 0) {
        const prev = consumePreviousCardPosition(effectiveId)
        if (prev && prev.rect.width > 0) {
          const curZone = el.closest('.opponent-zone, .player-zone, .stack-zone, .hand-zone')
          const curZoneClass = curZone ? curZone.className.split(' ')[0] : ''
          // Only animate flight if changing between different zones
          if (!prev.zone || !curZoneClass || prev.zone !== curZoneClass) {
            const flightId = startCardFlight(card, prev.rect, lastRect, 320)
            if (flightId) {
              el.style.opacity = '0'
              timerId = setTimeout(() => {
                timerId = null
                if (el) {
                  el.style.transition = 'opacity 160ms ease'
                  el.style.opacity = '1'
                }
              }, 300)
            }
          }
        }
      }
    }

    return () => {
      if (timerId !== null) {
        clearTimeout(timerId)
        timerId = null
      }
      if (el) {
        el.style.opacity = ''
        el.style.transition = ''
      }
      if (el && effectiveId) {
        const zone = el.closest('.opponent-zone, .player-zone, .stack-zone, .hand-zone')
        const zoneClass = zone ? zone.className.split(' ')[0] : ''
        recordCardPosition(effectiveId, el.getBoundingClientRect(), zoneClass)
      }
    }
  }, [effectiveId, card])

  useEffect(() => {
    if (faceDown) return
    let cancelled = false
    awaitImageUrl(card).then((url) => {
      if (!cancelled) setImgUrl(url)
    })
    return () => { cancelled = true }
  }, [card.expansionSetCode, card.cardNumber, card.name, (card as any).displayName, faceDown])

  const perm = card as PermanentView
  const counters = card.counters ?? []

  // Strict Type Checks
  const types = (card.cardTypes ?? []).map((t) => String(t).toLowerCase())
  const isCreature = types.includes('creature') || String(card.mageObjectType ?? '').toUpperCase().includes('CREATURE')
  const isLand = types.includes('land')
  const isRealCreature = isCreature && (!isLand || types.includes('creature'))
  const isPlaneswalker = types.includes('planeswalker') || String(card.mageObjectType ?? '').toUpperCase().includes('PLANESWALKER')
  const isBattle = types.includes('battle') || String(card.mageObjectType ?? '').toUpperCase().includes('BATTLE')
  const isFlipped = perm.flipped === true

  const loyaltyVal = perm.loyalty ? parseInt(String(perm.loyalty), 10) : 0
  const defenseVal = perm.defense ? parseInt(String(perm.defense), 10) : 0

  const hasSummoningSickness = isRealCreature && !tapped && perm.summoningSickness === true

  const keywordBadges = useMemo(() => {
    const kws = extractKeywordsFromCard(card)
    return kws.filter((k) => ['combat', 'evasion', 'protection'].includes(k.category)).slice(0, 4)
  }, [card.rules, (card as unknown as { abilities?: unknown }).abilities, card.name])

  return (
    <div
      ref={slotRef}
      data-card-id={cardId ?? effectiveId}
      data-card-name={cardName(card)}
      className={[
        'card-slot',
        tapped ? 'tapped' : '',
        isTarget ? 'targetable' : '',
        isPlayable ? 'playable' : '',
        isChosen ? 'chosen' : '',
        faceDown ? 'face-down' : '',
        isFlipped ? 'is-flipped-card' : '',
        onClick ? 'clickable' : '',
        className,
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      onMouseEnter={onHover ? (e) => onHover(card, e.currentTarget.getBoundingClientRect()) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      style={style}
    >
      {faceDown ? (
        <img src={CARD_BACK_URL} alt="" className="card-image" draggable={false} />
      ) : imgUrl ? (
        <img
          src={imgUrl}
          alt={cardName(card)}
          className="card-image"
          draggable={false}
        />
      ) : (
        <div className="card-placeholder">
          <span className="card-placeholder-name">{cardName(card)}</span>
        </div>
      )}

      {/* Creature Power / Toughness Badge (Creatures only) */}
      {showPt && isRealCreature && perm.power != null && perm.toughness != null && (
        <div className="pt-badge">{perm.power}/{perm.toughness}</div>
      )}

      {/* Planeswalker Loyalty Badge (Planeswalkers only) */}
      {isPlaneswalker && loyaltyVal > 0 && (
        <div className="loyalty-badge" title={`Lealtad: ${perm.loyalty}`}>
          <span className="loyalty-icon">🛡️</span>
          <span className="loyalty-val">{perm.loyalty}</span>
        </div>
      )}

      {/* Battle Defense Badge (Battles only) */}
      {isBattle && defenseVal > 0 && (
        <div className="defense-badge" title={`Defensa: ${perm.defense}`}>
          <span className="defense-icon"><Icon name="swords" size={11} /></span>
          <span className="defense-val">{perm.defense}</span>
        </div>
      )}

      {/* Mutated Permanent Badge (Mutate pile) */}
      {perm.mutated === true && (
        <div className="mutated-badge" title="Criatura mutada (pila de cartas fusionadas)">
          <span className="mutated-icon"><Icon name="dna" size={12} /></span>
        </div>
      )}

      {/* Card Counters Container */}
      {showCounters && counters.length > 0 && (
        <div className="card-counters-wrap">
          {counters.map((c, ci) => {
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

            return (
              <div
                key={ci}
                className={`counter-badge ${customClass}`}
                title={`${c.name}: ${c.count}`}
              >
                {iconElement && <span className="counter-icon-symbol">{iconElement}</span>}
                {label && <span className="counter-text-val">{label}</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* Accumulated Combat Damage (Creatures & Planeswalkers only) */}
      {showDamage && isRealCreature && (perm.damage ?? 0) > 0 && (
        <div className="damage-badge">{perm.damage}</div>
      )}

      {/* Summoning Sickness indicator (Creatures only) */}
      {hasSummoningSickness && (
        <div className="sickness-badge" title="Mareo de invocación (No puede atacar ni girarse este turno)">
          <Icon name="timer" size={11} />
        </div>
      )}

      {/* Face-down Special Type Badges (Morph / Manifest / Disguise / Cloak) */}
      {faceDown && (
        <div className="facedown-badges">
          {perm.morphed && <span className="facedown-type-badge morph" title="Metamorfosis">Morph</span>}
          {perm.manifested && <span className="facedown-type-badge manifest" title="Manifestado">Manifest</span>}
          {perm.disguised && <span className="facedown-type-badge disguise" title="Disfraz">Disguise</span>}
          {perm.cloaked && <span className="facedown-type-badge cloak" title="Encubierto">Cloak</span>}
        </div>
      )}

      {/* Transform / Double-Faced Indicator Badge */}
      {(card.transformable || card.secondCardFace != null || card.alternateName != null) && !faceDown && (
        <div
          className={`card-transform-badge ${perm.transformed ? 'is-transformed' : ''}`}
          title={perm.transformed ? 'Carta transformada (Reverso)' : 'Carta de doble cara (Anverso)'}
        >
          {perm.transformed ? <Icon name="moon" size={11} /> : <Icon name="sun" size={11} />}
        </div>
      )}

      {/* Card restriction / ability icons (e.g. Goad, must/can't attack, keywords) */}
      <CardIcons icons={card.cardIcons} />

      {/* Keyword badges (Flying/Deathtouch/Trample/Haste etc.) — compact, top-right under mutate badge */}
      {keywordBadges.length > 0 && (
        <div className="keyword-badges" aria-label="keywords">
          {keywordBadges.map((kw) => (
            <span key={kw.id} className={`keyword-badge cat-${kw.category}`} title={`${kw.name} — ${kw.summary}`}>
              {kw.icon}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
