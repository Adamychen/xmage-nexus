import { useEffect, useState } from 'react'
import type { DeckV2 } from './types'
import { deckMainCount } from './types'
import { validateDeckForFormat, FORMAT_CONFIGS } from './formatRules'
import { useTranslation } from '../i18n'
import './DeckBox.css'

function useDeckCoverUrl(deck: DeckV2): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const cover = deck.coverCard ?? deck.cards[0]
    if (!cover) { setUrl(null); return }
    const set = cover.setCode
    const num = cover.cardNumber
    if (!set || !num || num === '0') {
      const name = cover.cardName
      if (!name) { setUrl(null); return }
      let cancelled = false
      fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`, { headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (cancelled || !data) return
          const u = data.image_uris?.art_crop ?? data.image_uris?.normal ?? data.card_faces?.[0]?.image_uris?.art_crop ?? null
          setUrl(u)
        })
        .catch(() => {})
      return () => { cancelled = true }
    }
    let cancelled = false
    fetch(`https://api.scryfall.com/cards/${set}/${num}?format=json`, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) {
          if (!cancelled && cover.cardName) {
            return fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cover.cardName)}`, { headers: { Accept: 'application/json' } })
              .then((rr) => (rr.ok ? rr.json() : null))
              .then((d2) => {
                if (cancelled || !d2) return
                setUrl(d2.image_uris?.art_crop ?? d2.image_uris?.normal ?? null)
              })
          }
          return
        }
        const u = data.image_uris?.art_crop ?? data.image_uris?.normal ?? data.card_faces?.[0]?.image_uris?.art_crop ?? null
        if (!cancelled) setUrl(u)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [deck.coverCard, deck.cards])
  return url
}

export function DeckBox({ deck, selected, onSelect }: { deck: DeckV2; selected?: boolean; onSelect?: () => void }) {
  const { t } = useTranslation()
  const coverUrl = useDeckCoverUrl(deck)
  const total = deckMainCount(deck)
  const colors = deck.colors
  const formatReport = validateDeckForFormat(deck)
  const hasErrors = formatReport.issues.some((i) => i.severity === 'error')
  const minRequired = FORMAT_CONFIGS[deck.format]?.minMain ?? 60
  const isValid = !hasErrors && total >= minRequired
  const issueTooltip = formatReport.issues.map((i) => `• ${i.message}`).join('\n')

  return (
    <div className={`deck-box ${selected ? 'selected' : ''}`} onClick={onSelect} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onSelect?.()}>
      <div className="deck-box-art">
        {coverUrl ? <img src={coverUrl} alt={deck.name} loading="lazy" /> : <div className="deck-box-art-fallback">{deck.name.slice(0, 2).toUpperCase()}</div>}
        <div className="deck-box-art-scrim" />
        <div className="deck-box-format-badge" title={issueTooltip || `${deck.format} ${t('decks', 'format_legal')}`}>
          {isValid ? (
            <span className="format-badge-valid">✓ {deck.format}</span>
          ) : (
            <span className="format-badge-invalid">⚠️ {total}/{minRequired}</span>
          )}
        </div>
      </div>
      <div className="deck-box-footer">
        <span className="deck-box-name" title={deck.name}>{deck.name}</span>
        {colors.length > 0 && (
          <span className="deck-box-colors">
            {colors.map((c) => (
              <span key={c} className={`mana-pip pip-${c.toLowerCase()}`}>{c}</span>
            ))}
          </span>
        )}
        {colors.length === 0 && <span className="deck-box-colors"><span className="mana-pip pip-c">C</span></span>}
      </div>
      <div className="deck-box-meta">
        <span className="deck-box-count">{total} {t('decks', 'total_cards')}</span>
        {deck.favorite && <span className="deck-box-fav">★</span>}
        {deck.source === 'precon' && <span className="deck-box-precon">Precon</span>}
      </div>
      {selected && <div className="deck-box-ring" />}
    </div>
  )
}

export function DeckBoxCreate({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="deck-box deck-box-create" onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      <div className="deck-box-create-inner">
        <span className="deck-box-create-plus">+</span>
        <span className="deck-box-create-label">{t('decks', 'box_create')}</span>
      </div>
    </div>
  )
}
