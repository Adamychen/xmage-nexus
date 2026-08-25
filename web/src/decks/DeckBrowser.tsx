import { useState, useMemo } from 'react'
import type { MetaDeckItem } from './metaDeckCatalog'
import { META_DECK_CATALOG } from './metaDeckCatalog'
import { DeckInspectorModal } from './DeckInspectorModal'
import { loadDeckFromOnlineSource } from './onlineDeckService'
import type { DeckV2 } from './types'
import { ALL_FORMATS } from './formatRules'
import { ManaPip } from './ArenaManaSymbols'
import './DeckBrowser.css'

export function DeckBrowser({
  onCloneDeck,
  onOpenBuilder,
}: {
  onCloneDeck: (deck: MetaDeckItem | DeckV2) => Promise<void>
  onOpenBuilder: (deckId: string) => void
}) {
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
    setImportStatus('Descargando e interpretando el mazo...')

    try {
      const parsed = await loadDeckFromOnlineSource(importInput, importName)
      if (parsed) {
        await onCloneDeck(parsed)
        setImportStatus(`✓ ¡Mazo "${parsed.name}" importado con éxito!`)
        setImportInput('')
        setImportName('')
        setTimeout(() => onOpenBuilder(parsed.id), 800)
      } else {
        setImportStatus('❌ No se pudo interpretar el mazo. Verifica el enlace o el formato de texto.')
      }
    } catch {
      setImportStatus('❌ Error al conectar con el servidor.')
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
          🏆 Meta & Decks Populares ({filteredCatalog.length})
        </button>
        <button
          type="button"
          className={`browser-tab-btn ${tab === 'import' ? 'active' : ''}`}
          onClick={() => setTab('import')}
        >
          🌐 Importar por URL / Texto (Moxfield, Archidekt)
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
                placeholder="Buscar por mazo o carta (ej. Murktide, Atraxa)..."
              />
            </div>

            <select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
              className="browser-select"
            >
              <option>All Formats</option>
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
              <option>All Archetypes</option>
              <option>Aggro</option>
              <option>Midrange</option>
              <option>Control</option>
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
                  title={`Filtrar por ${c}`}
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
                        👁️ Ver Lista
                      </button>
                      <button
                        type="button"
                        className="browser-deck-btn primary"
                        onClick={() => handleCopy(deck)}
                      >
                        📋 Copiar
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
          <h2 className="url-import-title">Importar Mazo desde Enlace o Texto</h2>
          <p style={{ color: '#a0aec0', fontSize: '0.82rem', margin: 0 }}>
            Pega una URL pública de <strong>Moxfield</strong> (ej. <code>https://www.moxfield.com/decks/...</code>) o <strong>Archidekt</strong>, o pega la lista de cartas en formato Arena o .dck.
          </p>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#cbd5e0', marginBottom: 4 }}>
              URL de Moxfield / Archidekt o Lista de Cartas:
            </label>
            <textarea
              className="url-import-textarea"
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              placeholder="https://www.moxfield.com/decks/k8N3h...  o pega la lista de cartas aquí..."
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#cbd5e0', marginBottom: 4 }}>
              Nombre personalizado (Opcional):
            </label>
            <input
              className="url-import-input"
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
              placeholder="Nombre del mazo..."
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
            {importLoading ? 'Importando…' : '🚀 Importar a Mis Mazos'}
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
