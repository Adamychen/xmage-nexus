import CloseButton from '../ui/CloseButton'
import { useMemo, useState } from 'react'
import { parseAnyDeck } from './parseDck'
import { loadDeckFromOnlineSource } from './onlineDeckService'
import type { DeckV2 } from './types'
import Icon from '../ui/Icon'
import DialogShell from '../ui/DialogShell'
import { useTranslation } from '../i18n'
import './DeckImportModal.css'
import './ImportDeckDialog.css'
import Button from '../ui/Button'

const ONLINE_URL_PATTERN = /(moxfield\.com\/decks\/|archidekt\.com\/decks\/)/i

/**
 * Punto de entrada unico y visible para crear un mazo nuevo por importacion:
 * pegar lista/URL, soltar o elegir archivo. Sustituye a los dos formularios
 * duplicados y mal etiquetados que existian antes (uno en DecksGallery, otro
 * escondido en la pestana de "Mazos Populares").
 */
export function ImportDeckDialog({
  onImport,
  onClose,
}: {
  onImport: (deck: DeckV2) => Promise<void> | void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isOnlineUrl = ONLINE_URL_PATTERN.test(text.trim())

  const localPreview = useMemo(() => {
    if (!text.trim() || isOnlineUrl) return null
    return parseAnyDeck(text, name.trim() || t('decks', 'import_placeholder'))
  }, [text, name, isOnlineUrl, t])

  const mainCount = localPreview?.cards.reduce((sum, c) => sum + c.amount, 0) ?? 0
  const sideCount = localPreview?.sideboard.reduce((sum, c) => sum + c.amount, 0) ?? 0
  const totalCount = mainCount + sideCount

  const handlePaste = async () => {
    try {
      const clip = await navigator.clipboard.readText()
      if (typeof clip === 'string' && clip.trim()) {
        setText(clip)
        setError(null)
        return
      }
      setError(t('errors', 'deck_read_failed'))
    } catch {
      setError(t('errors', 'deck_read_failed'))
    }
  }

  const handleFile = async (f: File) => {
    try {
      const content = await f.text()
      setText(content)
      if (!name.trim()) setName(f.name.replace(/\.[^./]+$/, ''))
      setError(null)
    } catch {
      setError(`${t('errors', 'deck_read_failed')}: ${f.name}`)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await handleFile(file)
  }

  const handleSubmit = async () => {
    if (!text.trim()) {
      setError(t('errors', 'deck_parse_failed'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const deck = await loadDeckFromOnlineSource(text, name.trim())
      if (!deck) {
        setError(t('errors', 'deck_parse_failed'))
        return
      }
      await onImport(deck)
      onClose()
    } catch {
      setError(t('errors', 'connection_failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogShell
      labelledBy="import-deck-title"
      titleId="import-deck-title"
      size="lg"
      legacyBackdropClass="deck-import-backdrop"
      legacyPanelClass={`deck-import-modal${isDragOver ? ' drag-over' : ''}`}
      kickerIcon="download"
      kickerLabel={t('decks', 'import_deck')}
      title={t('decks', 'import_deck')}
      message={t('decks', 'import_formats_with_url')}
      topRight={(
        <CloseButton variant="plain" size="md" className="deck-import-close-btn" onClick={onClose} />
      )}
      onBackdropClick={onClose}
      sectionProps={{
        onDragOver: (e) => {
          e.preventDefault()
          setIsDragOver(true)
        },
        onDragLeave: (e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return
          setIsDragOver(false)
        },
        onDrop: handleDrop,
      }}
    >
      <div className="deck-import-body">
        <label className="import-name-row">
          <span className="import-name-label">{t('decks', 'import_deck_name_label')}</span>
          <input
            className="import-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('decks', 'import_placeholder')}
          />
        </label>

        <span className="import-textarea-label">{t('decks', 'import_textarea_label')}</span>
        <div className="deck-import-textarea-wrap">
          <textarea
            className="deck-import-textarea"
            placeholder={t('decks', 'import_textarea_placeholder')}
            rows={10}
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

        <div className="deck-import-status-bar">
          <div className="import-status-left">
            <label className="import-file-btn">
              <Icon name="folder" size={12} /> {t('decks', 'import_choose_file')}
              <input
                type="file"
                accept=".dck,.txt,.dec,.cod,.o8d,.dek,.mtga,.mwdeck,.draft,.json"
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
            <button
              type="button"
              className="import-paste-btn"
              title={t('decks', 'import_paste')}
              onClick={() => void handlePaste()}
            >
              <Icon name="clipboard" size={12} /> {t('decks', 'import_paste')}
            </button>
          </div>

          <div className="import-status-right">
            {isOnlineUrl ? (
              <div className="import-badge success">
                <Icon name="globe" size={12} /> {t('decks', 'import_url_detected')}
              </div>
            ) : localPreview && totalCount > 0 ? (
              <div className="import-badge success">
                {t('decks', 'import_recognized', { mainCount: String(mainCount), sideCount: String(sideCount) })}
              </div>
            ) : text.trim() ? (
              <div className="import-badge warning">
                <Icon name="alert" size={13} /> {t('errors', 'deck_parse_failed')}
              </div>
            ) : (
              <span className="import-hint-text">{t('decks', 'import_waiting')}</span>
            )}
          </div>
        </div>

        {error && <div className="deck-import-error">{error}</div>}
      </div>

      <footer className="deck-import-footer">
        <Button variant="subtle" type="button" onClick={onClose}>
          {t('common', 'cancel')}
        </Button>
        <button
          type="button"
          className="import-submit-btn"
          disabled={busy || !text.trim()}
          onClick={() => void handleSubmit()}
        >
          {busy ? t('common', 'loading') : (<><Icon name="download" size={12} /> {t('decks', 'import_deck')}</>)}
        </button>
      </footer>
    </DialogShell>
  )
}
