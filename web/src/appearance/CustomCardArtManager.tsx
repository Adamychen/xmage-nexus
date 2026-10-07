import { useCallback, useEffect, useState } from 'react'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import IconButton from '../ui/IconButton'
import { confirmDialog } from '../ui/confirmDialog'
import { useTranslation } from '../i18n'
import { listCustomCardArt, onCustomCardArtChange, setCustomCardArtDataUrl, type CustomCardArtEntry } from '../cards/customCardArt'

/**
 * Gestor de imágenes de carta propias en Ajustes de apariencia: lista todo lo
 * subido con miniatura, botón de borrado por imagen y borrado masivo con
 * confirmación.
 */
export default function CustomCardArtManager() {
  const { t } = useTranslation()
  const [items, setItems] = useState<CustomCardArtEntry[] | null>(null)

  const refresh = useCallback(() => {
    void listCustomCardArt().then(setItems)
  }, [])

  useEffect(() => {
    refresh()
    return onCustomCardArtChange(refresh)
  }, [refresh])

  const handleClearAll = async () => {
    if (!items || items.length === 0) return
    const ok = await confirmDialog(t('lobby', 'custom_card_art_clear_confirm', { count: items.length }))
    if (!ok) return
    for (const item of items) setCustomCardArtDataUrl(item.name, null)
  }

  if (items === null) return null

  const approxKb = Math.round(items.reduce((sum, i) => sum + i.dataUrl.length, 0) / 1024)

  return (
    <div className="custom-card-art-manager" data-testid="custom-card-art-manager">
      {items.length === 0 ? (
        <div className="custom-card-art-empty">
          <Icon name="palette" size={16} />
          <span>{t('lobby', 'custom_card_art_empty')}</span>
        </div>
      ) : (
        <>
          <div className="custom-card-art-meta">
            <span>{t('lobby', 'custom_card_art_count', { count: items.length, kb: approxKb })}</span>
            <Button
              variant="ghost"
              size="sm"
              icon="trash"
              className="custom-card-art-clear"
              onClick={() => void handleClearAll()}
            >
              {t('lobby', 'custom_card_art_clear')}
            </Button>
          </div>
          <div className="custom-card-art-grid">
            {items.map((item) => (
              <div key={item.name} className="custom-card-art-item" title={item.name}>
                <img src={item.dataUrl} alt={item.name} className="custom-card-art-thumb" draggable={false} />
                <span className="custom-card-art-name">{item.name}</span>
                <IconButton
                  label={`${t('lobby', 'custom_card_art_remove')}: ${item.name}`}
                  icon="trash"
                  size="xs"
                  className="custom-card-art-item-remove"
                  onClick={() => setCustomCardArtDataUrl(item.name, null)}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}