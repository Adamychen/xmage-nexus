import CloseButton from '../ui/CloseButton'
import { useState, useEffect } from 'react'
import { scryfallCardImage, type ScryfallSearchCard } from './scryfallSearch'
import Icon from '../ui/Icon'
import DialogShell from '../ui/DialogShell'
import { useTranslation } from '../i18n'
import { scryfallFetch } from '../cards/scryfallClient'
import { CustomCardArtSection } from './CustomCardArtSection'
import { xmagePrintingsOf } from './xmageCatalog'
import './CardPrintingsModal.css'

export interface CardPrinting {
  id: string
  set: string
  setName: string
  collectorNumber: string
  releasedAt: string
  rarity: string
  imageUrl: string | null
  artCropUrl?: string
}

/** A `/cards/search?unique=prints` answer: a page of printings. */
type ScryfallPrintsJson = { data?: (ScryfallSearchCard & { set_name?: string })[] } | null | undefined

export function parseScryfallPrints(json: unknown): CardPrinting[] {
  const data = json as ScryfallPrintsJson
  if (!data || !Array.isArray(data.data)) return []
  return data.data.map((item) => ({
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
  // Impresiones que tiene la release de XMage del servidor (null: sin proxy, no se marca nada)
  const [onServer, setOnServer] = useState<Set<string> | null>(null)

  useEffect(() => {
    let cancelled = false
    setOnServer(null)
    void xmagePrintingsOf(cardName).then((list) => {
      if (cancelled || !list) return
      setOnServer(new Set(list.map((p) => `${p.setCode.toUpperCase()}|${p.cardNumber}`)))
    })
    return () => {
      cancelled = true
    }
  }, [cardName])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const url = `https://api.scryfall.com/cards/search?q=!%22${encodeURIComponent(cardName)}%22&unique=prints&order=released&dir=desc`

    scryfallFetch(url, { urgent: true })
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
  }, [cardName, t])

  return (
    <DialogShell
      labelledBy="printings-title"
      titleId="printings-title"
      size="lg"
      legacyBackdropClass="printings-backdrop"
      legacyPanelClass="printings-modal"
      kickerIcon="palette"
      kickerLabel={cardName}
      title={t('dialogs', 'card_printings_title')}
      topRight={(
        <CloseButton variant="plain" size="md" className="printings-close-btn" onClick={onClose} />
      )}
      onBackdropClick={onClose}
      onEscape={onClose}
    >
        <div className="printings-body">
          <CustomCardArtSection cardName={cardName} />

          {loading && (
            <div className="printings-status-box">
              <div className="printings-spinner" />
              <span>{t('common', 'loading')} {cardName}…</span>
            </div>
          )}

          {error && !loading && (
            <div className="printings-status-box error">
              <span><Icon name="alert" size={13} /> {error}</span>
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
                const unavailable = !!onServer && !onServer.has(`${p.set}|${p.collectorNumber}`)

                return (
                  <div
                    key={p.id}
                    className={`printing-card-item ${isSelected ? 'selected' : ''}${unavailable ? ' is-unavailable' : ''}`}
                    data-unavailable={unavailable || undefined}
                    title={unavailable ? t('decks', 'printing_not_on_server') : undefined}
                    onClick={() => {
                      // Impresión de Scryfall tal cual: la traducción a la que
                      // carga el servidor (PLST, promos) la hace el proxy.
                      onSelectPrinting(p.set, p.collectorNumber)
                      onClose()
                    }}
                  >
                    <div className="printing-img-wrap">
                      <img src={p.imageUrl ?? undefined} alt={`${cardName} (${p.set})`} loading="lazy" />
                      {isSelected && <div className="printing-selected-badge">✓ {t('common', 'done')}</div>}
                      {unavailable && <div className="printing-unavailable-badge">{t('decks', 'printing_not_on_server_short')}</div>}
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
    </DialogShell>
  )
}
