import { useState, useMemo, useEffect } from 'react'
import type { TableView } from '../net/types'
import {
  getAllAvailableDecks,
  saveCustomDecks,
  loadSavedCustomDecks,
  type Deck,
  DEFAULT_DECK,
} from './decks'
import { parseArenaDeck } from './DeckManager'
import { setMyDeck, useStore } from '../state/store'
import { useTranslation } from '../i18n'
import './JoinTableDialog.css'

interface JoinTableDialogProps {
  table: TableView
  busy?: boolean
  title?: string
  submitLabel?: string
  onClose: () => void
  onJoin: (table: TableView, deck: Deck, password?: string) => Promise<void>
}

export default function JoinTableDialog({
  table,
  busy = false,
  title,
  submitLabel,
  onClose,
  onJoin,
}: JoinTableDialogProps) {
  const { t, tError } = useTranslation()
  const currentEquippedDeck = useStore((s) => s.myDeck)
  const [allDecks, setAllDecks] = useState<Deck[]>(() => getAllAvailableDecks())
  const [selectedDeck, setSelectedDeck] = useState<Deck>(() => currentEquippedDeck ?? allDecks[0] ?? DEFAULT_DECK)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const mod = await import('../decks/storage')
        const st = mod.getDeckStorage()
        const v2 = await st.list()
        if (cancelled) return
        const maps = new Map<string, Deck>()
        for (const d of v2) {
          const deck: Deck = { name: d.name, cards: d.cards, sideboard: d.sideboard }
          maps.set(deck.name, deck)
        }
        for (const d of getAllAvailableDecks()) {
          if (!maps.has(d.name)) maps.set(d.name, d)
        }
        const merged = [...maps.values()]
        setAllDecks(merged)
        if (merged.length && !merged.some((d) => d.name === selectedDeck.name)) setSelectedDeck(merged[0])
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])
  const [password, setPassword] = useState('')
  const [setAsDefault, setSetAsDefault] = useState(true)

  // Quick inline import state
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importName, setImportName] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)

  const isCommanderTable = useMemo(() => {
    return (
      table.deckType?.toLowerCase().includes('commander') ||
      table.gameType?.toLowerCase().includes('commander')
    )
  }, [table])

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setImportError(null)
    const name = importName.trim() || t('decks','import_placeholder')
    const parsed = parseArenaDeck(importText, name)
    if (!parsed) {
      setImportError(t('errors','deck_parse_failed'))
      return
    }

    const saved = loadSavedCustomDecks()
    const updatedCustom = [...saved, parsed]
    saveCustomDecks(updatedCustom)
    const updatedAll = getAllAvailableDecks()
    setAllDecks(updatedAll)
    setSelectedDeck(parsed)
    setShowImport(false)
    setImportText('')
    setImportName('')
  }

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    setJoinError(null)
    if (setAsDefault) {
      setMyDeck(selectedDeck)
    }
    try {
      await onJoin(table, selectedDeck, password.trim() || undefined)
    } catch (err) {
      setJoinError((err as Error).message)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="join-modal-backdrop">
      <div
        className="join-table-modal panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        data-testid="join-table-dialog"
      >
        {/* Header */}
        <div className="join-modal-header">
          <div className="join-header-titles">
            <span className="join-target-pill" data-testid="join-target-pill">{title ? title.toUpperCase() : t('lobby','join_human_btn').toUpperCase()}</span>
            <h2 className="join-table-title">{table.tableName}</h2>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Table summary badges */}
        <div className="join-table-meta-bar">
          <span className="meta-badge meta-format">
            📜 {t('lobby','create_field_format')}: <strong>{table.deckType || t('common','all')}</strong>
          </span>
          <span className="meta-badge meta-mode">
            🎮 {t('lobby','create_field_num_players')}: <strong>{table.gameType || '1v1'}</strong>
          </span>
          <span className="meta-badge meta-host">
            👑 {t('lobby','host')}: <strong>{table.controllerName?.split(',')[0]?.trim() || table.controllerName}</strong>
          </span>
          {table.passworded && (
            <span className="meta-badge meta-lock">
              🔒 {t('lobby','join_requires_password')}
            </span>
          )}
        </div>

        {/* Error Banner if any */}
        {joinError && (
          <div className="join-error-banner">
            <span className="join-error-icon">⚠️</span>
            <span className="join-error-text">{tError(joinError)}</span>
          </div>
        )}

        <form onSubmit={handleConfirm} className="join-modal-form">
          {/* Password field if protected */}
          {table.passworded && (
            <div className="join-password-section">
              <label className="join-field-label">
                <span>🔑 {t('lobby','create_field_password')}:</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('lobby','join_password_enter_placeholder')}
                  required
                  className="join-password-input"
                  autoFocus
                />
              </label>
            </div>
          )}

          {/* Deck Selection Section */}
          <div className="join-deck-section">
            <div className="join-deck-section-header">
              <span className="join-deck-section-title">
                🃏 {t('lobby','active_deck')}
              </span>
              <button
                type="button"
                className="join-import-toggle-btn"
                onClick={() => setShowImport(!showImport)}
              >
                {showImport ? `✕ ${t('lobby','join_import_toggle_close')}` : `📋 ${t('lobby','join_import_toggle_open')}`}
              </button>
            </div>

            {/* Inline Quick Importer */}
            {showImport && (
              <div className="join-inline-importer">
                <h4>{t('decks','import_deck')}</h4>
                <div className="import-row">
                  <input
                    type="text"
                    value={importName}
                    onChange={(e) => setImportName(e.target.value)}
                    placeholder={t('decks','import_placeholder')}
                    className="import-name-input"
                  />
                </div>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={t('lobby','join_import_cards_placeholder')}
                  rows={4}
                  className="import-textarea"
                />
                {importError && <p className="import-error-msg">{tError(importError)}</p>}
                <div className="import-actions">
                  <button
                    type="button"
                    className="primary import-submit-btn"
                    onClick={handleImportSubmit}
                    disabled={!importText.trim()}
                  >
                    {t('lobby','join_save_select')}
                  </button>
                </div>
              </div>
            )}

            {/* Deck List Cards */}
            <div className="join-deck-cards-list">
              {allDecks.map((d) => {
                const isSelected = selectedDeck.name === d.name
                const count = d.cards.reduce((acc, c) => acc + c.amount, 0)
                const sbCount = d.sideboard.reduce((acc, c) => acc + c.amount, 0)
                const sampleCards = d.cards
                  .slice(0, 3)
                  .map((c) => c.cardName)
                  .join(', ')

                const isRecommended = isCommanderTable ? count >= 100 : count === 60

                return (
                  <div
                    key={d.name}
                    className={`join-deck-card ${isSelected ? 'selected' : ''} ${
                      isRecommended ? 'recommended' : ''
                    }`}
                    onClick={() => setSelectedDeck(d)}
                  >
                    <div className="deck-card-radio">
                      <input
                        type="radio"
                        name="join-deck-choice"
                        checked={isSelected}
                        onChange={() => setSelectedDeck(d)}
                      />
                    </div>
                    <div className="deck-card-content">
                      <div className="deck-card-title-row">
                        <span className="deck-card-name">🃏 {d.name}</span>
                        <span className="deck-card-count-badge">
                          {count} {t('decks','total_cards')} {sbCount > 0 ? `(+${sbCount} sb)` : ''}
                        </span>
                      </div>
                      <span className="deck-card-sample">{sampleCards}…</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="join-modal-footer">
            <label className="join-default-checkbox">
              <input
                type="checkbox"
                checked={setAsDefault}
                onChange={(e) => setSetAsDefault(e.target.checked)}
              />
              <span>{t('common','save')}</span>
            </label>

            <div className="join-footer-buttons">
              <button
                type="button"
                className="join-cancel-btn"
                data-testid="join-cancel-btn"
                onClick={onClose}
                disabled={busy}
              >
                {t('common','cancel')}
              </button>
              <button
                type="submit"
                className="primary join-submit-btn"
                disabled={busy || (table.passworded && !password.trim())}
              >
                {busy ? t('common','loading') : (submitLabel || t('lobby','join_with_deck', { name: selectedDeck.name }))}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
