import { useEffect, useMemo, useRef, useState } from 'react'
import type { ScryfallSearchCard, ScryfallSortDir, ScryfallSortOrder } from './scryfallSearch'
import { scryfallCardImage } from './scryfallSearch'
import type { EdhrecCardView, EdhrecCommanderData, EdhrecList } from './edhrec'
import { edhrecPageUrl } from './edhrec'
import { useEdhrecSuggestions } from './useEdhrecSuggestions'
import { hasActiveArenaFilters, matchesArenaFilters, sortSuggestionEntries, type ArenaFilterValues } from './filterMatch'
import { useArenaFilters } from './useArenaFilters'
import { setFloatingCardDragImage } from './arenaDragHelpers'
import { ArenaFilterBar } from './ArenaFilterBar'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { toBcp47Locale, useTranslation } from '../i18n'
import type { TranslationSchema } from '../i18n'
import './SuggestionsPanel.css'

type DeckKey = keyof TranslationSchema['decks']

const CATEGORY_KEYS: Record<string, DeckKey> = {
  newcards: 'suggestions_cat_newcards',
  highsynergycards: 'suggestions_cat_highsynergycards',
  topcards: 'suggestions_cat_topcards',
  gamechangers: 'suggestions_cat_gamechangers',
  creatures: 'suggestions_cat_creatures',
  instants: 'suggestions_cat_instants',
  sorceries: 'suggestions_cat_sorceries',
  utilityartifacts: 'suggestions_cat_utilityartifacts',
  manaartifacts: 'suggestions_cat_manaartifacts',
  enchantments: 'suggestions_cat_enchantments',
  planeswalkers: 'suggestions_cat_planeswalkers',
  lands: 'suggestions_cat_lands',
  utilitylands: 'suggestions_cat_utilitylands',
}

type ResolvedSuggestion = { view: EdhrecCardView; card: ScryfallSearchCard }

function synergyPct(synergy: number | null): string | null {
  if (synergy === null || !Number.isFinite(synergy)) return null
  return `${synergy > 0 ? '+' : ''}${Math.round(synergy * 100)}%`
}

function deckCountFor(card: ScryfallSearchCard, countMap: Map<string, number>): number {
  const keySetNum = `${card.set.toUpperCase()}/${card.collector_number}`
  return Math.max(countMap.get(keySetNum) ?? 0, countMap.get(card.name.toLowerCase()) ?? 0)
}

function resolveSection(list: EdhrecList, cards: Map<string, ScryfallSearchCard>, filters: ArenaFilterValues): ResolvedSuggestion[] {
  const resolved: ResolvedSuggestion[] = []
  for (const view of list.cards) {
    const card = cards.get(view.name.toLowerCase())
    if (card && matchesArenaFilters(card, filters)) resolved.push({ view, card })
  }
  return resolved
}

function SuggestionTile({
  card,
  synergy,
  countMap,
  onAdd,
  onHover,
  onLeave,
}: {
  card: ScryfallSearchCard
  synergy: number | null
  countMap: Map<string, number>
  onAdd: (card: ScryfallSearchCard) => void
  onHover?: (card: ScryfallSearchCard, rect: DOMRect) => void
  onLeave?: () => void
}) {
  const { t } = useTranslation()
  const imgUrl = scryfallCardImage(card)
  const displayName = card.printed_name || card.name
  const count = deckCountFor(card, countMap)
  const inDeck = count > 0
  const pct = synergyPct(synergy)
  const maxPips = 4
  const [pulsing, setPulsing] = useState(false)
  const prevCountRef = useRef(count)

  useEffect(() => {
    if (count > prevCountRef.current) {
      setPulsing(true)
      prevCountRef.current = count
      const timer = window.setTimeout(() => setPulsing(false), 650)
      return () => window.clearTimeout(timer)
    }
    prevCountRef.current = count
  }, [count])

  const addLabel = t('decks', 'builder_grid_add')
  const inDeckLabel = t('decks', 'suggestions_in_deck', { count })
  const actionLabel = inDeck ? `${inDeckLabel} — ${addLabel}` : addLabel

  const handleDragStart = (e: React.DragEvent) => {
    onLeave?.()
    e.dataTransfer.setData('application/json', JSON.stringify({
      cardName: card.name,
      printedName: card.printed_name,
      setCode: card.set.toUpperCase(),
      cardNumber: card.collector_number,
      manaCost: card.mana_cost,
      cmc: card.cmc,
      typeLine: card.type_line || card.printed_type_line,
      colors: card.colors || card.color_identity || [],
      colorIdentity: card.color_identity,
      oracleText: card.oracle_text ?? '',
      source: 'search',
    }))
    e.dataTransfer.effectAllowed = 'copy'
    setFloatingCardDragImage(e, imgUrl, displayName)
  }

  return (
    <div
      className={`arena-grid-card search-card sg-tile${inDeck ? ' is-in-deck' : ''}${pulsing ? ' is-pulsing' : ''}`}
      draggable
      role="button"
      tabIndex={0}
      aria-label={`${displayName} — ${actionLabel}`}
      onDragStart={handleDragStart}
      onClick={() => onAdd(card)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onAdd(card)
        }
      }}
      onMouseEnter={(e) => onHover?.(card, e.currentTarget.getBoundingClientRect())}
      onMouseLeave={onLeave}
      title={`${displayName} — ${actionLabel}`}
    >
      <div className="arena-card-pips">
        {count > maxPips ? (
          <span className="card-pip-count" title={`${count}× ${displayName}`}>{count}×</span>
        ) : (
          Array.from({ length: maxPips }).map((_, i) => (
            <div key={i} className={`card-pip-diamond ${i < count ? 'filled' : ''}`} />
          ))
        )}
      </div>
      <div className="arena-grid-card-img-wrapper">
        {imgUrl ? (
          <img src={imgUrl} alt={displayName} className="arena-grid-card-img" loading="lazy" />
        ) : (
          <div className="arena-grid-card-fallback">
            <div className="arena-grid-card-fallback-name">{displayName}</div>
          </div>
        )}
        <div className="arena-grid-card-overlay">
          <span className="arena-add-badge search-card-add">+ {addLabel}</span>
        </div>
        {inDeck && (
          <span
            className={`sg-in-deck-badge${pulsing ? ' is-pulsing' : ''}`}
            data-testid="sg-in-deck-badge"
            aria-hidden="true"
          >
            <Icon name="check" size={10} />
            <span className="sg-in-deck-count">×{count}</span>
          </span>
        )}
        {pct && (
          <span
            className={`sg-synergy-badge ${synergy !== null && synergy > 0 ? 'is-positive' : ''}`}
            title={t('decks', 'suggestions_synergy_title')}
          >
            {pct}
          </span>
        )}
      </div>
    </div>
  )
}

