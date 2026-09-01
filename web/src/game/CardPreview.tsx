import { useEffect, useState } from 'react'
import { awaitImageUrl, isAbilityCard, getSourceCardName } from '../cards/cardImages'
import type { CardView } from '../net/types'
import { useTranslation } from '../i18n'
import './CardPreview.css'

interface Props {
  card: CardView | null
  onClose?: () => void
}

export default function CardPreview({ card, onClose }: Props) {
  const { t } = useTranslation()
  const [selectedFaceIndex, setSelectedFaceIndex] = useState<number>(0)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  function abilityBadgeLabel(c: CardView): string {
    const at = c.abilityType ?? ''
    if (at === 'Triggered' || at === 'Triggered Mana') return t('game', 'ability_badge_triggered')
    if (at === 'Activated' || at === 'Mana') return t('game', 'ability_badge_activated')
    if (at === 'Loyalty') return t('game', 'ability_badge_loyalty')
    if (at === 'Static') return t('game', 'ability_badge_static')
    return t('game', 'ability_badge_general')
  }

  // Reset face selection when card changes
  useEffect(() => {
    setSelectedFaceIndex(0)
  }, [card?.id, card?.name])

  const isAbility = card ? isAbilityCard(card) : false
  const hasSecondFace = !!card?.secondCardFace

  const activeCard: CardView | null =
    selectedFaceIndex === 1 && card?.secondCardFace
      ? ({
          ...card.secondCardFace,
          isSecondCardFace: true,
          expansionSetCode: card.secondCardFace.expansionSetCode || card.expansionSetCode,
          cardNumber: card.secondCardFace.cardNumber || card.expansionSetCode,
        } as CardView)
      : card

  useEffect(() => {
    if (!activeCard) {
      setImageUrl(null)
      return
    }
    let cancelled = false
    awaitImageUrl(activeCard).then((url) => {
      if (!cancelled) setImageUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [
    activeCard?.name,
    activeCard?.expansionSetCode,
    activeCard?.cardNumber,
    (activeCard as any)?.isSecondCardFace,
    selectedFaceIndex,
  ])

  if (!card || !activeCard) {
    return (
      <div className="card-preview card-preview--empty">
        <span className="card-preview-hint">{t('game', 'card_preview_hint')}</span>
      </div>
    )
  }

  const manaCost = (activeCard.manaCostLeftStr ?? []).join('')

  return (
    <div className="card-preview">
      {/* Banner for abilities */}
      {isAbility && (
        <div className="card-preview-ability-banner">
          <span className="ability-banner-type">{abilityBadgeLabel(card)}</span>
          <span className="ability-banner-source">{t('game', 'card_source_label')} {getSourceCardName(card)}</span>
        </div>
      )}

      {/* Multi-face switch tabs */}
      {hasSecondFace && (
        <div className="card-preview-face-tabs">
          <button
            type="button"
            className={`face-tab-btn ${selectedFaceIndex === 0 ? 'active' : ''}`}
            onClick={() => setSelectedFaceIndex(0)}
          >
            {t('game', 'card_preview_face1', { name: card.name })}
          </button>
          <button
            type="button"
            className={`face-tab-btn ${selectedFaceIndex === 1 ? 'active' : ''}`}
            onClick={() => setSelectedFaceIndex(1)}
          >
            🔄 {card.secondCardFace?.name || t('game', 'card_preview_face2')}
          </button>
        </div>
      )}

      <div className="card-preview-card">
        {imageUrl ? (
          <img src={imageUrl} alt={isAbility ? getSourceCardName(activeCard) : activeCard.name} className="card-preview-img" />
        ) : (
          <div className="card-preview-placeholder">
            <span>{isAbility ? getSourceCardName(activeCard) : activeCard.name}</span>
          </div>
        )}
      </div>

      <div className="card-preview-info">
        <div className="card-preview-header">
          <div className="card-preview-name">{isAbility ? getSourceCardName(activeCard) : activeCard.name}</div>
          {manaCost && <div className="card-preview-mana">{manaCost}</div>}
        </div>

        {activeCard.cardTypes && activeCard.cardTypes.length > 0 && (
          <div className="card-preview-type">{activeCard.cardTypes.join(' — ')}</div>
        )}

        {isAbility && card.rules && card.rules.length > 0 ? (
          <div className="card-preview-ability-box">
            <div className="ability-box-label">{t('game', 'card_ability_text')}</div>
            <div className="ability-box-rules">{card.rules.join('\n')}</div>
          </div>
        ) : activeCard.rules && activeCard.rules.length > 0 ? (
          <div className="card-preview-text">{activeCard.rules.join('\n')}</div>
        ) : null}

        {activeCard.cardTypes?.some((t) => String(t).toLowerCase() === 'creature') && activeCard.power && activeCard.toughness && (
          <div className="card-preview-pt">
            {activeCard.power}/{activeCard.toughness}
          </div>
        )}
      </div>

      {onClose && (
        <button className="card-preview-close" onClick={onClose} title={t('common', 'close')}>
          ×
        </button>
      )}
    </div>
  )
}
