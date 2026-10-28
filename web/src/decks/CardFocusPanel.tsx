import { useState } from 'react'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'
import type { DeckPile } from './stackPiles'
import { isMetaLoaded } from './metaLoaded'
import { ManaCost } from './ArenaManaSymbols'
import { cmcFromManaCost } from './deckUtils'
import { useLocalizedCardName } from '../cards/cardLocalization'
import { useCustomCardArt } from '../cards/customCardArt'
import { useTranslation } from '../i18n'
import { useStackLabels } from './useStackLabels'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { confirmDialog } from '../ui/confirmDialog'
import './CardFocusPanel.css'

export interface CardFocusPanelProps {
  card: DeckCard | null
  meta?: CardStripMeta
  zone: 'main' | 'side'
  inMain: number
  inSide: number
  issue?: string
  isCommanderFormat: boolean
  isCommander: boolean
  isPartner: boolean
  canBeCommander: boolean
  isCover: boolean
  piles?: DeckPile[]
  currentPileIds?: readonly string[]
  onDec: (card: DeckCard) => void
  onInc: (card: DeckCard) => void
  onRemoveAll: (card: DeckCard) => void
  onSwapZone: (card: DeckCard) => void
  onChangePrinting: (card: DeckCard) => void
  onSetCover: (card: DeckCard) => void
  onSetCommander: (card: DeckCard) => void
  onSetPartner: (card: DeckCard) => void
  onMoveToPile: (pileId: string) => void
  onNewPile: () => void
}

type CardFocusBodyProps = Omit<CardFocusPanelProps, 'card'> & { card: DeckCard }

function rarityOf(rarity: string): 'mythic' | 'rare' | 'uncommon' | 'common' | 'other' {
  const r = rarity.toLowerCase()
  return r === 'mythic' || r === 'rare' || r === 'uncommon' || r === 'common' ? r : 'other'
}

