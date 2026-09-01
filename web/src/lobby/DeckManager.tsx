import { useState, useMemo } from 'react'
import { DECKS, loadSavedCustomDecks, saveCustomDecks, type Deck, type DeckCard } from './decks'
import { setMyDeck, useStore } from '../state/store'
import { t as tStatic } from '../i18n'
import { useTranslation } from '../i18n'
import './DeckManager.css'

export function parseArenaDeck(text: string, defaultName?: string): Deck | null {
  const resolvedName = defaultName ?? tStatic('decks','import_placeholder')
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
  if (lines.length === 0) return null

  const cards: DeckCard[] = []
  const sideboard: DeckCard[] = []
  let isSideboard = false

  for (const line of lines) {
    if (line.toLowerCase() === 'deck' || line.toLowerCase() === 'main' || line.toLowerCase() === 'mainboard') {
      isSideboard = false
      continue
    }
    if (line.toLowerCase() === 'sideboard' || line.toLowerCase() === 'companion') {
      isSideboard = true
      continue
    }

    // Matches Arena format: "4 Lightning Bolt (M10) 146" or "4 Lightning Bolt" or "4x Lightning Bolt"
    const match = line.match(/^(\d+)x?\s+([^(\n\r]+?)(?:\s+\(([A-Za-z0-9_]+)\)\s+(\S+))?$/)
    if (match) {
      const amount = parseInt(match[1], 10) || 1
      const cardName = match[2].trim()
      const setCode = match[3] || 'M10'
      const cardNumber = match[4] || '1'

      const item: DeckCard = { cardName, setCode, cardNumber, amount }
      if (isSideboard) {
        sideboard.push(item)
      } else {
        cards.push(item)
      }
    }
  }

  if (cards.length === 0) return null
  return {
    name: resolvedName,
    cards,
    sideboard,
  }
}

export default function DeckManager() {
  const { t, tError } = useTranslation()
  const currentStoreDeck = useStore((s) => s.myDeck)
  const [customDecks, setCustomDecks] = useState<Deck[]>(loadSavedCustomDecks)
  const [selectedDeck, setSelectedDeck] = useState<Deck>(currentStoreDeck ?? DECKS[0])
  const [importText, setImportText] = useState('')
  const [importName, setImportName] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const allDecks = useMemo(() => [...DECKS, ...customDecks], [customDecks])

  const totalCards = useMemo(() => {
    return selectedDeck.cards.reduce((acc, c) => acc + c.amount, 0)
  }, [selectedDeck])

  const totalSideboard = useMemo(() => {
    return selectedDeck.sideboard.reduce((acc, c) => acc + c.amount, 0)
  }, [selectedDeck])

  const handleSelectActive = (d: Deck) => {
    setSelectedDeck(d)
    setMyDeck(d)
  }

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setImportError(null)
    const parsed = parseArenaDeck(importText, importName.trim() || t('decks','import_placeholder'))
    if (!parsed) {
      setImportError(t('errors','deck_parse_failed'))
      return
    }

    const updated = [...customDecks, parsed]
    setCustomDecks(updated)
    saveCustomDecks(updated)
    handleSelectActive(parsed)
    setShowImportModal(false)
    setImportText('')
    setImportName('')
  }

  const handleDeleteCustom = (d: Deck) => {
    const updated = customDecks.filter((x) => x !== d && x.name !== d.name)
    setCustomDecks(updated)
    saveCustomDecks(updated)
    if (selectedDeck.name === d.name) {
      handleSelectActive(DECKS[0])
    }
  }

  return (
    <div className="deck-manager">
      {/* Left Sidebar: List of Decks */}
      <div className="deck-sidebar">
        <div className="deck-sidebar-header">
          <h3>{t('decks','my_decks')} ({allDecks.length})</h3>
          <button
            type="button"
            className="deck-import-btn"
            onClick={() => setShowImportModal(true)}
          >
            📥 {t('decks','import_deck')}
          </button>
        </div>

        <div className="deck-list-items">
          {allDecks.map((d) => {
            const isActive = selectedDeck.name === d.name
            const isCustom = customDecks.some((c) => c.name === d.name)
            const count = d.cards.reduce((sum, c) => sum + c.amount, 0)

            return (
              <div
                key={d.name}
                className={`deck-card-item ${isActive ? 'active' : ''}`}
                onClick={() => handleSelectActive(d)}
              >
                <div className="deck-item-info">
                  <span className="deck-item-name">{d.name}</span>
                  <span className="deck-item-meta">{count} {t('decks','total_cards')} {isCustom ? `• ${t('decks','filter_recent')}` : `• ${t('common','all')}`}</span>
                </div>
                {isActive && <span className="deck-active-badge">✓ {t('common','done')}</span>}
                {isCustom && (
                  <button
                    type="button"
                    className="deck-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteCustom(d)
                    }}
                    title={t('common','delete')}
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Main Area: Deck Viewer & Card Breakdown */}
      <div className="deck-content-view">
        <div className="deck-view-header">
          <div>
            <h2>{selectedDeck.name}</h2>
            <p className="deck-view-subtitle">
              {totalCards} {t('decks','total_cards')} {totalSideboard > 0 ? `+ ${totalSideboard} ` + t('decks','sideboard') : ''}
            </p>
          </div>
          <button
            type="button"
            className="primary deck-select-primary"
            onClick={() => handleSelectActive(selectedDeck)}
          >
            {currentStoreDeck?.name === selectedDeck.name ? `⭐ ${t('common','done')}` : t('common','confirm')}
          </button>
        </div>

        <div className="deck-breakdown-grid">
          <div className="deck-section-box">
            <h3>{t('decks','total_cards')} ({totalCards})</h3>
            <div className="deck-cards-list">
              {selectedDeck.cards.map((c, i) => (
                <div key={i} className="deck-card-row">
                  <span className="card-amount-pill">{c.amount}x</span>
                  <span className="card-row-name">{c.cardName}</span>
                  <span className="card-row-set">{c.setCode} #{c.cardNumber}</span>
                </div>
              ))}
            </div>
          </div>

          {selectedDeck.sideboard.length > 0 && (
            <div className="deck-section-box">
              <h3>{t('decks','sideboard')} ({totalSideboard})</h3>
              <div className="deck-cards-list">
                {selectedDeck.sideboard.map((c, i) => (
                  <div key={i} className="deck-card-row">
                    <span className="card-amount-pill sideboard">{c.amount}x</span>
                    <span className="card-row-name">{c.cardName}</span>
                    <span className="card-row-set">{c.setCode} #{c.cardNumber}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="overlay">
          <div className="dialog panel import-dialog">
            <h2>📥 {t('decks','import_deck')}</h2>
            <p className="import-desc">{t('decks','import_hint')}</p>

            <label>
              {t('decks','import_placeholder')}
              <input
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                placeholder={t('decks','import_placeholder')}
                required
              />
            </label>

            <label>
              {t('decks','total_cards')}
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={`Deck\n4 Lightning Bolt\n20 Mountain\n\nSideboard\n2 Red Elemental Blast`}
                rows={10}
                required
              />
            </label>

            {importError && <div className="error-box">{tError(importError)}</div>}

            <div className="import-actions">
              <button type="button" onClick={() => setShowImportModal(false)}>
                {t('common','cancel')}
              </button>
              <button className="primary" onClick={handleImportSubmit}>
                {t('common','save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
