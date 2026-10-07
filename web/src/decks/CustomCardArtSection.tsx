import { useRef, useState } from 'react'
import Icon from '../ui/Icon'
import IconButton from '../ui/IconButton'
import { useTranslation } from '../i18n'
import { setCustomCardArtDataUrl, setCustomCardArtFromFile, useCustomCardArt } from '../cards/customCardArt'

/**
 * Sección "Mi imagen" del selector de impresiones: permite subir una imagen
 * propia para la carta y quitarla. Vive en IndexedDB local y solo la ve el
 * jugador que la sube.
 */
export function CustomCardArtSection({ cardName }: { cardName: string }) {
  const { t } = useTranslation()
  const custom = useCustomCardArt(cardName)
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      await setCustomCardArtFromFile(cardName, file)
    } catch {
      setError(t('decks', 'custom_art_error_file'))
    } finally {
      setBusy(false)
    }
  }

  const openPicker = () => {
    if (!busy) inputRef.current?.click()
  }

  return (
    <div className="custom-art-section" data-testid="custom-art-section">
      <div className="custom-art-header">
        <span className="custom-art-title">{t('decks', 'custom_art_title')}</span>
        {custom && (
          <IconButton
            label={t('decks', 'custom_art_remove')}
            icon="trash"
            size="sm"
            className="custom-art-remove"
            onClick={() => setCustomCardArtDataUrl(cardName, null)}
          />
        )}
      </div>
      <div
        className={`custom-art-drop ${custom ? 'has-image' : ''} ${busy ? 'busy' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={custom ? t('decks', 'custom_art_replace') : t('decks', 'custom_art_upload')}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openPicker()
          }
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          void handleFile(e.dataTransfer.files?.[0])
        }}
      >
        {custom ? (
          <>
            <img src={custom} alt="" className="custom-art-thumb" draggable={false} />
            <span className="custom-art-action">{t('decks', 'custom_art_replace')}</span>
          </>
        ) : (
          <>
            <Icon name="palette" size={18} />
            <span className="custom-art-action">{t('decks', 'custom_art_upload')}</span>
            <span className="custom-art-hint">{t('decks', 'custom_art_drop_hint')}</span>
          </>
        )}
      </div>
      {busy && <div className="custom-art-hint">{t('common', 'loading')}</div>}
      {error && (
        <div className="custom-art-error">
          <Icon name="alert" size={12} /> {error}
        </div>
      )}
      <div className="custom-art-note">{t('decks', 'custom_art_note')}</div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="custom-art-input"
        onChange={(e) => {
          void handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}