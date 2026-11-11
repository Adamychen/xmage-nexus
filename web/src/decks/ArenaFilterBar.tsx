import { useState, useRef, useEffect, useId } from 'react'
import Select from '../ui/Select'
import IconButton from '../ui/IconButton'
import Button from '../ui/Button'
import ChipButton from '../ui/ChipButton'
import CloseButton from '../ui/CloseButton'
import { ManaPip } from './ArenaManaSymbols'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import { keywordDisplayName } from '../data/keywordI18n'
import type { Rarity, StatFilter, StatOp } from './filterQuery'
import { rawQueryHasColor } from './filterQuery'
import type { ScryfallSortDir, ScryfallSortOrder } from './scryfallSearch'
import { CardSizeSlider } from './CardSizeSlider'
import { matchingSets, setCodeFor, useScryfallSets } from './scryfallSets'
import { matchingKeywords, useKeywordCatalog } from './keywordCatalog'
import { FilterDropdown } from './FilterDropdown'
import './ArenaFilterBar.css'

const COLORS = ['W', 'U', 'B', 'R', 'G', 'C'] as const
const TYPES = ['Creature', 'Instant', 'Sorcery', 'Planeswalker', 'Artifact', 'Enchantment', 'Land', 'Battle'] as const
const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'mythic']
const RARITY_LABEL_KEYS: Record<Rarity, 'rarity_common' | 'rarity_uncommon' | 'rarity_rare' | 'rarity_mythic'> = {
  common: 'rarity_common',
  uncommon: 'rarity_uncommon',
  rare: 'rarity_rare',
  mythic: 'rarity_mythic',
}
export const COLOR_LABEL_KEYS: Record<(typeof COLORS)[number], keyof import('../i18n').TranslationSchema['game']> = {
  W: 'color_white',
  U: 'color_blue',
  B: 'color_black',
  R: 'color_red',
  G: 'color_green',
  C: 'color_colorless',
}
const KEYWORDS = [
  'Flying', 'Haste', 'Trample', 'Deathtouch', 'Lifelink', 'Vigilance', 'Hexproof', 'Menace', 'Reach', 'First Strike', 'Double Strike', 'Ward',
  'Flash', 'Defender', 'Indestructible', 'Prowess', 'Toxic', 'Backup', 'Convoke', 'Delve', 'Evolve', 'Cascade', 'Kicker', 'Cycling',
] as const
const keywordIdOfLabel = (label: string): string => label.toLowerCase().replace(/ /g, '_')
const CMC_VALUES = [0, 1, 2, 3, 4, 5, 6, 7] as const
const STAT_OPS: StatOp[] = ['>=', '=', '<=', '>', '<']
const STAT_OP_LABEL: Record<StatOp, string> = { '>=': '≥', '=': '=', '<=': '≤', '>': '>', '<': '<' }
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
  onToggleType,
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
  oracleText = '',
  onOracleTextChange,
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
  typeFilter: Set<string>
  onToggleType: (type: string) => void
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
  oracleText?: string
  onOracleTextChange?: (text: string) => void
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
  const [helpOpen, setHelpOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [setQuery, setSetQuery] = useState('')
  const [keywordQuery, setKeywordQuery] = useState('')
  const oracleId = useId()
  const [powerOp, setPowerOp] = useState<StatOp>('>=')
  const [toughnessOp, setToughnessOp] = useState<StatOp>('>=')
  const helpRef = useRef<HTMLDivElement>(null)
  const helpBtnRef = useRef<HTMLButtonElement>(null)
  const sets = useScryfallSets(advancedOpen)
  const keywordCatalog = useKeywordCatalog(advancedOpen)
  const keywordLabel = (kw: string) => keywordDisplayName(keywordIdOfLabel(kw), kw, (k) => t('keywords', k))

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setHelpOpen(false)
    }
    if (helpOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [helpOpen])

  const allLangOptions = [
    { code: 'any', name: t('common', 'all'), flag: '🌐' },
    ...cardLanguages,
  ]
  const activeLangOption = allLangOptions.find((l) => l.code === searchLang) ?? allLangOptions[0]
  const shownKeywords = matchingKeywords(KEYWORDS, keywordCatalog, keywordQuery, keywordLabel)
  const keywordOptions = [
    ...(keywordQuery.trim() ? [] : [...keywordFilter].filter((kw) => !shownKeywords.some((s) => s.toLowerCase() === kw.toLowerCase()))),
    ...shownKeywords,
  ]
  const shownSets = matchingSets(sets, setQuery)
  const hasActiveFilters =
    query.trim() !== '' ||
    colorFilter.size > 0 ||
    cmcFilter !== null ||
    typeFilter.size > 0 ||
    rarityFilter.size > 0 ||
    keywordFilter.size > 0 ||
    powerFilter !== null ||
    toughnessFilter !== null ||
    (setFilter !== null && setFilter.trim() !== '') ||
    oracleText.trim() !== ''

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
          {loading && <div className="arena-grid-spinner small arena-search-spinner" />}
          {query && !loading && (
            <CloseButton variant="plain" size="sm" className="arena-search-clear" label={t('common', 'clear')} onClick={() => onQueryChange('')} />
          )}
          <div className="arena-search-help-wrap" ref={helpRef}>
            <IconButton label={t('decks', 'search_help_title')} size="xs" round
              ref={helpBtnRef}
              className="arena-search-help-btn"
              onClick={() => setHelpOpen((v) => !v)}
              aria-expanded={helpOpen}>
              ?
            </IconButton>
            {helpOpen && (
              <div
                className="arena-search-help-popover"
                role="dialog"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setHelpOpen(false)
                    helpBtnRef.current?.focus()
                  }
                }}
              >
                <div className="help-popover-title">{t('decks', 'search_help_title')}</div>
                <div className="help-popover-examples">
                  <code>t:creature</code> <code>c:red</code> <code>cmc&lt;=3</code> <code>o:"haste"</code> <code>pow&gt;3</code> <code>rarity:mythic</code> <code>set:mh3</code> <code>f:standard</code>
                </div>
                <div className="help-popover-hint">
                  {t('decks', 'search_help_eg')} <code>haste</code> {t('decks', 'search_help_hint_rest')}
                </div>
                <a href="https://scryfall.com/docs/syntax" target="_blank" rel="noopener noreferrer" className="help-popover-link">
                  scryfall.com/docs/syntax ↗
                </a>
              </div>
            )}
          </div>
        </div>
        {query.trim() !== '' && colorFilter.size > 0 && rawQueryHasColor(query) && (
          <div className="arena-filter-clash" role="note">{t('decks', 'filter_raw_color_clash')}</div>
        )}

        {onSearchLangChange && (
          <div className="arena-lang-select-wrap">
            <Select
              className="arena-lang-btn"
              aria-label={t('common', 'card_language')}
              title={t('common', 'card_language')}
              value={searchLang}
              onChange={onSearchLangChange}
              searchable={false}
              summary={<><span className="lang-flag">{activeLangOption.flag}</span><span className="lang-code">{activeLangOption.code.toUpperCase()}</span></>}
              options={allLangOptions.map((l) => ({ value: l.code, label: <><span>{l.flag}</span><span>{l.name}</span></>, text: l.name }))}
            />
          </div>
        )}

        <div className="arena-mana-orbs">
          {COLORS.map((c) => {
            const active = colorFilter.has(c)
            const label = t('game', COLOR_LABEL_KEYS[c])
            return (
              <button
                key={c}
                type="button"
                className={`mana-orb-btn orb-${c.toLowerCase()} ${active ? 'active' : ''}`}
                onClick={() => onToggleColor(c)}
                title={label}
                aria-label={label}
                aria-pressed={active}
              >
                <ManaPip symbol={c} size={20} />
              </button>
            )
          })}
        </div>
      </div>

      <div className="filter-bar-bottom">
        <FilterDropdown
          label={t('decks', 'filter_cmc')}
          active={cmcFilter !== null}
          testId="filter-cmc"
          summary={cmcFilter === null ? t('common', 'all') : cmcFilter === 7 ? '7+' : String(cmcFilter)}
          value={cmcFilter ?? -1}
          onChange={(v) => onCmcChange(v < 0 ? null : v)}
          options={[
            { value: -1, label: t('common', 'all') },
            ...CMC_VALUES.map((n) => ({ value: n, label: n === 7 ? '7+' : String(n) })),
          ]}
        />

        <FilterDropdown
          label={t('decks', 'filter_type')}
          active={typeFilter.size > 0}
          testId="filter-type"
          summary={typeFilter.size === 0
            ? t('common', 'all')
            : (() => {
              const picked = TYPES.filter((tKey) => typeFilter.has(tKey))
              return `${t('game', TYPE_LABEL_KEYS[picked[0]])}${picked.length > 1 ? ` +${picked.length - 1}` : ''}`
            })()}
          multiple
          selectedValues={TYPES.filter((tKey) => typeFilter.has(tKey))}
          onChange={onToggleType}
          options={TYPES.map((tKey) => ({ value: tKey, label: t('game', TYPE_LABEL_KEYS[tKey]) }))}
        />

        <ChipButton size="sm" activeTone="gold" active={advancedOpen} onClick={() => setAdvancedOpen((v) => !v)} aria-expanded={advancedOpen}>
          {t('decks', 'filter_advanced')} {advancedOpen ? '▴' : '▾'}
        </ChipButton>

        {onSortOrderChange && sortOrder && (
          <div className="arena-sort-wrap">
            <FilterDropdown
              label={t('decks', 'sort_by')}
              active={false}
              testId="arena-sort"
              summary={t('decks', SORT_LABEL_KEYS[sortOrder])}
              value={sortOrder}
              onChange={onSortOrderChange}
              options={SORT_ORDERS.map((o) => ({ value: o, label: t('decks', SORT_LABEL_KEYS[o]) }))}
            />
            {onSortDirChange && (
              <IconButton data-testid="arena-sort-dir-btn" label={sortDir === 'desc' ? t('decks', 'sort_desc') : t('decks', 'sort_asc')}
                onClick={() => onSortDirChange(sortDir === 'desc' ? 'asc' : 'desc')}>
                {sortDir === 'desc' ? '↓' : '↑'}
              </IconButton>
            )}
          </div>
        )}

        {onGridSizeChange && gridSize !== undefined && (
          <CardSizeSlider className="arena-sort-wrap" min={0} max={150} step={5} value={gridSize} onChange={onGridSizeChange} />
        )}

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="filter-reset-btn" onClick={onReset}>
            {t('common', 'clear')}
          </Button>
        )}
      </div>

      {advancedOpen && (
        <div className="filter-advanced-panel">
          {onOracleTextChange && (
            <div className="adv-row adv-oracle-row">
              <label className="arena-chip-label" htmlFor={oracleId}>{t('decks', 'filter_oracle')}</label>
              <input
                id={oracleId}
                className="arena-filter-oracle"
                type="search"
                spellCheck={false}
                placeholder={t('decks', 'filter_oracle_placeholder')}
                aria-describedby={`${oracleId}-hint`}
                value={oracleText}
                onChange={(e) => onOracleTextChange(e.target.value)}
              />
              <span id={`${oracleId}-hint`} className="arena-filter-oracle-hint">{t('decks', 'filter_oracle_hint')}</span>
            </div>
          )}
          <div className="adv-row adv-dd-row">
            <FilterDropdown
              label={t('decks', 'filter_rarity')}
              active={rarityFilter.size > 0}
              testId="filter-rarity"
              summary={rarityFilter.size === 0 ? t('decks', 'filter_any') : RARITIES.filter((r) => rarityFilter.has(r)).map((r) => t('decks', RARITY_LABEL_KEYS[r])).join(', ')}
              multiple
              selectedValues={RARITIES.filter((r) => rarityFilter.has(r))}
              onChange={onToggleRarity}
              options={RARITIES.map((r) => ({ value: r, label: t('decks', RARITY_LABEL_KEYS[r]), className: `rarity-option rarity-${r}` }))}
            />

            <FilterDropdown
              label={t('decks', 'filter_keyword')}
              active={keywordFilter.size > 0}
              testId="filter-keyword"
              summary={keywordFilter.size === 0
                ? t('decks', 'filter_any')
                : `${keywordLabel([...keywordFilter][0])}${keywordFilter.size > 1 ? ` +${keywordFilter.size - 1}` : ''}`}
              multiple
              selectedValues={[...keywordFilter]}
              onChange={onToggleKeyword}
              options={keywordOptions.map((kw) => ({ value: kw, label: keywordLabel(kw) }))}
              search={{
                query: keywordQuery,
                onQueryChange: setKeywordQuery,
                label: t('decks', 'filter_keyword_search'),
                placeholder: t('decks', 'filter_keyword_search'),
              }}
            />

            <FilterDropdown
              label={t('decks', 'filter_set')}
              active={!!setFilter}
              testId="filter-set"
              summary={setFilter ? <span title={sets.find((s) => s.code === setFilter)?.name}>{setFilter.toUpperCase()}</span> : t('decks', 'filter_any')}
              value={setFilter ?? ''}
              onChange={(code) => onSetChange(code || null)}
              options={[
                { value: '', label: t('decks', 'filter_any') },
                ...shownSets.map((s) => ({
                  value: s.code,
                  label: <><span className="arena-filter-dd-code">{s.code.toUpperCase()}</span><span className="arena-filter-dd-name">{s.name}</span></>,
                  text: `${s.code} ${s.name}`,
                })),
              ]}
              search={{
                query: setQuery,
                onQueryChange: setSetQuery,
                label: t('decks', 'filter_set_placeholder'),
                placeholder: t('decks', 'filter_set_placeholder'),
                onEnter: (typed) => {
                  onSetChange(setCodeFor(typed, sets))
                  return true
                },
                empty: sets.length > 0 && setQuery.trim() !== '' && shownSets.length === 0,
              }}
            />
          </div>

          <div className="adv-row adv-stats-row">
            <div className="stat-filter-group">
              <FilterDropdown
                label={t('decks', 'filter_power')}
                active={!!powerFilter}
                testId="filter-power-op"
                summary={STAT_OP_LABEL[powerFilter?.op ?? powerOp]}
                value={powerFilter?.op ?? powerOp}
                onChange={(op) => {
                  setPowerOp(op)
                  if (powerFilter) onPowerChange({ op, value: powerFilter.value })
                }}
                options={STAT_OPS.map((op) => ({ value: op, label: STAT_OP_LABEL[op] }))}
              />
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
                  else {
                    const n = Number(v)
                    if (Number.isFinite(n)) onPowerChange({ op: powerFilter?.op ?? powerOp, value: Math.max(0, Math.min(20, Math.trunc(n))) })
                  }
                }}
              />
              {powerFilter && (
                <CloseButton variant="danger" size="sm" label={t('common', 'clear')} onClick={() => onPowerChange(null)} />
              )}
            </div>

            <div className="stat-filter-group">
              <FilterDropdown
                label={t('decks', 'filter_toughness')}
                active={!!toughnessFilter}
                testId="filter-toughness-op"
                summary={STAT_OP_LABEL[toughnessFilter?.op ?? toughnessOp]}
                value={toughnessFilter?.op ?? toughnessOp}
                onChange={(op) => {
                  setToughnessOp(op)
                  if (toughnessFilter) onToughnessChange({ op, value: toughnessFilter.value })
                }}
                options={STAT_OPS.map((op) => ({ value: op, label: STAT_OP_LABEL[op] }))}
              />
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
                  else {
                    const n = Number(v)
                    if (Number.isFinite(n)) onToughnessChange({ op: toughnessFilter?.op ?? toughnessOp, value: Math.max(0, Math.min(20, Math.trunc(n))) })
                  }
                }}
              />
              {toughnessFilter && (
                <CloseButton variant="danger" size="sm" label={t('common', 'clear')} onClick={() => onToughnessChange(null)} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
