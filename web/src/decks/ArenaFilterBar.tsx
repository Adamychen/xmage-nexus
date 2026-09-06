import { useState, useRef, useEffect } from 'react'
import { ManaPip } from './ArenaManaSymbols'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import type { Rarity, StatFilter, StatOp } from './filterQuery'
import type { ScryfallSortDir, ScryfallSortOrder } from './scryfallSearch'
import './ArenaFilterBar.css'

const COLORS = ['W', 'U', 'B', 'R', 'G', 'C'] as const
const TYPES = ['Creature', 'Instant', 'Sorcery', 'Planeswalker', 'Artifact', 'Enchantment', 'Land', 'Battle'] as const
const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'mythic']
const RARITY_LABEL: Record<Rarity, string> = { common: 'C', uncommon: 'U', rare: 'R', mythic: 'M' }
const KEYWORDS_PRIMARY = ['Flying', 'Haste', 'Trample', 'Deathtouch', 'Lifelink', 'Vigilance', 'Hexproof', 'Menace', 'Reach', 'First Strike', 'Double Strike', 'Ward'] as const
const KEYWORDS_EXTRA = ['Flash', 'Defender', 'Indestructible', 'Prowess', 'Toxic', 'Backup', 'Convoke', 'Delve', 'Evolve', 'Cascade', 'Kicker', 'Cycling'] as const
const QUICK_SETS = ['mh3', 'blb', 'dsk', 'otj', 'mkm', 'lci', 'woe', 'one'] as const
const SORT_ORDERS: ScryfallSortOrder[] = ['cmc', 'name', 'rarity', 'color', 'edhrec', 'released']
const SORT_LABEL_KEYS: Record<ScryfallSortOrder, keyof import('../i18n').TranslationSchema['decks']> = {
  cmc: 'sort_cmc',
  name: 'sort_name',
  rarity: 'sort_rarity',
  color: 'sort_color',
  edhrec: 'sort_edhrec',
  released: 'sort_released',
}

