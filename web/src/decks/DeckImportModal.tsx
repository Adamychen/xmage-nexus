import { useState, useMemo } from 'react'
import { parseAnyDeck } from './parseDck'
import type { DeckCard } from '../lobby/decks'
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
      setError(`No se pudo leer el archivo ${f.name}`)
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
      setError('No se pudieron reconocer cartas válidas en el texto.')
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
            <h2 className="deck-import-title">📥 Importar y Pegar Cartas</h2>
            <span className="deck-import-formats">XMage .dck · MTG Arena · MTGO · Texto Plano</span>
          </div>
          <button type="button" className="deck-import-close-btn" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="deck-import-body">
          {/* Mode Selector Row */}
          <div className="deck-import-mode-row">
            <span className="import-mode-label">Acción de importación:</span>
            <div className="import-mode-options">
              <button
                type="button"
                className={`import-mode-btn ${mode === 'add' ? 'active' : ''}`}
                onClick={() => setMode('add')}
              >
                ➕ Añadir al mazo actual
              </button>
              <button
                type="button"
                className={`import-mode-btn ${mode === 'replace' ? 'active' : ''}`}
                onClick={() => setMode('replace')}
              >
                🔄 Reemplazar mazo completo
              </button>
            </div>
          </div>

          {/* Text Area with Drag & Drop */}
          <div className="deck-import-textarea-wrap">
            <textarea
              className="deck-import-textarea"
              placeholder={`Pega aquí la lista de cartas o arrastra un archivo .dck / .txt...\n\nFormatos soportados:\n• XMage: 4 [M10:146] Lightning Bolt\n• MTG Arena: 4 Lightning Bolt (M10) 146\n• Banquillo: SB: 2 Red Elemental Blast o bajo la línea "Sideboard"`}
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
                <span>Suelta tu archivo aquí (.dck, .txt, .dec)</span>
              </div>
            )}
          </div>

          {/* Status & Preview Summary Bar */}
          <div className="deck-import-status-bar">
            <div className="import-status-left">
              <label className="import-file-btn">
                📂 Cargar archivo (.dck, .txt)
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
                  Limpiar texto
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
                  ⚠️ No se han detectado cartas válidas
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
            Cancelar
          </button>
          <button
            type="button"
            className="import-submit-btn"
            disabled={totalCount === 0}
            onClick={handleSubmit}
          >
            {mode === 'replace' ? '🔄 Reemplazar Mazo' : '➕ Añadir Cartas'}{' '}
            {totalCount > 0 ? `(${totalCount} cartas)` : ''}
          </button>
        </footer>
      </div>
    </div>
  )
}
