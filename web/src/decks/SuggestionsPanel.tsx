import type { ScryfallSearchCard } from './scryfallSearch'
import { scryfallCardImage } from './scryfallSearch'
import type { EdhrecCommanderData, EdhrecList } from './edhrec'
import { edhrecPageUrl } from './edhrec'
import { useEdhrecSuggestions, SUGGESTIONS_PER_LIST } from './useEdhrecSuggestions'
import { setFloatingCardDragImage } from './arenaDragHelpers'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
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

function synergyPct(synergy: number | null): string | null {
  if (synergy === null || !Number.isFinite(synergy)) return null
  return `${synergy > 0 ? '+' : ''}${Math.round(synergy * 100)}%`
}

function deckCountFor(card: ScryfallSearchCard, countMap: Map<string, number>): number {
  const keySetNum = `${card.set.toUpperCase()}/${card.collector_number}`
  return countMap.get(keySetNum) ?? countMap.get(card.name.toLowerCase()) ?? 0
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
  const pct = synergyPct(synergy)
  const maxPips = 4

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
      oracleText: card.oracle_text ?? '',
      source: 'search',
    }))
    e.dataTransfer.effectAllowed = 'copy'
    setFloatingCardDragImage(e, imgUrl, displayName)
  }

  return (
    <div
      className="arena-grid-card search-card sg-tile"
      draggable
      role="button"
      tabIndex={0}
      aria-label={`${displayName} — ${t('decks', 'builder_grid_add')}`}
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
      title={`${displayName} — ${t('decks', 'builder_grid_add')}`}
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
          <span className="arena-add-badge search-card-add">+ {t('decks', 'builder_grid_add')}</span>
        </div>
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
  cards,
  countMap,
  onAdd,
  onHover,
  onLeave,
}: {
  list: EdhrecList
  cards: Map<string, ScryfallSearchCard>
  countMap: Map<string, number>
  onAdd: (card: ScryfallSearchCard) => void
  onHover?: (card: ScryfallSearchCard, rect: DOMRect) => void
  onLeave?: () => void
}) {
  const { t } = useTranslation()
  const resolved = list.cards
    .slice(0, SUGGESTIONS_PER_LIST)
    .map((c) => ({ view: c, card: cards.get(c.name.toLowerCase()) }))
    .filter((e): e is { view: EdhrecList['cards'][number]; card: ScryfallSearchCard } => !!e.card)
  if (resolved.length === 0) return null
  const catKey = CATEGORY_KEYS[list.tag] as DeckKey | undefined
  const label = catKey ? t('decks', catKey) : list.header || list.tag
  return (
    <section className="sg-section">
      <h3 className="sg-section-title">{label}</h3>
      <div className="sg-grid">
        {resolved.map(({ view, card }) => (
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
  onAdd,
  onHover,
  onLeave,
}: {
  data: EdhrecCommanderData
  cards: Map<string, ScryfallSearchCard>
  countMap: Map<string, number>
  onAdd: (card: ScryfallSearchCard) => void
  onHover?: (card: ScryfallSearchCard, rect: DOMRect) => void
  onLeave?: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="sg-scroll">
      {data.numDecks !== null && (
        <div className="sg-deck-count">
          {t('decks', 'suggestions_based_on', { count: data.numDecks.toLocaleString(), name: data.commanderName })}
        </div>
      )}
      {data.lists.map((list) => (
        <SuggestionSection
          key={list.tag}
          list={list}
          cards={cards}
          countMap={countMap}
          onAdd={onAdd}
          onHover={onHover}
          onLeave={onLeave}
        />
      ))}
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
}: {
  commanderName: string | null
  isCommanderFormat: boolean
  countMap: Map<string, number>
  onAdd: (card: ScryfallSearchCard) => void
  onHover?: (card: ScryfallSearchCard, rect: DOMRect) => void
  onLeave?: () => void
}) {
  const { t } = useTranslation()
  const enabled = isCommanderFormat && !!commanderName
  const { state, retry } = useEdhrecSuggestions(commanderName, enabled)

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
    <div className="sg-panel">
      <ReadyPanel
        data={state.data}
        cards={state.cards}
        countMap={countMap}
        onAdd={onAdd}
        onHover={onHover}
        onLeave={onLeave}
      />
    </div>
  )
}
