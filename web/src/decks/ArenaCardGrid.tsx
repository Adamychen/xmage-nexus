import { useRef, useEffect } from 'react'
import type { ScryfallSearchCard } from './scryfallSearch'
import { scryfallCardImage } from './scryfallSearch'
import { setFloatingCardDragImage } from './arenaDragHelpers'
import './ArenaCardGrid.css'

export function ArenaCardGrid({
  cards,
  loading,
  loadingMore = false,
  hasMore = false,
  error,
  totalCards,
  countMap,
  onAdd,
  onLoadMore,
  onHover,
  onLeave,
}: {
  cards: ScryfallSearchCard[]
  loading: boolean
  loadingMore?: boolean
  hasMore?: boolean
  error: string | null
  totalCards?: number
  countMap: Map<string, number>
  onAdd: (card: ScryfallSearchCard) => void
  onLoadMore?: () => void
  onHover?: (card: ScryfallSearchCard, rect: DOMRect) => void
  onLeave?: () => void
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || loading || loadingMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore?.()
        }
      },
      { rootMargin: '1000px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, onLoadMore])

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

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 2500) {
      if (hasMore && !loading && !loadingMore) {
        onLoadMore?.()
      }
    }
  }

  return (
    <div className="arena-card-grid-container search-panel">
      <div className="arena-card-grid-scroll" onScroll={handleScroll}>
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

        {/* Bottom Sentinel for IntersectionObserver */}
        <div ref={sentinelRef} style={{ gridColumn: '1 / -1', height: 1 }} />

        {loadingMore && (
          <div className="arena-grid-loading-more">
            <div className="arena-grid-spinner small" />
            <span>Descargando más cartas de Scryfall…</span>
          </div>
        )}

        {cards.length === 0 && !loading && (
          <div className="arena-grid-status-box">
            <span>No se encontraron cartas con esos filtros.</span>
            <small style={{ color: '#718096' }}>
              Prueba a buscar por nombre o cambiar los filtros de color y tipo.
            </small>
          </div>
        )}
      </div>

      {/* Persistent Footer count and loader */}
      <div className="arena-grid-footer">
        <div className="arena-footer-left">
          <span className="arena-grid-count">
            {cards.length.toLocaleString()} {totalCards ? `de ${totalCards.toLocaleString()}` : ''} cartas
          </span>
        </div>

        <div className="arena-footer-center">
          {loadingMore ? (
            <div className="arena-footer-loading">
              <div className="arena-grid-spinner small" />
              <span>Cargando cartas…</span>
            </div>
          ) : hasMore ? (
            <button
              type="button"
              className="arena-footer-load-btn"
              onClick={() => onLoadMore?.()}
              title="Cargar siguiente lote de cartas"
            >
              ⚡ Cargar más cartas (+175)
            </button>
          ) : cards.length > 0 ? (
            <span className="arena-footer-done">✓ Catálogo completo cargado</span>
          ) : null}
        </div>

        <div className="arena-footer-right">
          <span>Arrastra al mazo o haz clic para añadir</span>
        </div>
      </div>
    </div>
  )
}
