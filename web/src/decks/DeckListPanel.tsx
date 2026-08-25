import type { DeckCard } from '../lobby/decks'
import './DeckListPanel.css'

function GroupColumn({ title, cards, onInc, onDec, onRemove, onSetCover, coverKey }: {
  title: string, cards: DeckCard[], onInc: (k: string) => void, onDec: (k: string) => void, onRemove: (k: string) => void, onSetCover: (c: DeckCard) => void, coverKey: string | null
}) {
  if (cards.length === 0) return null
  const total = cards.reduce((s, c) => s + c.amount, 0)
  return (
    <div className="deck-col">
      <div className="deck-col-head"><span className="deck-col-title">{title}</span><span className="deck-col-count">{total}</span></div>
      <div className="deck-col-list">
        {cards.map((c) => {
          const k = `${c.setCode}:${c.cardNumber}:${c.cardName}`
          const isCover = coverKey === k
          return (
            <div key={k} className={`deck-row ${isCover ? 'is-cover' : ''}`}>
              <span className="deck-row-amount">{c.amount}x</span>
              <span className="deck-row-name" title={`${c.cardName} (${c.setCode} ${c.cardNumber})`}>{c.cardName}</span>
              <span className="deck-row-controls">
                <button type="button" className="row-btn" onClick={() => onDec(k)} title="Quitar 1">−</button>
                <button type="button" className="row-btn" onClick={() => onInc(k)} title="Añadir 1">+</button>
                <button type="button" className="row-btn danger" onClick={() => onRemove(k)} title="Quitar carta">×</button>
              </span>
              <button type="button" className={`row-cover-btn ${isCover ? 'active' : ''}`} onClick={() => onSetCover(c)} title={isCover ? 'Portada actual' : 'Usar como portada'}>{isCover ? '★' : '☆'}</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function DeckListPanel({
  mainByCmc,
  sideboard,
  coverKey,
  onInc,
  onDec,
  onRemove,
  onSetCover,
  onDropFile,
}: {
  mainByCmc: Map<number, DeckCard[]>
  sideboard: DeckCard[]
  coverKey: string | null
  onInc: (k: string) => void
  onDec: (k: string) => void
  onRemove: (k: string) => void
  onSetCover: (c: DeckCard) => void
  onDropFile?: (f: File) => void
}) {
  return (
    <div className="deck-list-panel" onDragOver={(e) => e.preventDefault()} onDrop={async (e) => {
      e.preventDefault()
      const f = e.dataTransfer.files?.[0]
      if (f && onDropFile) onDropFile(f)
    }}>
      <div className="deck-cols">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((cmc) => (
          <GroupColumn key={cmc} title={cmc === 7 ? '7+' : String(cmc)} cards={mainByCmc.get(cmc) ?? []} onInc={onInc} onDec={onDec} onRemove={onRemove} onSetCover={onSetCover} coverKey={coverKey} />
        ))}
      </div>
      {sideboard.length > 0 && (
        <div className="deck-sideboard">
          <div className="deck-sideboard-head">Sideboard — {sideboard.reduce((s, c) => s + c.amount, 0)}/15</div>
          <div className="deck-sideboard-list">
            {sideboard.map((c) => {
              const k = `sb:${c.setCode}:${c.cardNumber}:${c.cardName}`
              return (
                <div key={k} className="deck-row">
                  <span className="deck-row-amount">{c.amount}x</span>
                  <span className="deck-row-name">{c.cardName}</span>
                  <span className="deck-row-controls">
                    <button type="button" className="row-btn" onClick={() => onDec(k)}>−</button>
                    <button type="button" className="row-btn" onClick={() => onInc(k)}>+</button>
                    <button type="button" className="row-btn danger" onClick={() => onRemove(k)}>×</button>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
