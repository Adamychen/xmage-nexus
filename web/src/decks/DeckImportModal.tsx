import { useState, useMemo } from 'react'
import { parseAnyDeck } from './parseDck'
import type { DeckCard } from '../lobby/decks'
import { useTranslation } from '../i18n'
import './DeckImportModal.css'

export interface ImportResult {
  cards: DeckCard[]
  sideboard: DeckCard[]
  mode: 'add' | 'replace'
}

export function DeckImportModal({
  deckName,
  onImport,
  onClose,
}: {
  deckName: string
  onImport: (result: ImportResult) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'add' | 'replace'>('add')
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsed = useMemo(() => {
    if (!text.trim()) return null
    return parseAnyDeck(text, deckName)
  }, [text, deckName])

  const mainCount = parsed?.cards.reduce((sum, c) => sum + c.amount, 0) ?? 0
  const sideCount = parsed?.sideboard.reduce((sum, c) => sum + c.amount, 0) ?? 0
  const totalCount = mainCount + sideCount

  const handleFile = async (f: File) => {
    try {
      const content = await f.text()
      setText(content)
      setError(null)
    } catch {
      setError(`${t('errors', 'deck_read_failed')}: ${f.name}`)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      await handleFile(file)
    }
  }

  const handleSubmit = () => {
    if (!parsed || totalCount === 0) {
      setError(t('errors', 'deck_parse_failed'))
      return
    }

    onImport({
      cards: parsed.cards,
      sideboard: parsed.sideboard,
      mode,
    })
    onClose()
  }

  return (
    <div className="deck-import-backdrop" onClick={onClose}>
      <div
        className={`deck-import-modal ${isDragOver ? 'drag-over' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return
          setIsDragOver(false)
        }}
        onDrop={handleDrop}
      >
        <header className="deck-import-header">
          <div className="deck-import-title-wrap">
            <h2 className="deck-import-title">📥 {t('decks', 'import_deck')}</h2>
            <span className="deck-import-formats">XMage .dck · MTG Arena · MTGO · Texto Plano</span>
          </div>
          <button type="button" className="deck-import-close-btn" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="deck-import-body">
          {/* Mode Selector Row */}
          <div className="deck-import-mode-row">
            <span className="import-mode-label">{t('decks', 'import_hint')}:</span>
            <div className="import-mode-options">
              <button
                type="button"
                className={`import-mode-btn ${mode === 'add' ? 'active' : ''}`}
                onClick={() => setMode('add')}
              >
                ➕ {t('decks', 'import_mode_add')}
              </button>
              <button
                type="button"
                className={`import-mode-btn ${mode === 'replace' ? 'active' : ''}`}
                onClick={() => setMode('replace')}
              >
                🔄 {t('decks', 'import_mode_replace')}
              </button>
            </div>
          </div>

          {/* Text Area with Drag & Drop */}
          <div className="deck-import-textarea-wrap">
            <textarea
              className="deck-import-textarea"
              placeholder={t('decks', 'import_hint')}
              rows={12}
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setError(null)
              }}
              autoFocus
            />

            {isDragOver && (
              <div className="import-drop-overlay">
                <span>{t('decks', 'builder_drag_hint')}</span>
              </div>
            )}
          </div>

          {/* Status & Preview Summary Bar */}
          <div className="deck-import-status-bar">
            <div className="import-status-left">
              <label className="import-file-btn">
                📂 {t('common', 'search')}
                <input
                  type="file"
                  accept=".dck,.txt,.dec,.cod,.o8d"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (f) await handleFile(f)
                    e.currentTarget.value = ''
                  }}
                />
              </label>

              {text.trim() && (
                <button
                  type="button"
                  className="import-clear-btn"
                  onClick={() => {
                    setText('')
                    setError(null)
                  }}
                >
                  {t('common', 'clear')}
                </button>
              )}
            </div>

            <div className="import-status-right">
              {parsed && totalCount > 0 ? (
                <div className="import-badge success">
                  ✓ Reconocidas: <strong>{mainCount}</strong> principales
                  {sideCount > 0 && ` + ${sideCount} banquillo`}
                </div>
              ) : text.trim() ? (
                <div className="import-badge warning">
                  ⚠️ {t('errors', 'deck_parse_failed')}
                </div>
              ) : (
                <span className="import-hint-text">Esperando lista de cartas…</span>
              )}
            </div>
          </div>

          {error && <div className="deck-import-error">{error}</div>}
        </div>

        <footer className="deck-import-footer">
          <button type="button" className="import-cancel-btn" onClick={onClose}>
            {t('common', 'cancel')}
          </button>
          <button
            type="button"
            className="import-submit-btn"
            disabled={totalCount === 0}
            onClick={handleSubmit}
          >
            {mode === 'replace' ? `🔄 ${t('decks', 'import_mode_replace')}` : `➕ ${t('decks', 'import_mode_add')}`}{' '}
            {totalCount > 0 ? `(${totalCount} ${t('decks', 'total_cards')})` : ''}
          </button>
        </footer>
      </div>
    </div>
  )
}
