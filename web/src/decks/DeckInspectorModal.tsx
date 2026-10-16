import CloseButton from '../ui/CloseButton'
import Button from '../ui/Button'
import Chip from '../ui/Chip'
import ChipButton from '../ui/ChipButton'
import { useState, useEffect, useCallback, useMemo } from 'react'
import type { DeckCard } from '../lobby/decks'
import type { MetaDeckItem } from './metaDeckCatalog'
import type { DeckV2 } from './types'
import { ArenaCardStrip, type CardStripMeta } from './ArenaCardStrip'
import { ArenaCardStacks } from './ArenaCardStacks'
import { buildTypeColumns } from './stackColumns'
import { useTypeLabels } from './useTypeLabels'
import { aggregateCards } from './deckCardOps'
import CurveChart from './CurveChart'
import Icon from '../ui/Icon'
import DialogShell from '../ui/DialogShell'
import { useTranslation } from '../i18n'
import { getEffectiveCardLang, setCachedCardName } from '../cards/cardLocalization'
import { fetchCardJson } from '../cards/scryfallCards'
import './DeckInspectorModal.css'

export function DeckInspectorModal({
  deck,
  onClose,
  onCopy,
  onEdit,
  onSelectCover,
}: {
  deck: MetaDeckItem | DeckV2
  onClose: () => void
  onCopy: (d: MetaDeckItem | DeckV2) => unknown | Promise<unknown>
  onEdit: (d: MetaDeckItem | DeckV2) => void
  onSelectCover?: (card: DeckV2['cards'][number]) => void
}) {
  const [copied, setCopied] = useState(false)
  const [metaMap, setMetaMap] = useState<Map<string, CardStripMeta>>(new Map())
  const [view, setView] = useState<'list' | 'stacks'>('list')
  const metaDesc = 'description' in deck ? (deck as MetaDeckItem).description : undefined
  const archetype = 'archetype' in deck ? (deck as MetaDeckItem).archetype : undefined
  const tier = 'tier' in deck ? (deck as MetaDeckItem).tier : undefined

  const { t } = useTranslation()
  const mainTotal = deck.cards.reduce((s, c) => s + c.amount, 0)
  const sideTotal = deck.sideboard.reduce((s, c) => s + c.amount, 0)
  const displayCards = aggregateCards(deck.cards)
  const displaySideboard = aggregateCards(deck.sideboard)
  const metaOf = useCallback(
    (c: DeckCard) => metaMap.get(`${c.setCode}/${c.cardNumber}`) ?? metaMap.get(c.cardName.toLowerCase()),
    [metaMap],
  )
  const typeLabels = useTypeLabels()
  const mainStacks = useMemo(() => buildTypeColumns(deck.cards, metaOf, typeLabels), [deck.cards, metaOf, typeLabels])
  const sideStacks = useMemo(() => buildTypeColumns(deck.sideboard, metaOf, typeLabels), [deck.sideboard, metaOf, typeLabels])

  useEffect(() => {
    const all = [...displayCards, ...displaySideboard]
    const cardLang = getEffectiveCardLang()
    for (const c of all) {
      const hasSetAndNum = c.setCode && c.cardNumber && c.cardNumber !== '0'

      fetchCardJson(c, { lang: cardLang })
        .then((data) => {
          if (!data) return
          const printedName = data.printed_name || data.card_faces?.[0]?.printed_name
          if (printedName && cardLang && cardLang !== 'en') {
            setCachedCardName(data.name ?? c.cardName, printedName, cardLang)
          }
          const meta: CardStripMeta = {
            artCropUrl: data.image_uris?.art_crop ?? data.card_faces?.[0]?.image_uris?.art_crop ?? null,
            imageUrl: data.image_uris?.normal ?? data.card_faces?.[0]?.image_uris?.normal ?? null,
            backImageUrl: data.card_faces?.[1]?.image_uris?.normal ?? null,
            manaCost: data.mana_cost ?? data.card_faces?.[0]?.mana_cost ?? '',
            cmc: data.cmc ?? 0,
            typeLine: data.type_line ?? data.printed_type_line ?? data.card_faces?.[0]?.type_line ?? '',
            colors: data.colors ?? data.color_identity ?? [],
            legalities: data.legalities,
          }
          setMetaMap((prev) => {
            const nxt = new Map(prev)
            if (hasSetAndNum) nxt.set(`${c.setCode}/${c.cardNumber}`, meta)
            nxt.set(c.cardName.toLowerCase(), meta)
            return nxt
          })
        })
        .catch(() => {})
    }
  }, [deck.id])

  const handleCopy = async () => {
    const result = await onCopy(deck)
    setCopied(result !== false)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <DialogShell
      labelledBy="deck-inspector-name"
      titleId="deck-inspector-name"
      size="lg"
      legacyBackdropClass="deck-inspector-backdrop"
      legacyPanelClass="deck-inspector-modal"
      kickerIcon="layers"
      kickerLabel={deck.format}
      title={deck.name}
      topRight={(
        <CloseButton variant="solid" size="lg" className="inspector-close-btn" onClick={onClose} />
      )}
      onBackdropClick={onClose}
      onEscape={onClose}
    >
        <div className="deck-inspector-badges">
          <Chip tone="gold" size="md" pill>{deck.format}</Chip>
          {archetype && <Chip tone="brand" size="md" pill>{archetype}</Chip>}
          {tier && <Chip tone="ok" size="md" pill>{tier}</Chip>}
          <div className="inspector-view-toggle">
            <ChipButton size="sm" active={view === 'list'} onClick={() => setView('list')}>{t('decks', 'inspector_view_list')}</ChipButton>
            <ChipButton size="sm" active={view === 'stacks'} onClick={() => setView('stacks')}>{t('decks', 'inspector_view_stacks')}</ChipButton>
          </div>
        </div>

        <div className="deck-inspector-body">
          {view === 'stacks' ? (
            <div className="inspector-cards-column inspector-stacks">
              <div className="inspector-section-title">
                {t('game', 'sideboard_main')} ({mainTotal} {t('decks', 'total_cards')})
              </div>
              <ArenaCardStacks columns={mainStacks} />
              {deck.sideboard.length > 0 && (
                <>
                  <div className="inspector-section-title inspector-section-title--sideboard">
                    {t('decks', 'sideboard')} (Sideboard: {sideTotal} {t('decks', 'total_cards')})
                  </div>
                  <ArenaCardStacks columns={sideStacks} />
                </>
              )}
            </div>
          ) : (
          <div className="inspector-cards-column">
            <div className="inspector-section-title">
              {t('game', 'sideboard_main')} ({mainTotal} {t('decks', 'total_cards')})
            </div>
            {displayCards.map((c) => {
              const meta = metaMap.get(`${c.setCode}/${c.cardNumber}`) ?? metaMap.get(c.cardName.toLowerCase())
              return (
                <ArenaCardStrip
                  key={`${c.setCode}:${c.cardNumber}:${c.cardName}`}
                  card={c}
                  meta={meta}
                />
              )
            })}

            {deck.sideboard.length > 0 && (
              <>
                <div className="inspector-section-title inspector-section-title--sideboard">
                  {t('decks', 'sideboard')} (Sideboard: {sideTotal} {t('decks', 'total_cards')})
                </div>
                {displaySideboard.map((c) => {
                  const meta = metaMap.get(`${c.setCode}/${c.cardNumber}`) ?? metaMap.get(c.cardName.toLowerCase())
                  return (
                    <ArenaCardStrip
                      key={`sb:${c.setCode}:${c.cardNumber}:${c.cardName}`}
                      card={c}
                      meta={meta}
                      sideboard
                    />
                  )
                })}
              </>
            )}
          </div>
          )}

          <div className="inspector-info-column">
            {onSelectCover && (
              <div>
                <span className="inspector-info-label">
                  Cover
                </span>
                <div className="inspector-cover-grid">
                  {[...new Map(deck.cards.slice(0, 12).map((c) => [`${c.setCode}/${c.cardNumber}:${c.cardName}`, c])).values()].slice(0, 8).map((c, i) => {
                    const key = `${c.setCode}/${c.cardNumber}:${c.cardName}`
                    const cur = deck.coverCard ?? deck.cards[0]
                    const curKey = cur ? `${cur.setCode}/${cur.cardNumber}:${cur.cardName}` : ''
                    return (
                      <ChipButton
                        key={key}
                        data-testid={`inspector-cover-${i}`}
                        className="inspector-cover-btn"
                        active={key === curKey}
                        title={c.cardName}
                        onClick={() => onSelectCover(c)}
                      >
                        {c.cardName}
                      </ChipButton>
                    )
                  })}
                </div>
              </div>
            )}
            {metaDesc && (
              <div>
                <span className="inspector-info-label">
                  {t('common', 'status')}
                </span>
                <p className="inspector-desc">{metaDesc}</p>
              </div>
            )}

            <div>
              <span className="inspector-info-label">
                {t('decks', 'mana_curve')}
              </span>
              <CurveChart cards={deck.cards} meta={metaMap} />
            </div>
          </div>
        </div>

        <footer className="deck-inspector-footer">
          <Button onClick={() => onEdit(deck)}>
            <Icon name="pencil" size={13} /> {t('decks', 'deck_builder')}
          </Button>

          <Button variant="primary" data-testid="inspector-copy-btn" onClick={handleCopy}>
            {copied ? (<><Icon name="check" size={12} /> {t('common', 'copied')}</>) : (<><Icon name="copy" size={12} /> {t('common', 'copy')}</>)}
          </Button>
        </footer>
    </DialogShell>
  )
}
