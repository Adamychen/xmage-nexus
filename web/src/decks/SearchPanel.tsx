import { useState, useMemo } from 'react'
import type { ScryfallSearchCard } from './scryfallSearch'
import { useScryfallSearch } from './scryfallSearch'
import { ArenaFilterBar } from './ArenaFilterBar'
import { ArenaCardGrid } from './ArenaCardGrid'
import type { DeckFormat } from './types'
import { FORMAT_CONFIGS } from './formatRules'
import { useTranslation } from '../i18n'
import { buildScryfallQuery, type Rarity, type StatFilter } from './filterQuery'
import './SearchPanel.css'

export default function SearchPanel({
  onAdd,
  countMap = new Map(),
  format = 'Freeform',
  onHover,
  onLeave,
}: {
  onAdd: (card: ScryfallSearchCard) => void
  countMap?: Map<string, number>
  format?: DeckFormat
  onHover?: (card: ScryfallSearchCard, rect: DOMRect) => void
  onLeave?: () => void
}) {
  const { cardLang, setCardLanguage, lang: uiLang } = useTranslation()
  const [searchLang, setSearchLang] = useState<string>(() => cardLang || uiLang || 'es')
  const [rawQuery, setRawQuery] = useState('')
  const [colorFilter, setColorFilter] = useState<Set<string>>(new Set())
  const [cmcFilter, setCmcFilter] = useState<number | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [rarityFilter, setRarityFilter] = useState<Set<Rarity>>(new Set())
  const [keywordFilter, setKeywordFilter] = useState<Set<string>>(new Set())
  const [powerFilter, setPowerFilter] = useState<StatFilter | null>(null)
  const [toughnessFilter, setToughnessFilter] = useState<StatFilter | null>(null)
  const [setFilter, setSetFilter] = useState<string | null>(null)

  const config = FORMAT_CONFIGS[format] ?? FORMAT_CONFIGS.Freeform

  const scryfallQuery = useMemo(
    () =>
      buildScryfallQuery({
        rawQuery,
        formatKey: config.scryfallKey ?? null,
        colorFilter,
        typeFilter,
        cmcFilter,
        rarityFilter,
        keywordFilter,
        powerFilter,
        toughnessFilter,
        setFilter,
      }),
    [rawQuery, config.scryfallKey, colorFilter, typeFilter, cmcFilter, rarityFilter, keywordFilter, powerFilter, toughnessFilter, setFilter],
  )

  const { cards, loading, loadingMore, hasMore, totalCards, error, loadMore } = useScryfallSearch(scryfallQuery, searchLang)

  const handleSearchLangChange = (nextLang: string) => {
    setSearchLang(nextLang)
    if (nextLang !== 'any') {
      setCardLanguage(nextLang)
    }
  }

  const toggleColor = (c: string) => {
    const next = new Set(colorFilter)
    if (next.has(c)) next.delete(c)
    else next.add(c)
    setColorFilter(next)
  }

  const toggleRarity = (r: Rarity) => {
    const next = new Set(rarityFilter)
    if (next.has(r)) next.delete(r)
    else next.add(r)
    setRarityFilter(next)
  }

  const toggleKeyword = (kw: string) => {
    const next = new Set(keywordFilter)
    if (next.has(kw)) next.delete(kw)
    else next.add(kw)
    setKeywordFilter(next)
  }

  const handleReset = () => {
    setRawQuery('')
    setColorFilter(new Set())
    setCmcFilter(null)
    setTypeFilter(null)
    setRarityFilter(new Set())
    setKeywordFilter(new Set())
    setPowerFilter(null)
    setToughnessFilter(null)
    setSetFilter(null)
  }

  return (
    <div className="arena-search-panel">
      <ArenaFilterBar
        query={rawQuery}
        onQueryChange={setRawQuery}
        colorFilter={colorFilter}
        onToggleColor={toggleColor}
        cmcFilter={cmcFilter}
        onCmcChange={setCmcFilter}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        rarityFilter={rarityFilter}
        onToggleRarity={toggleRarity}
        keywordFilter={keywordFilter}
        onToggleKeyword={toggleKeyword}
        powerFilter={powerFilter}
        onPowerChange={setPowerFilter}
        toughnessFilter={toughnessFilter}
        onToughnessChange={setToughnessFilter}
        setFilter={setFilter}
        onSetChange={setSetFilter}
        onReset={handleReset}
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
        totalCards={totalCards}
        countMap={countMap}
        onAdd={onAdd}
        onLoadMore={loadMore}
        onHover={onHover}
        onLeave={onLeave}
      />
    </div>
  )
}
