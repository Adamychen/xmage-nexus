import { useState, useEffect } from 'react'
import type { MetaDeckItem } from './metaDeckCatalog'
import type { DeckV2 } from './types'
import { ArenaCardStrip, type CardStripMeta } from './ArenaCardStrip'
import CurveChart from './CurveChart'
import { useTranslation } from '../i18n'
import './DeckInspectorModal.css'

export function DeckInspectorModal({
  deck,
  onClose,
  onCopy,
  onEdit,
}: {
  deck: MetaDeckItem | DeckV2
  onClose: () => void
  onCopy: (d: MetaDeckItem | DeckV2) => void
  onEdit: (d: MetaDeckItem | DeckV2) => void
}) {
  const [copied, setCopied] = useState(false)
  const [metaMap, setMetaMap] = useState<Map<string, CardStripMeta>>(new Map())
  const metaDesc = 'description' in deck ? (deck as MetaDeckItem).description : undefined
  const archetype = 'archetype' in deck ? (deck as MetaDeckItem).archetype : undefined
  const tier = 'tier' in deck ? (deck as MetaDeckItem).tier : undefined

  const { t } = useTranslation()
  const mainTotal = deck.cards.reduce((s, c) => s + c.amount, 0)
  const sideTotal = deck.sideboard.reduce((s, c) => s + c.amount, 0)

  useEffect(() => {
    const all = [...deck.cards, ...deck.sideboard]
    for (const c of all) {
      const url = c.setCode && c.cardNumber && c.cardNumber !== '0'
        ? `https://api.scryfall.com/cards/${c.setCode}/${c.cardNumber}?format=json`
        : `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(c.cardName)}`

      fetch(url, { headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return
          const meta: CardStripMeta = {
            artCropUrl: data.image_uris?.art_crop ?? data.card_faces?.[0]?.image_uris?.art_crop ?? null,
            imageUrl: data.image_uris?.normal ?? data.card_faces?.[0]?.image_uris?.normal ?? null,
            backImageUrl: data.card_faces?.[1]?.image_uris?.normal ?? null,
            manaCost: data.mana_cost ?? data.card_faces?.[0]?.mana_cost ?? '',
            cmc: data.cmc ?? 0,
            typeLine: data.type_line ?? data.card_faces?.[0]?.type_line ?? '',
            colors: data.colors ?? data.color_identity ?? [],
            legalities: data.legalities,
          }
          setMetaMap((prev) => {
            const nxt = new Map(prev)
            nxt.set(`${c.setCode}/${c.cardNumber}`, meta)
            nxt.set(c.cardName.toLowerCase(), meta)
            return nxt
          })
        })
        .catch(() => {})
    }
  }, [deck.id])

  const handleCopy = () => {
    onCopy(deck)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="deck-inspector-backdrop" onClick={onClose}>
      <div className="deck-inspector-modal" onClick={(e) => e.stopPropagation()}>
        <header className="deck-inspector-head">
          <div className="deck-inspector-title-area">
            <h2 className="deck-inspector-name">{deck.name}</h2>
            <div className="deck-inspector-badges">
              <span className="inspector-format-badge">{deck.format}</span>
              {archetype && <span className="inspector-archetype-badge">{archetype}</span>}
              {tier && <span className="inspector-format-badge" style={{ borderColor: '#68d391', color: '#68d391' }}>{tier}</span>}
            </div>
          </div>
          <button type="button" className="inspector-close-btn" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="deck-inspector-body">
          <div className="inspector-cards-column">
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#a0aec0', textTransform: 'uppercase', marginBottom: 4 }}>
              {t('game', 'sideboard_main')} ({mainTotal} {t('decks', 'total_cards')})
            </div>
            {deck.cards.map((c) => {
              const meta = metaMap.get(`${c.setCode}/${c.cardNumber}`) ?? metaMap.get(c.cardName.toLowerCase())
              return (
                <ArenaCardStrip
                  key={`${c.setCode}:${c.cardNumber}:${c.cardName}`}
                  card={c}
                  meta={meta}
                />
              )
            })}

            {deck.sideboard.length > 0 && (
              <>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#a0aec0', textTransform: 'uppercase', marginTop: 12, marginBottom: 4 }}>
                  {t('decks', 'sideboard')} (Sideboard: {sideTotal} {t('decks', 'total_cards')})
                </div>
                {deck.sideboard.map((c) => {
                  const meta = metaMap.get(`${c.setCode}/${c.cardNumber}`) ?? metaMap.get(c.cardName.toLowerCase())
                  return (
                    <ArenaCardStrip
                      key={`sb:${c.setCode}:${c.cardNumber}:${c.cardName}`}
                      card={c}
                      meta={meta}
                      sideboard
                    />
                  )
                })}
              </>
            )}
          </div>

          <div className="inspector-info-column">
            {metaDesc && (
              <div>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: '#718096' }}>
                  {t('common', 'status')}
                </span>
                <p className="inspector-desc">{metaDesc}</p>
              </div>
            )}

            <div>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: '#718096' }}>
                {t('decks', 'mana_curve')}
              </span>
              <CurveChart cards={deck.cards} meta={metaMap} />
            </div>
          </div>
        </div>

        <footer className="deck-inspector-footer">
          <button type="button" className="inspector-edit-btn" onClick={() => onEdit(deck)}>
            ✏️ {t('decks', 'deck_builder')}
          </button>

          <button type="button" className="inspector-copy-btn" onClick={handleCopy}>
            {copied ? `✓ ${t('common', 'copied')}` : `📋 ${t('common', 'copy')}`}
          </button>
        </footer>
      </div>
    </div>
  )
}
