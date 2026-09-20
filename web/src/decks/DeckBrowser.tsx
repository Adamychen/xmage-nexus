import { useState, useMemo, type ReactNode } from 'react'
import Chip from '../ui/Chip'
import type { MetaDeckItem } from './metaDeckCatalog'
import { META_DECK_CATALOG } from './metaDeckCatalog'
import { DeckInspectorModal } from './DeckInspectorModal'
import type { DeckV2 } from './types'
import { ALL_FORMATS } from './formatRules'
import { ManaPip } from './ArenaManaSymbols'
import Icon from '../ui/Icon'
import { clickableProps } from '../ui/clickable'
import { useTranslation } from '../i18n'
import { useCardArtUrl } from './useCardArtUrl'
import type { DeckCard } from '../lobby/decks'
import './DeckBrowser.css'
import Button from '../ui/Button'

function BrowserDeckArt({ cover, children }: { cover: DeckCard; children: ReactNode }) {
  const artUrl = useCardArtUrl(cover)
  return (
    <div className="browser-deck-art-header" style={artUrl ? { backgroundImage: `url(${artUrl})` } : undefined}>
      {children}
    </div>
  )
}

export function DeckBrowser({
  onCloneDeck,
  onOpenBuilder,
}: {
  onCloneDeck: (deck: MetaDeckItem | DeckV2) => Promise<DeckV2 | void>
  onOpenBuilder: (deckId: string) => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [formatFilter, setFormatFilter] = useState<string>('All Formats')
  const [archetypeFilter, setArchetypeFilter] = useState<string>('All Archetypes')
  const [colorFilter, setColorFilter] = useState<Set<string>>(new Set())
  const [inspectingDeck, setInspectingDeck] = useState<MetaDeckItem | null>(null)

  const toggleColor = (c: string) => {
    const next = new Set(colorFilter)
    if (next.has(c)) next.delete(c)
    else next.add(c)
    setColorFilter(next)
  }

  const filteredCatalog = useMemo(() => {
    return META_DECK_CATALOG.filter((d) => {
      if (formatFilter !== 'All Formats' && d.format !== formatFilter) return false
      if (archetypeFilter !== 'All Archetypes' && d.archetype !== archetypeFilter) return false

      if (colorFilter.size > 0) {
        const matchesColors = [...colorFilter].every((c) => d.colors.includes(c as never))
        if (!matchesColors) return false
      }

      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const nameMatch = d.name.toLowerCase().includes(q)
        const cardMatch = d.cards.some((c) => c.cardName.toLowerCase().includes(q))
        if (!nameMatch && !cardMatch) return false
      }

      return true
    })
  }, [search, formatFilter, archetypeFilter, colorFilter])

  const handleCopy = async (deck: MetaDeckItem | DeckV2) => {
    await onCloneDeck(deck)
  }

  const handleEdit = async (deck: MetaDeckItem | DeckV2) => {
    const cloned = await onCloneDeck(deck)
    onOpenBuilder(cloned?.id ?? deck.id)
  }

  return (
    <div className="deck-browser-container">
      {/* Filters Bar */}
      <div className="browser-filters-bar">
        <div className="browser-search-wrap">
          <input
            className="browser-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common', 'search')}
          />
        </div>

        <select
          value={formatFilter}
          onChange={(e) => setFormatFilter(e.target.value)}
          className="browser-select"
        >
          <option value="All Formats">{t('decks', 'filter_all_formats')}</option>
          {ALL_FORMATS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>

        <select
          value={archetypeFilter}
          onChange={(e) => setArchetypeFilter(e.target.value)}
          className="browser-select"
        >
          <option value="All Archetypes">{t('common', 'all')}</option>
          <option value="Aggro">{t('decks', 'browser_filter_aggro')}</option>
          <option value="Midrange">{t('decks', 'browser_filter_midrange')}</option>
          <option value="Control">{t('decks', 'browser_filter_control')}</option>
          <option value="Combo">{t('decks', 'browser_filter_combo')}</option>
          <option value="Ramp">{t('decks', 'browser_filter_ramp')}</option>
          <option value="Tribal">{t('decks', 'browser_filter_tribal')}</option>
          <option value="Precon">{t('decks', 'browser_filter_precon')}</option>
        </select>

        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {(['W', 'U', 'B', 'R', 'G'] as const).map((c) => (
            <button
              key={c}
              type="button"
              className={`mana-filter-btn ${colorFilter.has(c) ? 'active' : ''} pip-${c.toLowerCase()}`}
              onClick={() => toggleColor(c)}
              title={`${t('decks', 'filter_cmc')} ${c}`}
            >
              <ManaPip symbol={c} size={16} />
            </button>
          ))}
        </div>
      </div>

      {/* Decks Grid */}
      <div className="browser-decks-grid">
        {filteredCatalog.map((deck) => {
          const cover = deck.coverCard

          return (
            <div
              key={deck.id}
              className="browser-deck-card"
              onClick={() => setInspectingDeck(deck)}
              {...clickableProps(() => setInspectingDeck(deck))}
            >
              {/* Card Art Header */}
              <BrowserDeckArt cover={cover}>
                <div className="browser-deck-art-gradient" />
                <div className="browser-deck-badges-overlay">
                  <Chip solid tone="gold" pill>{deck.format}</Chip>
                  <Chip tone="brand" pill>{deck.archetype}</Chip>
                </div>
              </BrowserDeckArt>

              {/* Content */}
              <div className="browser-deck-content">
                <h3 className="browser-deck-name" title={deck.name}>
                  {deck.name}
                </h3>
                <p className="browser-deck-desc">{deck.description}</p>

                <div className="browser-deck-actions" onClick={(e) => e.stopPropagation()}>
                  <Button variant="subtle" size="sm" className="browser-deck-btn" onClick={() => setInspectingDeck(deck)}>
                    <Icon name="eye" size={12} /> {t('common', 'search')}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="browser-deck-btn"
                    onClick={() => handleCopy(deck)}
                  >
                    <Icon name="copy" size={12} /> {t('common', 'copy')}
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Deck Inspection Modal */}
      {inspectingDeck && (
        <DeckInspectorModal
          deck={inspectingDeck}
          onClose={() => setInspectingDeck(null)}
          onCopy={handleCopy}
          onEdit={handleEdit}
        />
      )}
    </div>
  )
}
