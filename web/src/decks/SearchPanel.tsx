import { useState } from 'react'
import { useScryfallSearch, scryfallCardImage } from './scryfallSearch'
import type { ScryfallSearchCard } from './scryfallSearch'
import './SearchPanel.css'

export default function SearchPanel({ onAdd }: { onAdd: (card: ScryfallSearchCard) => void }) {
  const [query, setQuery] = useState('t:creature')
  const [cmcFilter, setCmcFilter] = useState<number | null>(null)
  const [colorFilter, setColorFilter] = useState<Set<string>>(new Set())
  const { result, loading, error } = useScryfallSearch(query)

  const toggleColor = (c: string) => {
    const next = new Set(colorFilter)
    if (next.has(c)) next.delete(c); else next.add(c)
    setColorFilter(next)
  }

  let cards = result?.data ?? []
  if (cmcFilter !== null) cards = cards.filter((c) => (cmcFilter === 7 ? c.cmc >= 7 : c.cmc === cmcFilter))
  if (colorFilter.size > 0) {
    cards = cards.filter((c) => [...colorFilter].every((col) => c.color_identity.includes(col)))
  }

  return (
    <div className="search-panel">
      <div className="search-panel-head">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder='Buscar: t:creature c:red cmc<=3 o:"haste"' className="search-input" />
        <div className="search-chips">
          <span className="search-chip-label">CMC</span>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button key={n} type="button" className={`cmc-chip ${cmcFilter === n ? 'active' : ''}`} onClick={() => setCmcFilter(cmcFilter === n ? null : n)}>{n === 7 ? '7+' : n}</button>
          ))}
          <span className="search-chip-sep" />
          {(['W', 'U', 'B', 'R', 'G'] as const).map((c) => (
            <button key={c} type="button" className={`mana-filter-btn ${colorFilter.has(c) ? 'active' : ''} pip-${c.toLowerCase()}`} onClick={() => toggleColor(c)}>{c}</button>
          ))}
        </div>
      </div>
      {loading && <div className="search-status">Buscando en Scryfall…</div>}
      {error && <div className="search-status error">{error}</div>}
      {result && <div className="search-status muted">{result.total_cards ?? cards.length} resultados {result.has_more ? '· página 1' : ''}</div>}
      <div className="search-grid">
        {cards.map((card) => (
          <div key={card.id} className="search-card" onClick={() => onAdd(card)} title={`${card.name} — clic para añadir`}>
            <img src={scryfallCardImage(card) ?? ''} alt={card.name} loading="lazy" />
            <span className="search-card-name">{card.name}</span>
            <span className="search-card-add">+ Añadir</span>
          </div>
        ))}
        {cards.length === 0 && !loading && <div className="search-empty">Sin resultados. Prueba <code>t:instant c:blue</code> o <code>o:flying cmc=2</code>.</div>}
      </div>
    </div>
  )
}
