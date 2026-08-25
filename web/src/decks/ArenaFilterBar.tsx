import { ManaPip } from './ArenaManaSymbols'
import './ArenaFilterBar.css'

const COLORS = ['W', 'U', 'B', 'R', 'G', 'C'] as const
const TYPES = ['Creature', 'Instant', 'Sorcery', 'Planeswalker', 'Artifact', 'Enchantment', 'Land'] as const

export function ArenaFilterBar({
  query,
  onQueryChange,
  colorFilter,
  onToggleColor,
  cmcFilter,
  onCmcChange,
  typeFilter,
  onTypeChange,
  onReset,
  loading = false,
}: {
  query: string
  onQueryChange: (q: string) => void
  colorFilter: Set<string>
  onToggleColor: (color: string) => void
  cmcFilter: number | null
  onCmcChange: (cmc: number | null) => void
  typeFilter: string | null
  onTypeChange: (type: string | null) => void
  onReset: () => void
  loading?: boolean
}) {
  const hasActiveFilters = query.trim() !== '' || colorFilter.size > 0 || cmcFilter !== null || typeFilter !== null

  return (
    <div className="arena-filter-bar">
      {/* Main Top Row: Search and Mana Color Orbs */}
      <div className="filter-bar-top">
        <div className="arena-search-box">
          <span className="arena-search-icon">🔍</span>
          <input
            className="arena-search-input search-input"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Buscar cartas..."
          />
          {loading && <div className="arena-grid-spinner small" style={{ marginRight: 6 }} />}
          {query && !loading && (
            <button
              type="button"
              className="arena-search-clear"
              onClick={() => onQueryChange('')}
              title="Limpiar búsqueda"
            >
              ×
            </button>
          )}
        </div>

        {/* Mana Color Orbs */}
        <div className="arena-mana-orbs">
          {COLORS.map((c) => {
            const active = colorFilter.has(c)
            return (
              <button
                key={c}
                type="button"
                className={`mana-orb-btn orb-${c.toLowerCase()} ${active ? 'active' : ''}`}
                onClick={() => onToggleColor(c)}
                title={`Filtrar por maná ${c}`}
              >
                <ManaPip symbol={c} size={20} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Secondary Row: Types, CMC and Reset */}
      <div className="filter-bar-bottom">
        {/* CMC chips */}
        <div className="arena-filter-chips">
          <span className="arena-chip-label">CMC</span>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              type="button"
              className={`arena-cmc-btn cmc-chip ${cmcFilter === n ? 'active' : ''}`}
              onClick={() => onCmcChange(cmcFilter === n ? null : n)}
            >
              {n === 7 ? '7+' : n}
            </button>
          ))}
        </div>

        {/* Type chips */}
        <div className="arena-filter-chips">
          <span className="arena-chip-label">Tipo</span>
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={`arena-type-btn ${typeFilter === t ? 'active' : ''}`}
              onClick={() => onTypeChange(typeFilter === t ? null : t)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Reset filter button */}
        {hasActiveFilters && (
          <button type="button" className="filter-reset-btn" onClick={onReset}>
            Resetear filtros
          </button>
        )}
      </div>
    </div>
  )
}
