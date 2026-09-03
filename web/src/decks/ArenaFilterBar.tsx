import { useState, useRef, useEffect } from 'react'
import { ManaPip } from './ArenaManaSymbols'
import { useTranslation, type TranslationSchema } from '../i18n'
import './ArenaFilterBar.css'

const COLORS = ['W', 'U', 'B', 'R', 'G', 'C'] as const
const TYPES = ['Creature', 'Instant', 'Sorcery', 'Planeswalker', 'Artifact', 'Enchantment', 'Land'] as const

const TYPE_LABEL_KEYS: Record<(typeof TYPES)[number], keyof TranslationSchema['game']> = {
  Creature: 'type_creature',
  Instant: 'type_instant',
  Sorcery: 'type_sorcery',
  Planeswalker: 'type_planeswalker',
  Artifact: 'type_artifact',
  Enchantment: 'type_enchantment',
  Land: 'type_land',
}

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
  searchLang = 'any',
  onSearchLangChange,
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
  searchLang?: string
  onSearchLangChange?: (lang: string) => void
  loading?: boolean
}) {
  const { t, cardLanguages } = useTranslation()
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const langMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false)
      }
    }
    if (langMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [langMenuOpen])

  const allLangOptions = [
    { code: 'any', name: t('common', 'all'), flag: '🌐' },
    ...cardLanguages,
  ]

  const activeLangOption = allLangOptions.find((l) => l.code === searchLang) ?? allLangOptions[0]
  const hasActiveFilters = query.trim() !== '' || colorFilter.size > 0 || cmcFilter !== null || typeFilter !== null

  return (
    <div className="arena-filter-bar">
      {/* Main Top Row: Search, Language selector and Mana Color Orbs */}
      <div className="filter-bar-top">
        <div className="arena-search-box">
          <span className="arena-search-icon">🔍</span>
          <input
            className="arena-search-input search-input"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t('common', 'search')}
          />
          {loading && <div className="arena-grid-spinner small" style={{ marginRight: 6 }} />}
          {query && !loading && (
            <button
              type="button"
              className="arena-search-clear"
              onClick={() => onQueryChange('')}
              title={t('common', 'clear')}
            >
              ×
            </button>
          )}
        </div>

        {/* Language selector dropdown */}
        {onSearchLangChange && (
          <div className="arena-lang-select-wrap" ref={langMenuRef}>
            <button
              type="button"
              className="arena-lang-btn"
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              title={t('common', 'card_language')}
              aria-label={t('common', 'card_language')}
            >
              <span className="lang-flag">{activeLangOption.flag}</span>
              <span className="lang-code">{activeLangOption.code.toUpperCase()}</span>
              <span className="lang-arrow">▾</span>
            </button>
            {langMenuOpen && (
              <div className="arena-lang-dropdown" role="menu">
                {allLangOptions.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    className={`arena-lang-item ${l.code === searchLang ? 'selected' : ''}`}
                    onClick={() => {
                      onSearchLangChange(l.code)
                      setLangMenuOpen(false)
                    }}
                  >
                    <span>{l.flag}</span>
                    <span>{l.name}</span>
                    {l.code === searchLang && <span style={{ marginLeft: 'auto' }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

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
                title={`${t('decks', 'filter_cmc')} ${c}`}
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
          <span className="arena-chip-label">{t('decks', 'filter_cmc')}</span>
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
          <span className="arena-chip-label">{t('decks', 'filter_type')}</span>
          {TYPES.map((tKey) => (
            <button
              key={tKey}
              type="button"
              className={`arena-type-btn ${typeFilter === tKey ? 'active' : ''}`}
              onClick={() => onTypeChange(typeFilter === tKey ? null : tKey)}
            >
              {t('game', TYPE_LABEL_KEYS[tKey])}
            </button>
          ))}
        </div>

        {/* Reset filter button */}
        {hasActiveFilters && (
          <button type="button" className="filter-reset-btn" onClick={onReset}>
            {t('common', 'clear')}
          </button>
        )}
      </div>
    </div>
  )
}