function SuggestionSection({
  list,
  entries,
  countMap,
  onAdd,
  onHover,
  onLeave,
}: {
  list: EdhrecList
  entries: ResolvedSuggestion[]
  countMap: Map<string, number>
  onAdd: (card: ScryfallSearchCard) => void
  onHover?: (card: ScryfallSearchCard, rect: DOMRect) => void
  onLeave?: () => void
}) {
  const { t } = useTranslation()
  if (entries.length === 0) return null
  const catKey = CATEGORY_KEYS[list.tag] as DeckKey | undefined
  const label = catKey ? t('decks', catKey) : list.header || list.tag
  return (
    <section className="sg-section">
      <h3 className="sg-section-title">{label}</h3>
      <div className="sg-grid">
        {entries.map(({ view, card }) => (
          <SuggestionTile
            key={card.id}
            card={card}
            synergy={view.synergy}
            countMap={countMap}
            onAdd={onAdd}
            onHover={onHover}
            onLeave={onLeave}
          />
        ))}
      </div>
    </section>
  )
}

function ReadyPanel({
  data,
  cards,
  countMap,
  filters,
  sortOrder,
  sortDir,
  onClearFilters,
  onAdd,
  onHover,
  onLeave,
}: {
  data: EdhrecCommanderData
  cards: Map<string, ScryfallSearchCard>
  countMap: Map<string, number>
  filters: ArenaFilterValues
  sortOrder: ScryfallSortOrder
  sortDir: ScryfallSortDir
  onClearFilters: () => void
  onAdd: (card: ScryfallSearchCard) => void
  onHover?: (card: ScryfallSearchCard, rect: DOMRect) => void
  onLeave?: () => void
}) {
  const { t, lang } = useTranslation()
  const prepared = useMemo(
    () =>
      data.lists.map((list) => ({
        list,
        entries: sortSuggestionEntries(resolveSection(list, cards, filters), sortOrder, sortDir),
      })),
    [data, cards, filters, sortOrder, sortDir],
  )
  const visible = prepared.filter((s) => s.entries.length > 0)
  const hasFilters = hasActiveArenaFilters(filters)

  return (
    <div className="sg-scroll">
      {data.numDecks !== null && (
        <div className="sg-deck-count">
          {t('decks', 'suggestions_based_on', {
            // formatted in the language the app is in, not the one the browser happens to report:
            // `toLocaleString()` with no argument gave a Spanish reader "4.321" in a UI set to
            // English (and a bare "4321" in some locales), and made this line depend on the host
            // locale, so the same build rendered differently per machine.
            count: data.numDecks.toLocaleString(toBcp47Locale(lang)),
            name: data.commanderName,
          })}
        </div>
      )}
      {visible.length === 0 ? (
        <div className="sg-status" data-testid="sg-no-results">
          <Icon name="search" size={14} />
          <span>
            {filters.rawQuery.trim()
              ? t('decks', 'builder_search_no_results', { query: filters.rawQuery.trim() })
              : t('decks', 'sample_no_cards')}
          </span>
          {hasFilters && (
            <Button variant="subtle" size="sm" onClick={onClearFilters}>
              {t('decks', 'builder_search_clear_filters')}
            </Button>
          )}
        </div>
      ) : (
        visible.map(({ list, entries }) => (
          <SuggestionSection
            key={list.tag}
            list={list}
            entries={entries}
            countMap={countMap}
            onAdd={onAdd}
            onHover={onHover}
            onLeave={onLeave}
          />
        ))
      )}
      <div className="sg-attribution">
        <a href={edhrecPageUrl(data.commanderName)} target="_blank" rel="noopener noreferrer">
          {t('decks', 'suggestions_powered_by')}
        </a>
      </div>
    </div>
  )
}

