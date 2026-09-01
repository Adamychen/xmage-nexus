import { useState, useMemo } from 'react'
import type { MetaDeckItem } from './metaDeckCatalog'
import { META_DECK_CATALOG } from './metaDeckCatalog'
import { DeckInspectorModal } from './DeckInspectorModal'
import { loadDeckFromOnlineSource } from './onlineDeckService'
import type { DeckV2 } from './types'
import { ALL_FORMATS } from './formatRules'
import { ManaPip } from './ArenaManaSymbols'
import { useTranslation } from '../i18n'
import './DeckBrowser.css'

export function DeckBrowser({
  onCloneDeck,
  onOpenBuilder,
}: {
  onCloneDeck: (deck: MetaDeckItem | DeckV2) => Promise<void>
  onOpenBuilder: (deckId: string) => void
}) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'catalog' | 'import'>('catalog')
  const [search, setSearch] = useState('')
  const [formatFilter, setFormatFilter] = useState<string>('All Formats')
  const [archetypeFilter, setArchetypeFilter] = useState<string>('All Archetypes')
  const [colorFilter, setColorFilter] = useState<Set<string>>(new Set())
  const [inspectingDeck, setInspectingDeck] = useState<MetaDeckItem | null>(null)

  // URL / Text Import state
  const [importInput, setImportInput] = useState('')
  const [importName, setImportName] = useState('')
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [importLoading, setImportLoading] = useState(false)

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
    await onCloneDeck(deck)
    onOpenBuilder(deck.id)
  }

  const handleOnlineImport = async () => {
    if (!importInput.trim()) return
    setImportLoading(true)
    setImportStatus(t('common', 'loading'))

    try {
      const parsed = await loadDeckFromOnlineSource(importInput, importName)
      if (parsed) {
        await onCloneDeck(parsed)
        setImportStatus(`✓ ${parsed.name} ${t('common', 'done')}`)
        setImportInput('')
        setImportName('')
        setTimeout(() => onOpenBuilder(parsed.id), 800)
      } else {
        setImportStatus(t('errors', 'deck_parse_failed'))
      }
    } catch {
      setImportStatus(t('errors', 'connection_failed'))
    } finally {
      setImportLoading(false)
    }
  }

  return (
    <div className="deck-browser-container">
      {/* Top Tabs */}
      <nav className="browser-nav-bar">
        <button
          type="button"
          className={`browser-tab-btn ${tab === 'catalog' ? 'active' : ''}`}
          onClick={() => setTab('catalog')}
        >
          🏆 {t('decks', 'popular_meta')} ({filteredCatalog.length})
        </button>
        <button
          type="button"
          className={`browser-tab-btn ${tab === 'import' ? 'active' : ''}`}
          onClick={() => setTab('import')}
        >
          🌐 {t('decks', 'import_deck')}
        </button>
      </nav>

      {tab === 'catalog' ? (
        <>
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
              <option>{t('decks', 'filter_all_formats')}</option>
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
              <option>{t('common', 'all')}</option>
              <option>{t('decks', 'browser_filter_aggro')}</option>
              <option>{t('decks', 'browser_filter_midrange')}</option>
              <option>{t('decks', 'browser_filter_control')}</option>
              <option>Combo</option>
              <option>Ramp</option>
              <option>Tribal</option>
              <option>Precon</option>
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
              const artUrl = `https://api.scryfall.com/cards/${cover.setCode}/${cover.cardNumber}?format=image&version=art_crop`

              return (
                <div
                  key={deck.id}
                  className="browser-deck-card"
                  onClick={() => setInspectingDeck(deck)}
                >
                  {/* Card Art Header */}
                  <div
                    className="browser-deck-art-header"
                    style={{ backgroundImage: `url(${artUrl})` }}
                  >
                    <div className="browser-deck-art-gradient" />
                    <div className="browser-deck-badges-overlay">
                      <span className="browser-deck-format-chip">{deck.format}</span>
                      <span className="browser-deck-arch-chip">{deck.archetype}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="browser-deck-content">
                    <h3 className="browser-deck-name" title={deck.name}>
                      {deck.name}
                    </h3>
                    <p className="browser-deck-desc">{deck.description}</p>

                    <div className="browser-deck-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="browser-deck-btn"
                        onClick={() => setInspectingDeck(deck)}
                      >
                        👁️ {t('common', 'search')}
                      </button>
                      <button
                        type="button"
                        className="browser-deck-btn primary"
                        onClick={() => handleCopy(deck)}
                      >
                        📋 {t('common', 'copy')}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        /* Online URL / Text Import View */
        <div className="browser-url-import-view">
          <h2 className="url-import-title">{t('decks', 'import_deck')}</h2>
          <p style={{ color: '#a0aec0', fontSize: '0.82rem', margin: 0 }}>
            {t('decks', 'browser_import_hint')}
          </p>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#cbd5e0', marginBottom: 4 }}>
              {t('decks', 'browser_import_hint')}:
            </label>
            <textarea
              className="url-import-textarea"
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              placeholder={t('decks', 'browser_import_hint')}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#cbd5e0', marginBottom: 4 }}>
              {t('decks', 'import_placeholder')}:
            </label>
            <input
              className="url-import-input"
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
              placeholder={t('decks', 'import_placeholder')}
            />
          </div>

          {importStatus && (
            <div style={{ color: importStatus.startsWith('✓') ? '#68d391' : '#fc8181', fontSize: '0.85rem', fontWeight: 700 }}>
              {importStatus}
            </div>
          )}

          <button
            type="button"
            className="url-import-submit-btn"
            disabled={importLoading || !importInput.trim()}
            onClick={handleOnlineImport}
          >
            {importLoading ? t('common', 'loading') : `🚀 ${t('decks', 'import_deck')}`}
          </button>
        </div>
      )}

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
