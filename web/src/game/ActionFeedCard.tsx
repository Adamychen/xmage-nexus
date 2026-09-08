import React, { useEffect, useState } from 'react'
import type { ActionFeedItem } from './gameEventParser'
import { awaitImageUrl } from '../cards/cardImages'
import Icon, { type IconName } from '../ui/Icon'
import { useTranslation } from '../i18n'
import FormattedText from './FormattedText'
import './ActionFeedCard.css'

interface ActionFeedCardProps {
  item: ActionFeedItem
  onHover?: (card: any, rect?: DOMRect) => void
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

export default function ActionFeedCard({ item, onHover }: ActionFeedCardProps) {
  const { t } = useTranslation()
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const icon: IconName = TYPE_ICONS[item.type] ?? 'info'

  useEffect(() => {
    if (!item.cardName) return
    let cancelled = false
    void awaitImageUrl({ name: item.cardName } as any).then((url) => {
      if (!cancelled && url) setImgUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [item.cardName])

  if (item.type === 'turn') {
    return (
      <div className="action-feed-turn-divider">
        <span className="turn-line" />
        <span className="turn-badge">
          <Icon name={icon} size={12} /> {t('game','turn')} {item.amount} {item.playerName ? `· ${item.playerName}` : ''}
        </span>
        <span className="turn-line" />
      </div>
    )
  }

  const isDamage = item.type === 'damage'
  const isLife = item.type === 'life'
  const hasArt = !!item.cardName

  const cardForHover = item.cardName
    ? {
        name: item.cardName,
        manaValue: 0,
        expansionSetCode: '',
        cardNumber: '0',
      }
    : null

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (cardForHover && onHover) {
      onHover(cardForHover, e.currentTarget.getBoundingClientRect())
    }
  }

  const handleMouseLeave = () => {
    if (onHover) onHover(null)
  }

  return (
    <div
      className={`action-feed-card type-${item.type} ${item.isMe ? 'is-me' : 'is-opp'}${hasArt ? '' : ' no-art'}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {imgUrl ? (
        <div
          className="action-card-bg"
          style={{ backgroundImage: `url(${imgUrl})` }}
        />
      ) : (
        <div className={`action-card-bg action-card-bg--tint tint-${item.type}`} />
      )}

      <div className="action-card-content">
        <div className="action-card-header">
          <span className="action-icon"><Icon name={icon} size={14} /></span>
          {item.playerName && (
            <span className={`action-player-tag ${item.isMe ? 'me' : 'opp'}`}>
              {item.isMe ? t('game','you') : item.playerName}
            </span>
          )}
          {/* Life / Damage badge */}
          {isDamage && item.amount !== undefined && (
            <span className="action-damage-badge">-{item.amount} <Icon name="heart" size={11} /></span>
          )}
          {isLife && item.amount !== undefined && (
            <span className={`action-life-badge ${item.amount < 0 ? 'loss' : 'gain'}`}>
              {item.amount > 0 ? `+${item.amount} ` : `${item.amount} `}<Icon name="heart" size={11} />
            </span>
          )}
        </div>

        <div className="action-card-body">
          {item.cardName && <span className="action-card-name">{item.cardName}</span>}
          {item.targetName && (
            <span className="action-target-pill">
              ➔ {item.targetName}
            </span>
          )}
          <span className="action-desc-text">
            <FormattedText text={item.description} onHover={onHover} />
          </span>
        </div>
      </div>
    </div>
  )
}
