import { useRef, useState } from 'react'
import { useTranslation } from '../i18n'
import type { CustomImageStore } from './customImage'

interface Props {
  store: CustomImageStore
  variant: 'sleeve' | 'playmat'
  label: string
  selected: boolean
  onSelect: () => void
  onRemoved: () => void
  testIdPrefix: string
}

export default function CustomImageTile({ store, variant, label, selected, onSelect, onRemoved, testIdPrefix }: Props) {
  const { t } = useTranslation()
  const image = store.use()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const isSelected = selected && !!image
  const uploadLabel = t('lobby', 'sleeve_custom_upload')

  const pick = () => inputRef.current?.click()

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(false)
    try {
      store.set(await store.fromFile(file))
      onSelect()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = () => {
    store.clear()
    onRemoved()
  }

  const check = isSelected && <span className="sleeve-check">✓</span>
  const content = image ? <img src={image} alt={label} draggable={false} /> : <span className="sleeve-preview-emblem">+</span>

  return (
    <div className="sleeve-custom" data-testid={`${testIdPrefix}-custom-tile`}>
      <button
        type="button"
        className={`${variant === 'sleeve' ? 'sleeve-item' : 'playmat-item'} ${isSelected ? 'selected' : ''}`}
        onClick={image ? onSelect : pick}
        disabled={busy}
        aria-pressed={isSelected}
        data-testid={`${testIdPrefix}-custom`}
        title={image ? label : uploadLabel}
      >
        {variant === 'sleeve' ? (
          <div className={`sleeve-preview ${image ? '' : 'sleeve-preview-empty'}`}>{content}{check}</div>
        ) : (
          <span className={`playmat-swatch playmat-custom-swatch ${image ? '' : 'sleeve-preview-empty'}`} aria-hidden="true">{content}{check}</span>
        )}
        <span className="sleeve-name">{image ? label : uploadLabel}</span>
      </button>
      {image && (
        <div className="sleeve-custom-actions">
          <button type="button" className="sleeve-custom-action" onClick={pick} disabled={busy} data-testid={`${testIdPrefix}-custom-replace`}>
            {t('lobby', 'sleeve_custom_replace')}
          </button>
          <button type="button" className="sleeve-custom-action" onClick={remove} disabled={busy} data-testid={`${testIdPrefix}-custom-remove`}>
            {t('lobby', 'sleeve_custom_remove')}
          </button>
        </div>
      )}
      {error && <span className="sleeve-custom-error" role="alert">{t('lobby', 'sleeve_custom_error')}</span>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void onFile(e.target.files?.[0])}
        data-testid={`${testIdPrefix}-custom-input`}
      />
    </div>
  )
}
