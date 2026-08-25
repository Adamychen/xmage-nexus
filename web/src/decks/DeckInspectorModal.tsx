import { useState } from 'react'
import type { MetaDeckItem } from './metaDeckCatalog'
import type { DeckV2 } from './types'
import { ArenaCardStrip } from './ArenaCardStrip'
import CurveChart from './CurveChart'
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
  const metaDesc = 'description' in deck ? (deck as MetaDeckItem).description : undefined
  const archetype = 'archetype' in deck ? (deck as MetaDeckItem).archetype : undefined
  const tier = 'tier' in deck ? (deck as MetaDeckItem).tier : undefined

  const mainTotal = deck.cards.reduce((s, c) => s + c.amount, 0)
  const sideTotal = deck.sideboard.reduce((s, c) => s + c.amount, 0)

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
              Mazo Principal ({mainTotal} cartas)
            </div>
            {deck.cards.map((c) => (
              <ArenaCardStrip
                key={`${c.setCode}:${c.cardNumber}:${c.cardName}`}
                card={c}
              />
            ))}

            {deck.sideboard.length > 0 && (
              <>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#a0aec0', textTransform: 'uppercase', marginTop: 12, marginBottom: 4 }}>
                  Banquillo (Sideboard: {sideTotal} cartas)
                </div>
                {deck.sideboard.map((c) => (
                  <ArenaCardStrip
                    key={`sb:${c.setCode}:${c.cardNumber}:${c.cardName}`}
                    card={c}
                    sideboard
                  />
                ))}
              </>
            )}
          </div>

          <div className="inspector-info-column">
            {metaDesc && (
              <div>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: '#718096' }}>
                  Estrategia
                </span>
                <p className="inspector-desc">{metaDesc}</p>
              </div>
            )}

            <div>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: '#718096' }}>
                Curva de Maná
              </span>
              <CurveChart cards={deck.cards} meta={new Map()} />
            </div>
          </div>
        </div>

        <footer className="deck-inspector-footer">
          <button type="button" className="inspector-edit-btn" onClick={() => onEdit(deck)}>
            ✏️ Clonar y Abrir en Deck Builder
          </button>

          <button type="button" className="inspector-copy-btn" onClick={handleCopy}>
            {copied ? '✓ ¡Copiado a Mis Mazos!' : '📋 Copiar a Mis Mazos'}
          </button>
        </footer>
      </div>
    </div>
  )
}
