import { useState, useEffect } from 'react'
import { scryfallCardImage } from './scryfallSearch'
import { useTranslation } from '../i18n'
import './CardPrintingsModal.css'

export interface CardPrinting {
  id: string
  set: string
  setName: string
  collectorNumber: string
  releasedAt: string
  rarity: string
  imageUrl: string
  artCropUrl?: string
}

export function parseScryfallPrints(data: any): CardPrinting[] {
  if (!data || !Array.isArray(data.data)) return []
  return data.data.map((item: any) => ({
    id: item.id,
    set: (item.set || '').toUpperCase(),
    setName: item.set_name || item.set || '',
    collectorNumber: item.collector_number || '',
    releasedAt: item.released_at || '',
    rarity: item.rarity || 'common',
    imageUrl: scryfallCardImage(item),
    artCropUrl: item.image_uris?.art_crop || item.card_faces?.[0]?.image_uris?.art_crop,
  }))
}

export function CardPrintingsModal({
  cardName,
  currentSet,
  currentNumber,
  onSelectPrinting,
  onClose,
}: {
  cardName: string
  currentSet: string
  currentNumber: string
  onSelectPrinting: (setCode: string, cardNumber: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [printings, setPrintings] = useState<CardPrinting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const url = `https://api.scryfall.com/cards/search?q=!%22${encodeURIComponent(cardName)}%22&unique=prints&order=released&dir=desc`

    fetch(url, { headers: { Accept: 'application/json' } })
      .then((res) => {
        if (!res.ok) throw new Error(`${t('errors', 'generic_error')} (${res.status})`)
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        const prints = parseScryfallPrints(json)
        setPrintings(prints)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message || t('errors', 'generic_error'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [cardName])

  return (
    <div className="printings-backdrop" onClick={onClose}>
      <div className="printings-modal" onClick={(e) => e.stopPropagation()}>
        <header className="printings-header">
          <div className="printings-title-wrap">
            <h2 className="printings-title">🎨 {t('dialogs', 'card_printings_title')}</h2>
            <span className="printings-card-name">{cardName}</span>
          </div>
          <button type="button" className="printings-close-btn" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="printings-body">
          {loading && (
            <div className="printings-status-box">
              <div className="printings-spinner" />
              <span>{t('common', 'loading')} {cardName}…</span>
            </div>
          )}

          {error && !loading && (
            <div className="printings-status-box error">
              <span>⚠️ {error}</span>
            </div>
          )}

          {!loading && !error && printings.length === 0 && (
            <div className="printings-status-box">
              <span>{t('decks', 'sample_no_cards')}</span>
            </div>
          )}

          {!loading && printings.length > 0 && (
            <div className="printings-grid">
              {printings.map((p) => {
                const isSelected =
                  p.set.toLowerCase() === currentSet.toLowerCase() &&
                  p.collectorNumber === currentNumber

                return (
                  <div
                    key={p.id}
                    className={`printing-card-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onSelectPrinting(p.set, p.collectorNumber)
                      onClose()
                    }}
                  >
                    <div className="printing-img-wrap">
                      <img src={p.imageUrl} alt={`${cardName} (${p.set})`} loading="lazy" />
                      {isSelected && <div className="printing-selected-badge">✓ {t('common', 'done')}</div>}
                    </div>

                    <div className="printing-info">
                      <span className="printing-set-name" title={p.setName}>
                        {p.setName}
                      </span>
                      <div className="printing-meta-row">
                        <span className="printing-set-code">{p.set} #{p.collectorNumber}</span>
                        <span className={`printing-rarity ${p.rarity}`}>{p.rarity}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
