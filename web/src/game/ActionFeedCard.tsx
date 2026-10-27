import { useMemo, useRef } from 'react'
import type { CardView, PermanentView, PlayerView } from '../net/types'
import type { ActionFeedItem } from './gameEventParser'
import { useStore } from '../state/store'
import { seatColorVar, seatIndexOf } from '../board/seatColor'
import Icon, { type IconName } from '../ui/Icon'
import { toBcp47Locale, useTranslation, type SupportedLanguage } from '../i18n'
import FormattedText, { type FormattedName } from './FormattedText'
import { formatFeedTime } from './feedTime'
import './ActionFeedCard.css'

interface ActionFeedCardProps {
  item: ActionFeedItem
  onHover?: (card: CardView | PermanentView | null, rect?: DOMRect) => void
}

const TYPE_ICONS: Record<string, IconName> = {
  turn: 'clock',
  phase: 'refresh',
  cast: 'zap',
  land: 'tree',
  attack: 'swords',
  block: 'shield',
  damage: 'flame',
  life: 'heart',
  draw: 'plus',
  discard: 'trash',
  ability: 'sparkles',
  chat: 'chat',
  system: 'trophy',
}

function formatFeedClock(time: number, lang: SupportedLanguage): string {
  try {
    return new Date(time).toLocaleTimeString(toBcp47Locale(lang), { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function seatColorOf(players: PlayerView[] | undefined, name: string | undefined): string | undefined {
  const player = players?.find((p) => p.name === name)
  return player ? seatColorVar(seatIndexOf(players, player.playerId)) : undefined
}

function namesIn(item: ActionFeedItem, players: PlayerView[] | undefined): FormattedName[] {
  const named: FormattedName[] = (players ?? []).map((p) => ({
    text: p.name,
    kind: 'player',
    color: seatColorVar(seatIndexOf(players, p.playerId)),
  }))
  if (item.playerName && !named.some((n) => n.text === item.playerName)) {
    named.push({ text: item.playerName, kind: 'player' })
  }
  const isPlayer = (text: string) => named.some((n) => n.text === text)
  const cards = [item.cardName, item.targetName].filter((text): text is string => !!text && !isPlayer(text))
  return [...named, ...cards.map((text): FormattedName => ({ text, kind: 'card' }))]
}

export default function ActionFeedCard({ item, onHover }: ActionFeedCardProps) {
  const { t, lang } = useTranslation()
  const players = useStore((s) => s.game?.players)
  const rowRef = useRef<HTMLDivElement | null>(null)
  const time = formatFeedTime(item.timestamp, lang)
  const clock = formatFeedClock(item.timestamp, lang)
  const icon: IconName = TYPE_ICONS[item.type] ?? 'info'
  const names = useMemo(() => namesIn(item, players), [item, players])

  if (item.type === 'turn') {
    const turnColor = seatColorOf(players, item.playerName)
    return (
      <div className="action-feed-turn-divider" data-type="turn">
        <span className="turn-line" />
        <span className="turn-badge">
          <Icon name={icon} size={12} /> {t('game', 'turn')} {item.amount}
          {item.playerName && (
            <>
              {' · '}
              <span className="turn-player" style={turnColor ? { color: turnColor } : undefined}>{item.playerName}</span>
            </>
          )}
        </span>
        <span className="turn-line" />
        <span className="action-time" title={time}>{clock}</span>
      </div>
    )
  }

  const cardForHover = item.cardName
    ? {
        name: item.cardName,
        manaValue: 0,
        expansionSetCode: '',
        cardNumber: '0',
      }
    : null

  const chipValue =
    item.amount === undefined || item.amount === 0
      ? null
      : item.type === 'damage'
        ? -Math.abs(item.amount)
        : item.type === 'life'
          ? item.amount
          : null

  const handleMouseEnter = () => {
    if (cardForHover && rowRef.current) {
      onHover?.(cardForHover, rowRef.current.getBoundingClientRect())
    }
  }

  const handleMouseLeave = () => {
    onHover?.(null)
  }

  const handleSentenceHover = (card: CardView | null, rect?: DOMRect) => {
    if (card || !cardForHover || !rowRef.current) {
      onHover?.(card, rect)
      return
    }
    onHover?.(cardForHover, rowRef.current.getBoundingClientRect())
  }

  return (
    <div
      ref={rowRef}
      className={`action-feed-row type-${item.type}`}
      data-type={item.type}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className="action-feed-icon" aria-hidden="true">
        <Icon name={icon} size={14} />
      </span>
      <span className="action-feed-sentence">
        <FormattedText text={item.description} names={names} onHover={handleSentenceHover} />
      </span>
      {chipValue !== null && (
        <span className={`action-feed-chip ${chipValue < 0 ? 'loss' : 'gain'}`}>
          {chipValue > 0 ? `+${chipValue}` : `−${Math.abs(chipValue)}`}
        </span>
      )}
      <span className="action-time" title={time}>{clock}</span>
    </div>
  )
}