const TYPE_LABEL_KEYS: Record<(typeof TYPES)[number], keyof import('../i18n').TranslationSchema['game']> = {
  Creature: 'type_creature',
  Instant: 'type_instant',
  Sorcery: 'type_sorcery',
  Planeswalker: 'type_planeswalker',
  Artifact: 'type_artifact',
  Enchantment: 'type_enchantment',
  Land: 'type_land',
  Battle: 'type_battle',
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
  rarityFilter,
  onToggleRarity,
  keywordFilter,
  onToggleKeyword,
  powerFilter,
  onPowerChange,
  toughnessFilter,
  onToughnessChange,
  setFilter,
  onSetChange,
  onReset,
  searchLang = 'any',
  onSearchLangChange,
  loading = false,
  sortOrder,
  onSortOrderChange,
  sortDir = 'asc',
  onSortDirChange,
  gridSize,
  onGridSizeChange,
}: {
  query: string
  onQueryChange: (q: string) => void
  colorFilter: Set<string>
  onToggleColor: (color: string) => void
  cmcFilter: number | null
  onCmcChange: (cmc: number | null) => void
  typeFilter: string | null
  onTypeChange: (type: string | null) => void
  rarityFilter: Set<Rarity>
  onToggleRarity: (r: Rarity) => void
  keywordFilter: Set<string>
  onToggleKeyword: (kw: string) => void
  powerFilter: StatFilter | null
  onPowerChange: (f: StatFilter | null) => void
  toughnessFilter: StatFilter | null
  onToughnessChange: (f: StatFilter | null) => void
  setFilter: string | null
  onSetChange: (s: string | null) => void
  onReset: () => void
  searchLang?: string
  onSearchLangChange?: (lang: string) => void
  loading?: boolean
  sortOrder?: ScryfallSortOrder
  onSortOrderChange?: (order: ScryfallSortOrder) => void
  sortDir?: ScryfallSortDir
  onSortDirChange?: (dir: ScryfallSortDir) => void
  gridSize?: number
  onGridSizeChange?: (size: number) => void
}) {
  const { t, cardLanguages } = useTranslation()
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [moreKeywords, setMoreKeywords] = useState(false)
  const [setInput, setSetInput] = useState(setFilter ?? '')
  const langMenuRef = useRef<HTMLDivElement>(null)
  const helpRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setSetInput(setFilter ?? '') }, [setFilter])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) setLangMenuOpen(false)
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setHelpOpen(false)
    }
    if (langMenuOpen || helpOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [langMenuOpen, helpOpen])

  const allLangOptions = [
    { code: 'any', name: t('common', 'all'), flag: '🌐' },
    ...cardLanguages,
  ]
  const activeLangOption = allLangOptions.find((l) => l.code === searchLang) ?? allLangOptions[0]
  const hasActiveFilters =
    query.trim() !== '' ||
    colorFilter.size > 0 ||
    cmcFilter !== null ||
    typeFilter !== null ||
    rarityFilter.size > 0 ||
    keywordFilter.size > 0 ||
    powerFilter !== null ||
    toughnessFilter !== null ||
    (setFilter !== null && setFilter.trim() !== '')

  const handleSetSubmit = () => {
    const v = setInput.trim().toLowerCase()
    onSetChange(v ? v : null)
  }

  return (
    <div className="arena-filter-bar">
      <div className="filter-bar-top">
        <div className="arena-search-box">
          <span className="arena-search-icon"><Icon name="search" size={14} /></span>
          <input
            className="arena-search-input search-input"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t('decks', 'filter_search_placeholder')}
            title={t('decks', 'filter_search_placeholder')}
          />
          {loading && <div className="arena-grid-spinner small" style={{ marginRight: 6 }} />}
          {query && !loading && (
            <button type="button" className="arena-search-clear" onClick={() => onQueryChange('')} title={t('common', 'clear')}>
              ×
            </button>
          )}
          <div className="arena-search-help-wrap" ref={helpRef}>
            <button
              type="button"
              className="arena-search-help-btn"
              onClick={() => setHelpOpen((v) => !v)}
              title="Scryfall syntax help"
              aria-label="Search help"
            >
              ?
            </button>
            {helpOpen && (
              <div className="arena-search-help-popover" role="dialog">
                <div className="help-popover-title">Scryfall syntax</div>
                <div className="help-popover-examples">
                  <code>t:creature</code> <code>c:red</code> <code>cmc&lt;=3</code> <code>o:"haste"</code> <code>pow&gt;3</code> <code>rarity:mythic</code> <code>set:mh3</code> <code>f:standard</code>
                </div>
                <div className="help-popover-hint">
                  e.g. <code>haste</code> + chips · O escribe sintaxis completa.
                </div>
                <a href="https://scryfall.com/docs/syntax" target="_blank" rel="noopener noreferrer" className="help-popover-link">
                  scryfall.com/docs/syntax ↗
                </a>
              </div>
            )}
          </div>
        </div>

        {onSearchLangChange && (
          <div className="arena-lang-select-wrap" ref={langMenuRef}>
            <button type="button" className="arena-lang-btn" onClick={() => setLangMenuOpen(!langMenuOpen)} title={t('common', 'card_language')} aria-label={t('common', 'card_language')}>
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

      <div className="filter-bar-bottom">
        <div className="arena-filter-chips">
          <span className="arena-chip-label">{t('decks', 'filter_cmc')}</span>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button key={n} type="button" className={`arena-cmc-btn cmc-chip ${cmcFilter === n ? 'active' : ''}`} onClick={() => onCmcChange(cmcFilter === n ? null : n)}>
              {n === 7 ? '7+' : n}
            </button>
          ))}
        </div>

        <div className="arena-filter-chips">
          <span className="arena-chip-label">{t('decks', 'filter_type')}</span>
          {TYPES.map((tKey) => (
            <button key={tKey} type="button" className={`arena-type-btn ${typeFilter === tKey ? 'active' : ''}`} onClick={() => onTypeChange(typeFilter === tKey ? null : tKey)}>
              {t('game', TYPE_LABEL_KEYS[tKey])}
            </button>
          ))}
        </div>

        <button type="button" className={`filter-advanced-toggle ${advancedOpen ? 'open' : ''}`} onClick={() => setAdvancedOpen((v) => !v)} aria-expanded={advancedOpen}>
          {t('decks', 'filter_advanced')} {advancedOpen ? '▴' : '▾'}
        </button>

        {onSortOrderChange && sortOrder && (
          <div className="arena-sort-wrap">
            <span className="arena-chip-label">{t('decks', 'sort_by')}</span>
            <select
              className="arena-sort-select"
              value={sortOrder}
              onChange={(e) => onSortOrderChange(e.target.value as ScryfallSortOrder)}
              aria-label={t('decks', 'sort_by')}
            >
              {SORT_ORDERS.map((o) => (
                <option key={o} value={o}>{t('decks', SORT_LABEL_KEYS[o])}</option>
              ))}
            </select>
            {onSortDirChange && (
              <button
                type="button"
                className="arena-sort-dir-btn"
                onClick={() => onSortDirChange(sortDir === 'desc' ? 'asc' : 'desc')}
                title={sortDir === 'desc' ? t('decks', 'sort_desc') : t('decks', 'sort_asc')}
                aria-label={sortDir === 'desc' ? t('decks', 'sort_desc') : t('decks', 'sort_asc')}
              >
                {sortDir === 'desc' ? '↓' : '↑'}
              </button>
            )}
          </div>
        )}

        {onGridSizeChange && gridSize !== undefined && (
          <div className="arena-sort-wrap">
            <span className="arena-chip-label">{t('decks', 'grid_size')}</span>
            <input
              type="range"
              className="arena-grid-size-slider"
              min={0}
              max={100}
              step={5}
              value={gridSize}
              onChange={(e) => onGridSizeChange(Number(e.target.value))}
              aria-label={t('decks', 'grid_size')}
            />
          </div>
        )}

        {hasActiveFilters && (
          <button type="button" className="filter-reset-btn" onClick={onReset}>
            {t('common', 'clear')}
          </button>
        )}
      </div>

      {advancedOpen && (
        <div className="filter-advanced-panel">
          <div className="adv-row">
            <span className="arena-chip-label">{t('decks', 'filter_rarity')}</span>
            <div className="arena-filter-chips">
              {RARITIES.map((r) => (
                <button key={r} type="button" className={`rarity-chip rarity-${r} ${rarityFilter.has(r) ? 'active' : ''}`} onClick={() => onToggleRarity(r)} title={r}>
                  {RARITY_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          <div className="adv-row adv-keywords-row">
            <span className="arena-chip-label">{t('decks', 'filter_keyword')}</span>
            <div className="arena-filter-chips keyword-chips">
              {(moreKeywords ? [...KEYWORDS_PRIMARY, ...KEYWORDS_EXTRA] : [...KEYWORDS_PRIMARY]).map((kw) => {
                const active = keywordFilter.has(kw)
                return (
                  <button key={kw} type="button" className={`keyword-chip ${active ? 'active' : ''}`} onClick={() => onToggleKeyword(kw)}>
                    {kw}
                  </button>
                )
              })}
              <button type="button" className="keyword-more-btn" onClick={() => setMoreKeywords((v) => !v)}>
                {moreKeywords ? t('decks', 'filter_less') : t('decks', 'filter_more')} {moreKeywords ? '▴' : '▾'}
              </button>
            </div>
          </div>

          <div className="adv-row adv-stats-row">
            <div className="stat-filter-group">
              <span className="arena-chip-label">{t('decks', 'filter_power')}</span>
              <select
                className="stat-op-select"
                value={powerFilter?.op ?? '>='}
                onChange={(e) => {
                  const op = e.target.value as StatOp
                  const val = powerFilter?.value ?? 3
                  onPowerChange({ op, value: val })
                }}
              >
                <option value=">=">≥</option>
                <option value="=">=</option>
                <option value="<=">≤</option>
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
              </select>
              <input
                className="stat-num-input"
                type="number"
                min={0}
                max={20}
                placeholder="3"
                value={powerFilter?.value ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '') onPowerChange(null)
                  else onPowerChange({ op: powerFilter?.op ?? '>=', value: Math.max(0, Math.min(20, Number(v))) })
                }}
              />
              {powerFilter && (
                <button type="button" className="stat-clear-btn" onClick={() => onPowerChange(null)} title={t('common', 'clear')}>
                  ×
                </button>
              )}
            </div>

            <div className="stat-filter-group">
              <span className="arena-chip-label">{t('decks', 'filter_toughness')}</span>
              <select
                className="stat-op-select"
                value={toughnessFilter?.op ?? '>='}
                onChange={(e) => {
                  const op = e.target.value as StatOp
                  const val = toughnessFilter?.value ?? 3
                  onToughnessChange({ op, value: val })
                }}
              >
                <option value=">=">≥</option>
                <option value="=">=</option>
                <option value="<=">≤</option>
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
              </select>
              <input
                className="stat-num-input"
                type="number"
                min={0}
                max={20}
                placeholder="3"
                value={toughnessFilter?.value ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '') onToughnessChange(null)
                  else onToughnessChange({ op: toughnessFilter?.op ?? '>=', value: Math.max(0, Math.min(20, Number(v))) })
                }}
              />
              {toughnessFilter && (
                <button type="button" className="stat-clear-btn" onClick={() => onToughnessChange(null)} title={t('common', 'clear')}>
                  ×
                </button>
              )}
            </div>

            <div className="stat-filter-group set-filter-group">
              <span className="arena-chip-label">{t('decks', 'filter_set')}</span>
              <input
                className="set-input"
                type="text"
                placeholder={t('decks', 'filter_set_placeholder')}
                value={setInput}
                onChange={(e) => setSetInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSetSubmit()
                }}
                onBlur={handleSetSubmit}
              />
              {setFilter && (
                <button type="button" className="stat-clear-btn" onClick={() => { setSetInput(''); onSetChange(null) }} title={t('common', 'clear')}>
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="adv-row adv-sets-row">
            <div className="arena-filter-chips">
              {QUICK_SETS.map((s) => (
                <button key={s} type="button" className={`set-chip ${setFilter === s ? 'active' : ''}`} onClick={() => onSetChange(setFilter === s ? null : s)}>
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
