import { useEffect, type CSSProperties } from 'react'
import type { DeckV2 } from './types'
import { deckMainCount, deckInitials } from './types'
import { validateDeckForFormat, FORMAT_CONFIGS } from './formatRules'
import { commanderCardsFor } from './deckUtils'
import { useDeckMetadata } from './useDeckMetadata'
import { useCardArtUrl } from './useCardArtUrl'
import { ManaPip } from './ArenaManaSymbols'
import Icon from '../ui/Icon'
import IconButton from '../ui/IconButton'
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
  onEdit,
  onInspect,
  onClone,
  onToggleFavorite,
}: {
  deck: DeckV2
  selected?: boolean
  onSelect?: () => void
  onDoubleClick?: () => void
  onEdit?: () => void
  onInspect?: () => void
  onClone?: () => void
  onToggleFavorite?: () => void
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
      tabIndex={0}
      aria-label={deck.name}
      aria-selected={!!selected}
      onKeyDown={(e) => e.key === 'Enter' && onSelect?.()}
    >
      <div className="deck-box-art">
        {coverUrl ? <img src={coverUrl} alt={deck.name} loading="lazy" /> : <div className="deck-box-art-fallback" style={identityStyle(colors)}>{deckInitials(deck.name)}</div>}
        <div className="deck-box-art-scrim" />
        {(onEdit || onInspect || onClone || onToggleFavorite) && (
          <div className="deck-box-actions" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
            {onEdit && (
              <IconButton label={t('common', 'edit')} data-testid="deckbox-quick-edit" className="deck-box-action" onClick={(e) => { e.stopPropagation(); onEdit() }}>
                <Icon name="pencil" size={14} />
              </IconButton>
            )}
            {onInspect && (
              <IconButton label={t('decks', 'inspect_double_click')} data-testid="deckbox-quick-inspect" className="deck-box-action" onClick={(e) => { e.stopPropagation(); onInspect() }}>
                <Icon name="eye" size={14} />
              </IconButton>
            )}
            {onClone && (
              <IconButton label={t('common', 'copy')} data-testid="deckbox-quick-clone" className="deck-box-action" onClick={(e) => { e.stopPropagation(); onClone() }}>
                <Icon name="copy" size={14} />
              </IconButton>
            )}
            {onToggleFavorite && (
              <IconButton label={t('decks', 'favorite')} data-testid="deckbox-quick-fav" className={`deck-box-action ${deck.favorite ? 'fav-active' : ''}`} aria-pressed={!!deck.favorite} onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}>
                <Icon name="star" size={14} />
              </IconButton>
            )}
          </div>
        )}
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
      {coverUrl && (
        <div className="deckbox-preview" data-testid="deckbox-preview" aria-hidden="true">
          <img src={coverUrl} alt="" loading="lazy" />
        </div>
      )}
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
