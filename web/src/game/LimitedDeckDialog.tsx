import { useStore, setState } from '../state/store'
import CardSlot from '../board/CardSlot'

export default function LimitedDeckDialog() {
  const viewer = useStore((s) => s.viewer)
  if (!viewer) return null

  const close = () => setState({ viewer: null })

  return (
    <div className="feedback-backdrop" role="presentation" onClick={close}>
      <section
        className="feedback-dialog card-grid-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="viewer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="card-grid-header">
          <h2 id="viewer-title">{viewer.title}</h2>
          <span className="card-grid-count-badge">
            {viewer.cards.length} carta{viewer.cards.length !== 1 ? 's' : ''}
          </span>
        </header>
        <div className="card-grid-scroll-area">
          <div className="card-grid">
            {viewer.cards.map((card) => (
              <div key={card.id} className="card-grid-cell">
                <CardSlot card={card as never} cardId={card.id} />
                <span className="card-grid-label">{card.displayName ?? card.name}</span>
              </div>
            ))}
          </div>
          {viewer.cards.length === 0 && (
            <div className="card-grid-empty">
              <p>No hay cartas que mostrar</p>
            </div>
          )}
        </div>
        <footer className="card-grid-actions">
          <button onClick={close}>Cerrar</button>
        </footer>
      </section>
    </div>
  )
}
