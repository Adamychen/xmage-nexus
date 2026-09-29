import { useState, useMemo } from 'react'
import type { ScryfallSearchCard, ScryfallSortDir, ScryfallSortOrder } from './scryfallSearch'
import { useScryfallSearch, DEFAULT_SORT_ORDER } from './scryfallSearch'
import { ArenaFilterBar } from './ArenaFilterBar'
import { ArenaCardGrid } from './ArenaCardGrid'
import type { DeckFormat } from './types'
import { FORMAT_CONFIGS } from './formatRules'
import { useTranslation } from '../i18n'
import { buildScryfallQuery } from './filterQuery'
import { useArenaFilters } from './useArenaFilters'
import './SearchPanel.css'

export default function SearchPanel({
  onAdd,
  countMap = new Map(),
  format = 'Freeform',
  onHover,
  onLeave,
  gridSize: gridSizeProp,
  onGridSizeChange,
}: {
  onAdd: (card: ScryfallSearchCard) => void
  countMap?: Map<string, number>
  format?: DeckFormat
  onHover?: (card: ScryfallSearchCard, rect: DOMRect) => void
  onLeave?: () => void
  gridSize?: number
  onGridSizeChange?: (size: number) => void
}) {
  const { cardLang, setCardLanguage, lang: uiLang } = useTranslation()
  const [searchLang, setSearchLang] = useState<string>(() => cardLang || uiLang || 'es')
  const [sortOrder, setSortOrder] = useState<ScryfallSortOrder>(DEFAULT_SORT_ORDER)
  const [sortDir, setSortDir] = useState<ScryfallSortDir>('asc')
  const [localGridSize, setLocalGridSize] = useState(50)
  const filters = useArenaFilters()

  const gridSize = gridSizeProp ?? localGridSize
  const setGridSize = onGridSizeChange ?? setLocalGridSize

  const config = FORMAT_CONFIGS[format] ?? FORMAT_CONFIGS.Freeform

  const scryfallQuery = useMemo(
    () =>
      buildScryfallQuery({
        rawQuery: filters.rawQuery,
        formatKey: config.scryfallKey ?? null,
        colorFilter: filters.colorFilter,
        typeFilter: filters.typeFilter,
        cmcFilter: filters.cmcFilter,
        rarityFilter: filters.rarityFilter,
        keywordFilter: filters.keywordFilter,
        powerFilter: filters.powerFilter,
        toughnessFilter: filters.toughnessFilter,
        setFilter: filters.setFilter,
      }),
    [
      filters.rawQuery,
      config.scryfallKey,
      filters.colorFilter,
      filters.typeFilter,
      filters.cmcFilter,
      filters.rarityFilter,
      filters.keywordFilter,
      filters.powerFilter,
      filters.toughnessFilter,
      filters.setFilter,
    ],
  )

  const { cards, loading, loadingMore, hasMore, totalCards, error, throttled, loadMore, retry } = useScryfallSearch(scryfallQuery, searchLang, 350, sortOrder, sortDir)

  const handleSearchLangChange = (nextLang: string) => {
    setSearchLang(nextLang)
    if (nextLang !== 'any') {
      setCardLanguage(nextLang)
    }
  }

  const handleReset = () => {
    filters.reset()
    setSortOrder(DEFAULT_SORT_ORDER)
    setSortDir('asc')
  }

  return (
    <div className="arena-search-panel">
      <ArenaFilterBar
        query={filters.rawQuery}
        onQueryChange={filters.setRawQuery}
        colorFilter={filters.colorFilter}
        onToggleColor={filters.toggleColor}
        cmcFilter={filters.cmcFilter}
        onCmcChange={filters.setCmcFilter}
        typeFilter={filters.typeFilter}
        onTypeChange={filters.setTypeFilter}
        rarityFilter={filters.rarityFilter}
        onToggleRarity={filters.toggleRarity}
        keywordFilter={filters.keywordFilter}
        onToggleKeyword={filters.toggleKeyword}
        powerFilter={filters.powerFilter}
        onPowerChange={filters.setPowerFilter}
        toughnessFilter={filters.toughnessFilter}
        onToughnessChange={filters.setToughnessFilter}
        setFilter={filters.setFilter}
        onSetChange={filters.setSetFilter}
        onReset={handleReset}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        sortDir={sortDir}
        onSortDirChange={setSortDir}
        gridSize={gridSize}
        onGridSizeChange={setGridSize}
        searchLang={searchLang}
        onSearchLangChange={handleSearchLangChange}
        loading={loading}
      />
      <ArenaCardGrid
        cards={cards}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        error={error}
        throttled={throttled}
        totalCards={totalCards}
        countMap={countMap}
        onAdd={onAdd}
        onLoadMore={loadMore}
        onRetry={retry}
        onClearFilters={handleReset}
        query={scryfallQuery}
        onHover={onHover}
        onLeave={onLeave}
        cardMinPx={90 + gridSize}
      />
    </div>
  )
}