export default function SuggestionsPanel({
  commanderName,
  isCommanderFormat,
  countMap,
  onAdd,
  onHover,
  onLeave,
  gridSize: gridSizeProp,
  onGridSizeChange,
}: {
  commanderName: string | null
  isCommanderFormat: boolean
  countMap: Map<string, number>
  onAdd: (card: ScryfallSearchCard) => void
  onHover?: (card: ScryfallSearchCard, rect: DOMRect) => void
  onLeave?: () => void
  gridSize?: number
  onGridSizeChange?: (size: number) => void
}) {
  const { t } = useTranslation()
  const enabled = isCommanderFormat && !!commanderName
  const { state, retry } = useEdhrecSuggestions(commanderName, enabled)
  const filters = useArenaFilters()
  const [sortOrder, setSortOrder] = useState<ScryfallSortOrder>('edhrec')
  const [sortDir, setSortDir] = useState<ScryfallSortDir>('asc')
  const [localGridSize, setLocalGridSize] = useState(50)

  const gridSize = gridSizeProp ?? localGridSize
  const setGridSize = onGridSizeChange ?? setLocalGridSize

  const filterValues = useMemo<ArenaFilterValues>(
    () => ({
      rawQuery: filters.rawQuery,
      colorFilter: filters.colorFilter,
      cmcFilter: filters.cmcFilter,
      typeFilter: filters.typeFilter,
      rarityFilter: filters.rarityFilter,
      keywordFilter: filters.keywordFilter,
      powerFilter: filters.powerFilter,
      toughnessFilter: filters.toughnessFilter,
      setFilter: filters.setFilter,
    }),
    [
      filters.rawQuery,
      filters.colorFilter,
      filters.cmcFilter,
      filters.typeFilter,
      filters.rarityFilter,
      filters.keywordFilter,
      filters.powerFilter,
      filters.toughnessFilter,
      filters.setFilter,
    ],
  )

  if (!isCommanderFormat) {
    return (
      <div className="sg-panel">
        <div className="sg-status" data-testid="sg-not-commander">
          <Icon name="info" size={14} />
          <span>{t('decks', 'suggestions_not_commander')}</span>
        </div>
      </div>
    )
  }

  if (!commanderName) {
    return (
      <div className="sg-panel">
        <div className="sg-status" data-testid="sg-need-commander">
          <Icon name="crown" size={14} />
          <span>{t('decks', 'suggestions_need_commander')}</span>
        </div>
      </div>
    )
  }

  if (state.status === 'loading') {
    return (
      <div className="sg-panel">
        <div className="sg-status" role="status">
          <div className="arena-grid-spinner" />
          <span>{t('common', 'loading')}</span>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="sg-panel">
        <div className="sg-status is-error" role="alert">
          <Icon name="alert" size={14} />
          <span>{t('decks', 'suggestions_error')}</span>
          <Button variant="subtle" size="sm" onClick={retry}>
            {t('decks', 'builder_search_retry')}
          </Button>
        </div>
      </div>
    )
  }

  if (state.status === 'not_found') {
    return (
      <div className="sg-panel">
        <div className="sg-status" data-testid="sg-not-found">
          <Icon name="search" size={14} />
          <span>{t('decks', 'suggestions_not_found', { name: state.commanderName })}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="sg-panel" style={{ '--sg-card-min': `${90 + gridSize}px` } as React.CSSProperties}>
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
        onReset={filters.reset}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        sortDir={sortDir}
        onSortDirChange={setSortDir}
        gridSize={gridSize}
        onGridSizeChange={setGridSize}
      />
      <ReadyPanel
        data={state.data}
        cards={state.cards}
        countMap={countMap}
        filters={filterValues}
        sortOrder={sortOrder}
        sortDir={sortDir}
        onClearFilters={filters.reset}
        onAdd={onAdd}
        onHover={onHover}
        onLeave={onLeave}
      />
    </div>
  )
}
