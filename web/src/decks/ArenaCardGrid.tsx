import type { ScryfallSearchCard } from './scryfallSearch'
import { scryfallCardImage } from './scryfallSearch'
import { setFloatingCardDragImage } from './arenaDragHelpers'
import './ArenaCardGrid.css'

export function ArenaCardGrid({
  cards,
  loading,
  error,
  totalCards,
  countMap,
  onAdd,
  onHover,
  onLeave,
}: {
  cards: ScryfallSearchCard[]
  loading: boolean
  error: string | null
  totalCards?: number
  countMap: Map<string, number>
  onAdd: (card: ScryfallSearchCard) => void
  onHover?: (card: ScryfallSearchCard, rect: DOMRect) => void
  onLeave?: () => void
}) {
  const getDeckCount = (card: ScryfallSearchCard): number => {
    const keySetNum = `${card.set.toUpperCase()}/${card.collector_number}`
    const keyName = card.name.toLowerCase()
    return countMap.get(keySetNum) ?? countMap.get(keyName) ?? 0
  }

  const handleDragStart = (e: React.DragEvent, card: ScryfallSearchCard) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      cardName: card.name,
      setCode: card.set.toUpperCase(),
      cardNumber: card.collector_number,
      manaCost: card.mana_cost,
      cmc: card.cmc,
      typeLine: card.type_line,
      colors: card.colors || card.color_identity || [],
      source: 'search',
    }))
    e.dataTransfer.effectAllowed = 'copy'

    const imgUrl = scryfallCardImage(card)
    setFloatingCardDragImage(e, imgUrl, card.name)
  }

  if (loading && cards.length === 0) {
    return (
      <div className="arena-card-grid-container">
        <div className="arena-grid-status-box">
          <div className="arena-grid-spinner" />
          <span>Buscando cartas en la biblioteca…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="arena-card-grid-container">
        <div className="arena-grid-status-box" style={{ color: '#fc8181' }}>
          <span>⚠️ {error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="arena-card-grid-container search-panel">
      <div className="arena-card-grid-scroll">
        {cards.map((card) => {
          const imgUrl = scryfallCardImage(card)
          const count = getDeckCount(card)
          const maxPips = 4

          return (
            <div
              key={card.id}
              className="arena-grid-card search-card"
              draggable
              onDragStart={(e) => handleDragStart(e, card)}
              onClick={() => onAdd(card)}
              onMouseEnter={(e) => onHover?.(card, e.currentTarget.getBoundingClientRect())}
              onMouseLeave={onLeave}
              title={`${card.name} — Clic o arrastra para añadir al mazo`}
            >
              {/* Copy diamond indicators (e.g. 1/4, 2/4) */}
              <div className="arena-card-pips">
                {Array.from({ length: maxPips }).map((_, i) => (
                  <div
                    key={i}
                    className={`card-pip-diamond ${i < count ? 'filled' : ''}`}
                  />
                ))}
              </div>

              {/* Card Image */}
              <div className="arena-grid-card-img-wrapper">
                {imgUrl ? (
                  <img
                    src={imgUrl}
                    alt={card.name}
                    className="arena-grid-card-img"
                    loading="lazy"
                  />
                ) : (
                  <div className="arena-grid-card-fallback">
                    <div className="arena-grid-card-fallback-name">{card.name}</div>
                    <div>{card.type_line}</div>
                  </div>
                )}
                <div className="arena-grid-card-overlay">
                  <span className="arena-add-badge search-card-add">+ Añadir</span>
                </div>
              </div>
            </div>
          )
        })}

        {cards.length === 0 && !loading && (
          <div className="arena-grid-status-box">
            <span>No se encontraron cartas con esos filtros.</span>
            <small style={{ color: '#718096' }}>
              Prueba a buscar por nombre o cambiar los filtros de color y tipo.
            </small>
          </div>
        )}
      </div>

      {/* Footer count indicator */}
      <div className="arena-grid-footer">
        <span className="arena-grid-count">
          {totalCards ?? cards.length} cartas disponibles
        </span>
        <span>Arrastra cartas al mazo de la derecha o haz clic para añadir</span>
      </div>
    </div>
  )
}
