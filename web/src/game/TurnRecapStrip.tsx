import { useEffect, useState } from 'react'
import type { CardView } from '../net/types'
import { dismissTurnRecap, useStore } from '../state/store'
import { useTranslation } from '../i18n'
import type { GameFeedKey } from './gameEventParser'
import type { RecapDeparture, RecapDestination, TurnRecap } from './turnRecap'
import { cardName } from '../cards/cardImages'
import { useCardImageUrl } from '../cards/useCardImageUrl'
import FloatingCardPreview from '../board/FloatingCardPreview'
import CloseButton from '../ui/CloseButton'
import Icon, { type IconName } from '../ui/Icon'
import './TurnRecapStrip.css'

export const RECAP_VISIBLE_MS = 10000
const MAX_NAMES = 4

type RecapT = (category: 'game', key: GameFeedKey, params?: Record<string, string | number>) => string

const DEST_ICON: Record<RecapDestination, IconName> = {
  graveyard: 'skull',
  exile: 'portal',
  hand: 'hand',
  gone: 'wind',
}

const DEST_KEY: Record<RecapDestination, GameFeedKey> = {
  graveyard: 'recap_dest_graveyard',
  exile: 'recap_dest_exile',
  hand: 'recap_dest_hand',
  gone: 'recap_dest_gone',
}

function nameList(names: string[]): string {
  if (names.length <= MAX_NAMES) return names.join(', ')
  return `${names.slice(0, MAX_NAMES).join(', ')} +${names.length - MAX_NAMES}`
}

export function recapTitle(recap: TurnRecap, t: RecapT): string {
  if (recap.turnsOf.length === 1) return t('game', 'recap_turn_of', { player: recap.turnsOf[0] })
  return t('game', 'recap_since_last')
}

export function recapSummary(recap: TurnRecap, t: RecapT): string {
  const parts: string[] = []
  const prefixNames = recap.actors.length > 1
  for (const actor of recap.actors) {
    const clauses: string[] = []
    if (actor.played.length > 0) clauses.push(t('game', 'recap_played', { cards: nameList(actor.played) }))
    if (actor.attackedWith.length > 0) clauses.push(t('game', 'recap_attacked', { cards: nameList(actor.attackedWith) }))
    const text = clauses.join(', ')
    parts.push(prefixNames ? `${actor.name}: ${text}` : text)
  }
  for (const change of recap.life) {
    const n = Math.abs(change.delta)
    if (change.mine) parts.push(t('game', change.delta < 0 ? 'recap_you_lost' : 'recap_you_gained', { n }))
    else parts.push(t('game', change.delta < 0 ? 'recap_player_lost' : 'recap_player_gained', { player: change.name, n }))
  }
  return parts.join(' · ')
}

function DepartureChip({ departure, onHover }: { departure: RecapDeparture; onHover: (card: CardView | null, rect?: DOMRect) => void }) {
  const { t } = useTranslation()
  const url = useCardImageUrl(departure.card)
  const label = `${cardName(departure.card)} — ${t('game', DEST_KEY[departure.dest])}`
  return (
    <li
      className="turn-recap-departure"
      data-dest={departure.dest}
      data-mine={departure.mine ? '1' : '0'}
      data-testid="turn-recap-departure"
      title={label}
      aria-label={label}
      onMouseEnter={(e) => onHover(departure.card, e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => onHover(null)}
    >
      {url ? <img src={url} alt="" draggable={false} /> : <span className="turn-recap-departure-name">{cardName(departure.card)}</span>}
      <span className="turn-recap-departure-icon" aria-hidden="true">
        <Icon name={DEST_ICON[departure.dest]} size={11} />
      </span>
    </li>
  )
}

export default function TurnRecapStrip() {
  const { t } = useTranslation()
  const recap = useStore((s) => s.turnRecap)
  const [hoverCard, setHoverCard] = useState<CardView | null>(null)
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null)
  const [paused, setPaused] = useState(false)
  const key = recap?.key

  useEffect(() => {
    if (!key || paused) return
    const timer = setTimeout(() => dismissTurnRecap(key), RECAP_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [key, paused])

  useEffect(() => {
    setHoverCard(null)
    setHoverRect(null)
    setPaused(false)
  }, [key])

  if (!recap) return null
  const summary = recapSummary(recap, t)
  const onHover = (card: CardView | null, rect?: DOMRect) => {
    setHoverCard(card)
    setHoverRect(rect ?? null)
  }

  return (
    <div
      className="turn-recap"
      role="status"
      data-testid="turn-recap"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className="turn-recap-icon" aria-hidden="true">
        <Icon name="history" size={14} />
      </span>
      <div className="turn-recap-body">
        <span className="turn-recap-title">{recapTitle(recap, t)}</span>
        {summary && <span className="turn-recap-summary" data-testid="turn-recap-summary">{summary}</span>}
      </div>
      {recap.departures.length > 0 && (
        <ul className="turn-recap-departures">
          {recap.departures.map((d) => (
            <DepartureChip key={d.id} departure={d} onHover={onHover} />
          ))}
        </ul>
      )}
      <CloseButton variant="plain" size="sm" label={t('game', 'recap_dismiss')} onClick={() => dismissTurnRecap(recap.key)} />
      <FloatingCardPreview card={hoverCard} anchorRect={hoverRect} />
    </div>
  )
}
