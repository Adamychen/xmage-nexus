import { useEffect, type CSSProperties } from 'react'
import type { DeckV2 } from './types'
import { deckMainCount, deckInitials } from './types'
import { validateDeckForFormat, FORMAT_CONFIGS } from './formatRules'
import { commanderCardsFor } from './deckUtils'
import { useDeckMetadata } from './useDeckMetadata'
import { useCardArtUrl } from './useCardArtUrl'
import { ManaPip } from './ArenaManaSymbols'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import './DeckBox.css'

function identityStyle(colors: DeckV2['colors']): CSSProperties {
  const [first, second] = colors
  const style: Record<string, string> = {}
  if (first) style['--identity-a'] = `var(--mana-${first.toLowerCase()})`
  if (second) style['--identity-b'] = `var(--mana-${second.toLowerCase()})`
  return style as CSSProperties
}

function useDeckCoverUrl(deck: DeckV2): string | null {
  return useCardArtUrl(deck.coverCard ?? deck.cards[0])
}

export function DeckBox({
  deck,
  selected,
  onSelect,
  onDoubleClick,
}: {
  deck: DeckV2
  selected?: boolean
  onSelect?: () => void
  onDoubleClick?: () => void
}) {
  const { t } = useTranslation()
  const coverUrl = useDeckCoverUrl(deck)
  const total = deckMainCount(deck)
  const colors = deck.colors
  const { metaMap, updateMetaForDeck } = useDeckMetadata()
  useEffect(() => {
    if (!FORMAT_CONFIGS[deck.format]?.hasCommander) return
    const commanders = commanderCardsFor(deck.cards, deck.commanderCard ?? null, deck.partnerCard ?? null, new Map())
    if (commanders.length > 0) updateMetaForDeck(commanders)
  }, [deck.format, deck.cards, deck.commanderCard, deck.partnerCard])
  const formatReport = validateDeckForFormat(deck, metaMap)
  const hasErrors = formatReport.issues.some((i) => i.severity === 'error')
  const minRequired = FORMAT_CONFIGS[deck.format]?.minMain ?? 60
  const isValid = !hasErrors && total >= minRequired
  const issueTooltip = formatReport.issues.map((i) => `• ${i.message}`).join('\n')

  return (
    <div
      className={`deck-box ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect?.()}
    >
      <div className="deck-box-art">
        {coverUrl ? <img src={coverUrl} alt={deck.name} loading="lazy" /> : <div className="deck-box-art-fallback" style={identityStyle(colors)}>{deckInitials(deck.name)}</div>}
        <div className="deck-box-art-scrim" />
        <div className="deck-box-format-badge" title={issueTooltip || `${deck.format} ${t('decks', 'format_legal')}`}>
          {isValid ? (
            <span className="format-badge-valid">✓ {deck.format}</span>
          ) : (
            <span className="format-badge-invalid">
              <Icon name="alert" size={11} /> {total < minRequired ? `${total}/${minRequired}` : deck.format}
            </span>
          )}
        </div>
      </div>
      <div className="deck-box-footer">
        <span className="deck-box-name" title={deck.name}>{deck.name}</span>
        {colors.length > 0 && (
          <span className="deck-box-colors">
            {colors.map((c) => (
              <ManaPip key={c} symbol={c} size={16} />
            ))}
          </span>
        )}
        {colors.length === 0 && (
          <span className="deck-box-colors">
            <ManaPip symbol="C" size={16} />
          </span>
        )}
      </div>
      <div className="deck-box-meta">
        <span className="deck-box-count">{total} {t('decks', 'total_cards')}</span>
        {deck.favorite && <span className="deck-box-fav">★</span>}
        {deck.source === 'precon' && <span className="deck-box-precon">Precon</span>}
      </div>
      {selected && <div className="deck-box-ring" />}
    </div>
  )
}

export function DeckBoxCreate({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="deck-box deck-box-create" onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      <div className="deck-box-create-inner">
        <span className="deck-box-create-plus">+</span>
        <span className="deck-box-create-label">{t('decks', 'box_create')}</span>
      </div>
    </div>
  )
}
