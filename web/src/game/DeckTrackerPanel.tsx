import { useContext, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import CloseButton from '../ui/CloseButton'
import EmptyState from '../ui/EmptyState'
import Chip from '../ui/Chip'
import Icon from '../ui/Icon'
import { useStore } from '../state/store'
import { useTranslation } from '../i18n'
import type { TranslationSchema } from '../i18n/types'
import { ManaCost } from '../decks/ArenaManaSymbols'
import FloatingCardPreview from '../board/FloatingCardPreview'
import { computeDeckTracker, type TrackedCard } from './deckTracker'
import { DrawerHeadSlotContext } from './drawerHeadSlot'
import { useDeckCardMeta } from './useDeckCardMeta'
import type { CardView } from '../net/types'
import './DeckTrackerPanel.css'

type SortKey = 'cmc' | 'name' | 'count' | 'odds'
type Kind = 'creature' | 'spell' | 'other' | 'land' | 'unknown'
type TrackerKey = Extract<keyof TranslationSchema['game'], `tracker_${string}`>

const SORT_OPTIONS: { id: SortKey; label: TrackerKey }[] = [
  { id: 'cmc', label: 'tracker_sort_cmc' },
  { id: 'name', label: 'tracker_sort_name' },
  { id: 'count', label: 'tracker_sort_count' },
  { id: 'odds', label: 'tracker_sort_odds' },
]

const GROUP_ORDER: { kind: Kind; label: TrackerKey }[] = [
  { kind: 'creature', label: 'tracker_creatures' },
  { kind: 'spell', label: 'tracker_spells' },
  { kind: 'other', label: 'tracker_other' },
  { kind: 'land', label: 'tracker_lands' },
  { kind: 'unknown', label: 'tracker_no_data' },
]

const SEGMENTS: { key: 'land' | 'creature' | 'instantOrSorcery' | 'other'; label: TrackerKey; css: string }[] = [
  { key: 'land', label: 'tracker_lands', css: 'seg-land' },
  { key: 'creature', label: 'tracker_creatures', css: 'seg-creature' },
  { key: 'instantOrSorcery', label: 'tracker_spells', css: 'seg-spell' },
  { key: 'other', label: 'tracker_other', css: 'seg-other' },
]

function kindOf(card: TrackedCard): Kind {
  if (!card.hasData) return 'unknown'
  if (card.isLand) return 'land'
  if (card.isCreature) return 'creature'
  if (card.isInstantOrSorcery) return 'spell'
  return 'other'
}

function byName(a: TrackedCard, b: TrackedCard): number {
  return a.name.localeCompare(b.name)
}

function sortCards(cards: TrackedCard[], sortBy: SortKey): TrackedCard[] {
  return [...cards].sort((a, b) => {
    if (sortBy === 'cmc' && a.manaValue !== b.manaValue) return a.manaValue - b.manaValue
    if (sortBy === 'count' && b.remainingCount !== a.remainingCount) return b.remainingCount - a.remainingCount
    if (sortBy === 'odds' && b.drawProbability !== a.drawProbability) return b.drawProbability - a.drawProbability
    return byName(a, b)
  })
}

interface RowProps {
  card: TrackedCard
  dimmed?: boolean
  onPreview: (card: CardView, rect: DOMRect) => void
  onPreviewEnd: () => void
}

function TrackerRow({ card, dimmed = false, onPreview, onPreviewEnd }: RowProps) {
  const { t } = useTranslation()
  const classes = ['tracker-card-row']
  if (card.isTopCard) classes.push('is-top-revealed')
  if (dimmed) classes.push('is-drawn')
  return (
    <div
      className={classes.join(' ')}
      data-card-name={card.name}
      onMouseEnter={(e) => onPreview(card.sampleCard, e.currentTarget.getBoundingClientRect())}
      onMouseLeave={onPreviewEnd}
    >
      <span className="tracker-row-name" title={card.name}>
        {card.name}
      </span>
      {card.isTopCard && (
        <span className="tracker-top-badge" title={t('game', 'tracker_top_revealed')}>
          <Icon name="eye" size={10} /> TOP
        </span>
      )}
      {card.remainingCount > 1 && (
        <span className="tracker-row-copies" title={`${card.remainingCount} / ${card.initialAmount}`}>
          ×{card.remainingCount}
        </span>
      )}
      {card.manaCost && (
        <span className="tracker-row-cost">
          <ManaCost manaCost={card.manaCost} size={15} />
        </span>
      )}
      <span className="tracker-row-odds">{card.drawProbability}%</span>
    </div>
  )
}

interface PanelRowsProps {
  cards: TrackedCard[]
  onPreview: (card: CardView, rect: DOMRect) => void
  onPreviewEnd: () => void
}

export default function DeckTrackerPanel() {
  const { t } = useTranslation()
  const myDeck = useStore((s) => s.myDeck)
  const game = useStore((s) => s.game)
  const headSlot = useContext(DrawerHeadSlotContext)
  const { meta, loading } = useDeckCardMeta(myDeck)

  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('cmc')
  const [drawnOpen, setDrawnOpen] = useState(false)

  const [hoverCard, setHoverCard] = useState<CardView | null>(null)
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null)

  const stats = useMemo(() => computeDeckTracker(myDeck, game, null, meta), [myDeck, game, meta])

  const { inLibrary, drawn } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const matching = q ? stats.cards.filter((c) => c.name.toLowerCase().includes(q)) : stats.cards
    return {
      inLibrary: sortCards(
        matching.filter((c) => c.remainingCount > 0),
        sortBy,
      ),
      drawn: matching.filter((c) => c.remainingCount === 0).sort(byName),
    }
  }, [stats.cards, searchQuery, sortBy])

  const groups = useMemo(
    () =>
      GROUP_ORDER.map((group) => ({
        ...group,
        cards: inLibrary.filter((c) => kindOf(c) === group.kind),
      })).filter((group) => group.cards.length > 0),
    [inLibrary],
  )

  const showPreview = (card: CardView, rect: DOMRect) => {
    setHoverCard(card)
    setHoverRect(rect)
  }
  const endPreview = () => setHoverCard(null)

  const deckName = myDeck?.name || t('game', 'tracker_title')
  const hasDeck = stats.initialTotal > 0
  const hasNoResults = inLibrary.length === 0 && drawn.length === 0

  const barLabel = [
    ...SEGMENTS.map((seg) => `${t('game', seg.label)} ${stats.oddsNextDraw[seg.key]}%`),
    ...(stats.unknownRemaining ? [t('game', 'tracker_unknown_count', { count: stats.unknownRemaining })] : []),
  ].join(', ')

  const headName = <span className="tracker-deck-name" title={deckName}>{deckName}</span>

  return (
    <div className="deck-tracker-panel" data-testid="deck-tracker-panel">
      {headSlot ? createPortal(<span className="tracker-head-name">{headName}</span>, headSlot) : null}

      <div className="tracker-header">
        {!headSlot && <div className="tracker-title-row">{headName}</div>}

        {hasDeck && (
          <div className="tracker-summary">
            <div className="tracker-summary-top">
              <div className="tracker-left">
                <span className="tracker-left-number" data-testid="tracker-left-number">
                  {stats.remainingTotal}
                </span>
                <div className="tracker-left-text">
                  <span className="tracker-left-label">{t('game', 'tracker_left_to_draw')}</span>
                  <span className="tracker-left-sub">
                    {t('game', 'tracker_of_list', { count: stats.initialTotal })}
                    {stats.libraryCountServer > 0 &&
                      ` · ${t('game', 'tracker_library_count', { count: stats.libraryCountServer })}`}
                  </span>
                </div>
              </div>
              <span className="tracker-next-label">{t('game', 'tracker_next_draw')}</span>
            </div>

            {loading ? (
              <div className="tracker-loading" role="status">
                {t('game', 'tracker_loading')}
              </div>
            ) : (
              <>
                <div className="tracker-dist-bar" role="img" aria-label={barLabel}>
                  {SEGMENTS.map((seg) =>
                    stats.oddsNextDraw[seg.key] > 0 ? (
                      <div
                        key={seg.key}
                        className={`dist-seg ${seg.css}`}
                        style={{ width: `${stats.oddsNextDraw[seg.key]}%` }}
                      />
                    ) : null,
                  )}
                </div>
                <div className="tracker-legend">
                  {SEGMENTS.map((seg) => (
                    <div key={seg.key} className="tracker-legend-item">
                      <span className="tracker-legend-label">
                        <span className={`tracker-legend-dot ${seg.css}`} aria-hidden="true" />
                        {t('game', seg.label)}
                      </span>
                      <span className="tracker-legend-values">
                        <span className="tracker-legend-pct">{stats.oddsNextDraw[seg.key]}%</span>
                        <span className="tracker-legend-count">({stats.countsRemaining[seg.key]})</span>
                      </span>
                    </div>
                  ))}
                </div>
                {!!stats.unknownRemaining && (
                  <div className="tracker-unknown">
                    {t('game', 'tracker_unknown_count', { count: stats.unknownRemaining })}
                  </div>
                )}
              </>
            )}

            {stats.faceDownExileCount > 0 && (
              <Chip tone="warn" size="xs" icon="alert" title={t('game', 'tracker_face_down_exile')}>
                {stats.faceDownExileCount} {t('game', 'tracker_face_down_exile')}
              </Chip>
            )}

            <div className="tracker-controls">
              <div className="tracker-search-wrap">
                <Icon name="search" size={12} className="tracker-search-icon" />
                <input
                  type="text"
                  className="tracker-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('game', 'tracker_search_placeholder')}
                />
                {searchQuery && (
                  <CloseButton
                    variant="plain"
                    size="sm"
                    className="tracker-search-clear"
                    label={t('game', 'tracker_clear_search')}
                    onClick={() => setSearchQuery('')}
                  />
                )}
              </div>

              <div className="tracker-sort" role="group" aria-label={t('game', 'tracker_sort_label')}>
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="tracker-sort-btn"
                    aria-pressed={sortBy === option.id}
                    onClick={() => setSortBy(option.id)}
                  >
                    {t('game', option.label)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="tracker-card-list">
        {!hasDeck ? (
          <EmptyState size="lg" icon="layers">{t('game', 'tracker_no_deck')}</EmptyState>
        ) : hasNoResults ? (
          <EmptyState size="lg">{t('game', 'tracker_no_results')}</EmptyState>
        ) : (
          <>
            {loading ? (
              <PanelRows cards={inLibrary} onPreview={showPreview} onPreviewEnd={endPreview} />
            ) : (
              groups.map((group) => (
                <section key={group.kind} className={`tracker-group kind-${group.kind}`} data-group={group.kind}>
                  <header className="tracker-group-head">
                    <span className="tracker-group-dot" aria-hidden="true" />
                    <span className="tracker-group-label">{t('game', group.label)}</span>
                    <span className="tracker-group-count">
                      {group.cards.reduce((sum, c) => sum + c.remainingCount, 0)}
                    </span>
                  </header>
                  <PanelRows cards={group.cards} onPreview={showPreview} onPreviewEnd={endPreview} />
                </section>
              ))
            )}

            {drawn.length > 0 && (
              <section className="tracker-drawn" data-testid="tracker-drawn">
                <button
                  type="button"
                  className="tracker-drawn-toggle"
                  aria-expanded={drawnOpen}
                  onClick={() => setDrawnOpen((open) => !open)}
                >
                  <Icon name={drawnOpen ? 'chevronDown' : 'chevronRight'} size={12} />
                  <span className="tracker-drawn-label">{`${t('game', 'tracker_drawn')} · ${drawn.length}`}</span>
                  {!drawnOpen && (
                    <span className="tracker-drawn-names">{drawn.map((c) => c.name).join(', ')}</span>
                  )}
                </button>
                {drawnOpen && (
                  <div className="tracker-drawn-rows">
                    {drawn.map((card) => (
                      <TrackerRow key={card.name} card={card} dimmed onPreview={showPreview} onPreviewEnd={endPreview} />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      <FloatingCardPreview card={hoverCard} anchorRect={hoverRect} fixedSide="left" />
    </div>
  )
}

function PanelRows({ cards, onPreview, onPreviewEnd }: PanelRowsProps) {
  return (
    <div className="tracker-group-rows">
      {cards.map((card) => (
        <TrackerRow key={card.name} card={card} onPreview={onPreview} onPreviewEnd={onPreviewEnd} />
      ))}
    </div>
  )
}
