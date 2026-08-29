import { useState } from 'react'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'
import type { ValidationIssue } from './formatRules'
import { ArenaCardStrip } from './ArenaCardStrip'
import './DeckListPanel.css'

function getCardKey(c: DeckCard): string {
  return `${c.setCode}:${c.cardNumber}:${c.cardName}`
}

function categorizeCard(typeLine?: string): string {
  if (!typeLine) return 'Otros'
  const t = typeLine.toLowerCase()
  if (t.includes('creature') || t.includes('criatura')) return 'Criaturas'
  if (t.includes('planeswalker')) return 'Planeswalkers'
  if (t.includes('instant') || t.includes('instantáneo')) return 'Instantáneos'
  if (t.includes('sorcery') || t.includes('conjuro')) return 'Conjuros'
  if (t.includes('enchantment') || t.includes('encantamiento')) return 'Encantamientos'
  if (t.includes('artifact') || t.includes('artefacto')) return 'Artefactos'
  if (t.includes('land') || t.includes('tierra')) return 'Tierras'
  return 'Otros'
}

export default function DeckListPanel({
  cards,
  sideboard,
  coverKey,
  isCommanderFormat,
  metaMap,
  cardIssues,
  layout = 'vertical',
  onInc,
  onDec,
  onRemove,
  onSetCover,
  onHover,
  onLeave,
  onChangePrinting,
  onDropCard,
  onDropFile,
}: {
  cards: DeckCard[]
  sideboard: DeckCard[]
  coverKey: string | null
  isCommanderFormat?: boolean
  metaMap: Map<string, CardStripMeta>
  cardIssues?: Map<string, ValidationIssue>
  layout?: 'vertical' | 'horizontal'
  onInc: (key: string) => void
  onDec: (key: string) => void
  onRemove: (key: string) => void
  onSetCover: (c: DeckCard) => void
  onHover?: (card: DeckCard, meta?: CardStripMeta, rect?: DOMRect) => void
  onLeave?: () => void
  onChangePrinting?: (c: DeckCard) => void
  onDropCard?: (cardData: any, target: 'main' | 'sideboard') => void
  onDropFile?: (f: File) => void
}) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (!isDragOver) setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    // Check if a file was dropped
    const file = e.dataTransfer.files?.[0]
    if (file && onDropFile) {
      onDropFile(file)
      return
    }

    // Check if card JSON was dropped
    const rawData = e.dataTransfer.getData('application/json')
    if (rawData && onDropCard) {
      try {
        const cardData = JSON.parse(rawData)
        onDropCard(cardData, 'main')
      } catch {}
    }
  }

  // Commander card identification (first card or cover card if commander format)
  const commanderCard = isCommanderFormat && cards.length > 0
    ? (coverKey ? cards.find((c) => getCardKey(c) === coverKey) ?? cards[0] : cards[0])
    : null

  const mainCardsWithoutCommander = commanderCard
    ? cards.filter((c) => getCardKey(c) !== getCardKey(commanderCard))
    : cards

  // Group main cards by category
  const categoriesOrder = ['Criaturas', 'Planeswalkers', 'Instantáneos', 'Conjuros', 'Artefactos', 'Encantamientos', 'Tierras', 'Otros']
  const groupedCards = new Map<string, DeckCard[]>()
  for (const cat of categoriesOrder) groupedCards.set(cat, [])

  for (const card of mainCardsWithoutCommander) {
    const meta = metaMap.get(`${card.setCode}/${card.cardNumber}`) ?? metaMap.get(card.cardName.toLowerCase())
    const cat = categorizeCard(meta?.typeLine)
    const list = groupedCards.get(cat) ?? groupedCards.get('Otros')!
    list.push(card)
  }

  // Total counts
  const mainTotal = cards.reduce((s, c) => s + c.amount, 0)
  const sideTotal = sideboard.reduce((s, c) => s + c.amount, 0)

  return (
    <div
      className={`arena-deck-list-container deck-list-panel ${isDragOver ? 'is-drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {layout === 'vertical' ? (
        <div className="arena-deck-list-scroll">
          {/* Drop indicator prompt */}
          {isDragOver && (
            <div className="arena-drop-target-hint">
              <span>✨</span> Soltar para añadir al mazo
            </div>
          )}

          {/* Commander Banner (if applicable) */}
          {commanderCard && (
            <div className="deck-category-section">
              <div className="deck-category-header">
                <span>Comandante</span>
                <span className="deck-category-count">1</span>
              </div>
              <ArenaCardStrip
                key={getCardKey(commanderCard)}
                card={commanderCard}
                meta={metaMap.get(`${commanderCard.setCode}/${commanderCard.cardNumber}`) ?? metaMap.get(commanderCard.cardName.toLowerCase())}
                isCommander
                isCover
                onInc={onInc}
                onDec={onDec}
                onRemove={onRemove}
                onSetCover={onSetCover}
                onHover={onHover}
                onLeave={onLeave}
                onChangePrinting={onChangePrinting}
              />
            </div>
          )}

          {/* Grouped Categories */}
          {categoriesOrder.map((cat) => {
            const list = groupedCards.get(cat) ?? []
            if (list.length === 0) return null
            const count = list.reduce((s, c) => s + c.amount, 0)

            return (
              <div key={cat} className="deck-category-section">
                <div className="deck-category-header">
                  <span>{cat}</span>
                  <span className="deck-category-count">{count}</span>
                </div>
                {list.map((card) => {
                  const k = getCardKey(card)
                  const meta = metaMap.get(`${card.setCode}/${card.cardNumber}`) ?? metaMap.get(card.cardName.toLowerCase())
                  const issue = cardIssues?.get(k)?.message ?? cardIssues?.get(card.cardName)?.message
                  return (
                    <ArenaCardStrip
                      key={k}
                      card={card}
                      meta={meta}
                      isCover={coverKey === k}
                      issue={issue}
                      onInc={onInc}
                      onDec={onDec}
                      onRemove={onRemove}
                      onSetCover={onSetCover}
                      onHover={onHover}
                      onLeave={onLeave}
                      onChangePrinting={onChangePrinting}
                    />
                  )
                })}
              </div>
            )
          })}

          {/* Empty State */}
          {mainTotal === 0 && (
            <div className="deck-list-empty-hint">
              <span className="empty-hint-icon">🃏</span>
              <span>El mazo está vacío.</span>
              <small>Haz clic en las cartas de la biblioteca o arrástralas aquí.</small>
            </div>
          )}

          {/* Sideboard Section */}
          {sideboard.length > 0 && (
            <div className="deck-category-section deck-sideboard-section">
              <div className="deck-category-header">
                <span>Banquillo (Sideboard)</span>
                <span className="deck-category-count">{sideTotal}/15</span>
              </div>
              {sideboard.map((card) => {
                const k = `sb:${getCardKey(card)}`
                const meta = metaMap.get(`${card.setCode}/${card.cardNumber}`) ?? metaMap.get(card.cardName.toLowerCase())
                const issue = cardIssues?.get(k)?.message ?? cardIssues?.get(card.cardName)?.message
                return (
                  <ArenaCardStrip
                    key={k}
                    card={card}
                    meta={meta}
                    sideboard
                    issue={issue}
                    onInc={onInc}
                    onDec={onDec}
                    onRemove={onRemove}
                    onHover={onHover}
                    onLeave={onLeave}
                    onChangePrinting={onChangePrinting}
                  />
                )
              })}
            </div>
          )}
        </div>
      ) : (
        /* Horizontal Mode (Columns by CMC) */
        <div className="arena-deck-cols-layout deck-cols">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((cmc) => {
            const colCards = cards.filter((c) => {
              const meta = metaMap.get(`${c.setCode}/${c.cardNumber}`) ?? metaMap.get(c.cardName.toLowerCase())
              const cardCmc = meta?.cmc ?? 0
              return cmc === 7 ? cardCmc >= 7 : cardCmc === cmc
            })
            const totalInCol = colCards.reduce((s, c) => s + c.amount, 0)
            if (colCards.length === 0) return null

            return (
              <div key={cmc} className="arena-deck-column deck-col">
                <div className="arena-deck-col-head deck-col-head">
                  <span className="deck-col-title">{cmc === 7 ? '7+' : `CMC ${cmc}`}</span>
                  <span className="deck-col-count">{totalInCol}</span>
                </div>
                <div className="deck-col-list">
                  {colCards.map((card) => {
                    const k = getCardKey(card)
                    const meta = metaMap.get(`${card.setCode}/${card.cardNumber}`) ?? metaMap.get(card.cardName.toLowerCase())
                    const issue = cardIssues?.get(k)?.message ?? cardIssues?.get(card.cardName)?.message
                    return (
                      <ArenaCardStrip
                        key={k}
                        card={card}
                        meta={meta}
                        isCover={coverKey === k}
                        issue={issue}
                        onInc={onInc}
                        onDec={onDec}
                        onRemove={onRemove}
                        onSetCover={onSetCover}
                        onHover={onHover}
                        onLeave={onLeave}
                        onChangePrinting={onChangePrinting}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