function CardFocusBody({
  card,
  meta,
  zone,
  inMain,
  inSide,
  issue,
  isCommanderFormat,
  isCommander,
  isPartner,
  canBeCommander,
  isCover,
  piles,
  currentPileIds,
  onDec,
  onInc,
  onRemoveAll,
  onSwapZone,
  onChangePrinting,
  onSetCover,
  onSetCommander,
  onSetPartner,
  onMoveToPile,
  onNewPile,
}: CardFocusBodyProps) {
  const { t } = useTranslation()
  const labels = useStackLabels()
  const { displayName, originalName } = useLocalizedCardName(card)
  const name = displayName || originalName
  const cardKey = `${card.setCode}:${card.cardNumber}:${card.cardName}`
  const customArt = useCustomCardArt(card.cardName)
  const front = customArt ?? meta?.imageUrl ?? null
  const back = meta?.backImageUrl ?? null
  const [backKey, setBackKey] = useState<string | null>(null)
  const showBack = back !== null && backKey === cardKey
  const shown = showBack ? back : front

  const loaded = isMetaLoaded(meta)
  const cmc = loaded ? (meta.cmc ?? cmcFromManaCost(meta.manaCost)) : null
  const rarity = loaded && meta.rarity ? labels.rarity[rarityOf(meta.rarity)] : null

  const removeAll = async () => {
    if (card.amount > 1) {
      const ok = await confirmDialog(t('decks', 'strip_remove_all_confirm', { count: card.amount, name }))
      if (!ok) return
    }
    onRemoveAll(card)
  }

  const commanderTitle = isCommander
    ? t('decks', 'commander_unset')
    : canBeCommander
      ? t('decks', 'commander_set')
      : t('decks', 'commander_not_eligible')

  return (
    <section className="card-focus-panel" aria-label={t('decks', 'card')}>
      <div className="card-focus-stage">
        {shown ? (
          <img className="card-focus-image" src={shown} alt={name} />
        ) : (
          <div className="card-focus-placeholder">{loaded ? name : t('decks', 'pile_loading')}</div>
        )}
      </div>
      {back && (
        <Button size="sm" variant="ghost" icon="rotateCw" className="card-focus-flip"
          onClick={() => setBackKey(showBack ? null : cardKey)}>
          {showBack ? t('wiki', 'face_front') : t('wiki', 'face_back')}
        </Button>
      )}

      <h3 className="card-focus-name" title={originalName !== name ? `${name} (${originalName})` : name}>{name}</h3>
      {meta?.typeLine && <p className="card-focus-type">{meta.typeLine}</p>}
      {loaded && (
        <div className="card-focus-meta">
          <ManaCost manaCost={meta.manaCost} size={14} />
          {rarity && <span>{rarity}</span>}
          {cmc !== null && <span>{t('decks', 'pile_cmc', { n: cmc })}</span>}
        </div>
      )}
      <p className="card-focus-counts">{t('decks', 'focus_counts', { main: inMain, side: inSide })}</p>
      {issue && (
        <p className="card-focus-issue">
          <Icon name="alert" size={13} />
          <span>{issue}</span>
        </p>
      )}

      <div className="card-focus-actions">
        <Button size="sm" variant="secondary" className="card-focus-btn card-focus-dec"
          aria-label={t('decks', 'strip_remove_one')} title={t('decks', 'strip_remove_one')}
          onClick={() => onDec(card)}>
          −
        </Button>
        <Button size="sm" variant="secondary" className="card-focus-btn card-focus-inc"
          aria-label={t('decks', 'strip_add_one')} title={t('decks', 'strip_add_one')}
          onClick={() => onInc(card)}>
          +
        </Button>
        <Button size="sm" variant="secondary" icon="swap" className="card-focus-btn card-focus-swap"
          onClick={() => onSwapZone(card)}>
          {zone === 'main' ? t('decks', 'focus_to_side') : t('decks', 'focus_to_main')}
        </Button>
      </div>
      <div className="card-focus-actions">
        <Button size="sm" variant="secondary" icon="palette" className="card-focus-btn"
          onClick={() => onChangePrinting(card)}>
          {t('decks', 'focus_printing')}
        </Button>
        <Button size="sm" variant="secondary" icon="star" className={`card-focus-btn ${isCover ? 'is-on' : ''}`}
          aria-pressed={isCover} title={isCover ? t('decks', 'strip_cover_current') : t('decks', 'strip_cover_use')}
          onClick={() => onSetCover(card)}>
          {t('decks', 'focus_cover')}
        </Button>
        <Button size="sm" variant="soft-danger" icon="trash" className="card-focus-btn"
          onClick={() => void removeAll()}>
          {t('decks', 'focus_remove_all')}
        </Button>
      </div>

      {isCommanderFormat && (
        <div className="card-focus-actions">
          <Button size="sm" variant="secondary" icon="crown" className={`card-focus-btn ${isCommander ? 'is-on' : ''}`}
            aria-pressed={isCommander} disabled={!canBeCommander && !isCommander} title={commanderTitle}
            onClick={() => onSetCommander(card)}>
            {t('decks', 'pile_commander')}
          </Button>
          <Button size="sm" variant="secondary" icon="users" className={`card-focus-btn ${isPartner ? 'is-on' : ''}`}
            aria-pressed={isPartner} disabled={!canBeCommander && !isPartner}
            title={isPartner ? t('decks', 'focus_partner') : t('decks', 'commander_set_partner')}
            onClick={() => onSetPartner(card)}>
            {t('decks', 'focus_partner')}
          </Button>
        </div>
      )}

      {piles && (
        <div className="card-focus-piles" role="group" aria-label={t('decks', 'focus_move_to_pile')}>
          <span className="card-focus-caption">{t('decks', 'focus_move_to_pile')}</span>
          <div className="card-focus-actions">
            {piles.map((pile) => {
              const current = currentPileIds?.includes(pile.id) ?? false
              return (
                <Button key={pile.id} size="sm" variant="secondary"
                  className={`card-focus-btn card-focus-pile ${current ? 'is-on' : ''}`}
                  aria-pressed={current} onClick={() => onMoveToPile(pile.id)}>
                  {pile.label}
                </Button>
              )
            })}
            <Button size="sm" variant="ghost" className="card-focus-btn" onClick={onNewPile}>
              {t('decks', 'focus_new_pile')}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

export function CardFocusPanel(props: CardFocusPanelProps) {
  if (!props.card) return null
  return <CardFocusBody {...props} card={props.card} />
}
