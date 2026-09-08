import { useState, useMemo } from 'react'
import { useStore } from '../state/store'
import { useTranslation } from '../i18n'
import Icon from '../ui/Icon'
import { ManaCost } from '../decks/ArenaManaSymbols'
import FloatingCardPreview from '../board/FloatingCardPreview'
import { computeDeckTracker, type TrackedCard } from './deckTracker'
import type { CardView } from '../net/types'
import './DeckTrackerPanel.css'

function getCardColorClass(c: TrackedCard): string {
  if (c.isLand) return 'color-land'
  const col = c.sampleCard?.color
  if (col) {
    const active: string[] = []
    if (col.white) active.push('w')
    if (col.blue) active.push('u')
    if (col.black) active.push('b')
    if (col.red) active.push('r')
    if (col.green) active.push('g')
    if (active.length > 1) return 'color-multi'
    if (active.length === 1) return `color-${active[0]}`
  }
  if (c.manaCost) {
    const hasW = c.manaCost.includes('W')
    const hasU = c.manaCost.includes('U')
    const hasB = c.manaCost.includes('B')
    const hasR = c.manaCost.includes('R')
    const hasG = c.manaCost.includes('G')
    const count = (hasW ? 1 : 0) + (hasU ? 1 : 0) + (hasB ? 1 : 0) + (hasR ? 1 : 0) + (hasG ? 1 : 0)
    if (count > 1) return 'color-multi'
    if (hasW) return 'color-w'
    if (hasU) return 'color-u'
    if (hasB) return 'color-b'
    if (hasR) return 'color-r'
    if (hasG) return 'color-g'
  }
  return 'color-colorless'
}

export default function DeckTrackerPanel() {
  const { t } = useTranslation()
  const myDeck = useStore((s) => s.myDeck)
  const game = useStore((s) => s.game)

  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'cmc' | 'name' | 'count' | 'odds'>('cmc')
  const [hideEmpty, setHideEmpty] = useState(false)

  const [hoverCard, setHoverCard] = useState<CardView | null>(null)
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null)

  const stats = useMemo(() => computeDeckTracker(myDeck, game), [myDeck, game])

  const displayedCards = useMemo(() => {
    let list = stats.cards
    if (hideEmpty) {
      list = list.filter((c) => c.remainingCount > 0)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter((c) => c.name.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      if (sortBy === 'cmc') {
        if (a.isLand !== b.isLand) return a.isLand ? 1 : -1
        if (a.manaValue !== b.manaValue) return a.manaValue - b.manaValue
        return a.name.localeCompare(b.name)
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name)
      }
      if (sortBy === 'count') {
        if (b.remainingCount !== a.remainingCount) return b.remainingCount - a.remainingCount
        return a.name.localeCompare(b.name)
      }
      if (sortBy === 'odds') {
        if (b.drawProbability !== a.drawProbability) return b.drawProbability - a.drawProbability
        return a.name.localeCompare(b.name)
      }
      return 0
    })
  }, [stats.cards, hideEmpty, searchQuery, sortBy])

  // Segmented distribution percentages
  const remTotal = stats.remainingTotal
  const landPct = remTotal > 0 ? (stats.countsRemaining.land / remTotal) * 100 : 0
  const creaturePct = remTotal > 0 ? (stats.countsRemaining.creature / remTotal) * 100 : 0
  const spellPct = remTotal > 0 ? (stats.countsRemaining.instantOrSorcery / remTotal) * 100 : 0
  const otherPct = remTotal > 0 ? (stats.countsRemaining.other / remTotal) * 100 : 0

  return (
    <div className="deck-tracker-panel" data-testid="deck-tracker-panel">
      {/* Header */}
      <div className="tracker-header">
        <div className="tracker-title-row">
          <div className="tracker-title">
            <Icon name="layers" size={14} />
            <span className="tracker-deck-name" title={myDeck?.name || t('game', 'tracker_title')}>
              {myDeck?.name || t('game', 'tracker_title')}
            </span>
          </div>
          <div className="tracker-counts-pill">
            <span className="tracker-count-main">
              {stats.remainingTotal} / {stats.initialTotal}
            </span>
            {stats.libraryCountServer > 0 && stats.libraryCountServer !== stats.remainingTotal && (
              <span className="tracker-count-server" title={t('game', 'library')}>
                ({stats.libraryCountServer})
              </span>
            )}
          </div>
        </div>

        {/* Live Segmented Distribution Bar */}
        {stats.initialTotal > 0 && remTotal > 0 && (
          <div className="tracker-dist-bar" title={`${stats.remainingTotal} ${t('game', 'tracker_remaining')}`}>
            {landPct > 0 && <div className="dist-seg seg-lands" style={{ width: `${landPct}%` }} />}
            {creaturePct > 0 && <div className="dist-seg seg-creatures" style={{ width: `${creaturePct}%` }} />}
            {spellPct > 0 && <div className="dist-seg seg-spells" style={{ width: `${spellPct}%` }} />}
            {otherPct > 0 && <div className="dist-seg seg-other" style={{ width: `${otherPct}%` }} />}
          </div>
        )}

        {/* 2x2 Odds Grid for Vertical Legibility */}
        {stats.initialTotal > 0 && (
          <div className="tracker-odds-grid">
            <div className="tracker-odd-cell cell-lands" title={t('game', 'tracker_lands')}>
              <div className="odd-cell-header">
                <Icon name="mountain" size={12} className="odd-icon" />
                <span className="odd-label">{t('game', 'tracker_lands')}</span>
              </div>
              <div className="odd-cell-values">
                <span className="odd-pct">{stats.oddsNextDraw.land}%</span>
                <span className="odd-count">({stats.countsRemaining.land})</span>
              </div>
            </div>

            <div className="tracker-odd-cell cell-creatures" title={t('game', 'tracker_creatures')}>
              <div className="odd-cell-header">
                <Icon name="swords" size={12} className="odd-icon" />
                <span className="odd-label">{t('game', 'tracker_creatures')}</span>
              </div>
              <div className="odd-cell-values">
                <span className="odd-pct">{stats.oddsNextDraw.creature}%</span>
                <span className="odd-count">({stats.countsRemaining.creature})</span>
              </div>
            </div>

            <div className="tracker-odd-cell cell-spells" title={t('game', 'tracker_spells')}>
              <div className="odd-cell-header">
                <Icon name="sparkles" size={12} className="odd-icon" />
                <span className="odd-label">{t('game', 'tracker_spells')}</span>
              </div>
              <div className="odd-cell-values">
                <span className="odd-pct">{stats.oddsNextDraw.instantOrSorcery}%</span>
                <span className="odd-count">({stats.countsRemaining.instantOrSorcery})</span>
              </div>
            </div>

            <div className="tracker-odd-cell cell-other" title={t('game', 'tracker_other')}>
              <div className="odd-cell-header">
                <Icon name="gem" size={12} className="odd-icon" />
                <span className="odd-label">{t('game', 'tracker_other')}</span>
              </div>
              <div className="odd-cell-values">
                <span className="odd-pct">{stats.oddsNextDraw.other}%</span>
                <span className="odd-count">({stats.countsRemaining.other})</span>
              </div>
            </div>
          </div>
        )}

        {stats.faceDownExileCount > 0 && (
          <div className="tracker-warning-chip" title={t('game', 'tracker_face_down_exile')}>
            <Icon name="alert" size={12} /> {stats.faceDownExileCount} {t('game', 'tracker_face_down_exile')}
          </div>
        )}

        {/* Control toolbar */}
        {stats.initialTotal > 0 && (
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
                <button
                  type="button"
                  className="tracker-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <Icon name="x" size={11} />
                </button>
              )}
            </div>

            <div className="tracker-actions-row">
              <div className="tracker-sort-wrap">
                <select
                  className="tracker-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  aria-label="Sort cards"
                >
                  <option value="cmc">{t('game', 'tracker_sort_cmc')}</option>
                  <option value="name">{t('game', 'tracker_sort_name')}</option>
                  <option value="count">{t('game', 'tracker_sort_count')}</option>
                  <option value="odds">{t('game', 'tracker_sort_odds')}</option>
                </select>
              </div>

              <button
                type="button"
                className={`tracker-toggle-btn ${hideEmpty ? 'active' : ''}`}
                onClick={() => setHideEmpty(!hideEmpty)}
                title={hideEmpty ? t('game', 'tracker_show_all') : t('game', 'tracker_hide_empty')}
              >
                <Icon name={hideEmpty ? 'eye' : 'eyeOff'} size={12} />
                <span>{hideEmpty ? t('game', 'tracker_show_all') : t('game', 'tracker_hide_empty')}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cards Scroll Container */}
      <div className="tracker-card-list">
        {stats.initialTotal === 0 ? (
          <div className="tracker-empty">
            <Icon name="layers" size={28} />
            <p>{t('game', 'tracker_no_deck')}</p>
          </div>
        ) : displayedCards.length === 0 ? (
          <div className="tracker-empty">
            <p>{t('game', 'tracker_no_results')}</p>
          </div>
        ) : (
          displayedCards.map((c) => {
            const isEmpty = c.remainingCount === 0
            const colorClass = getCardColorClass(c)
            const fillPct = c.initialAmount > 0 ? Math.min(100, Math.max(0, (c.remainingCount / c.initialAmount) * 100)) : 0

            return (
              <div
                key={c.name}
                className={`tracker-card-row ${isEmpty ? 'is-empty' : ''} ${c.isTopCard ? 'is-top-revealed' : ''} ${colorClass}`}
                data-card-name={c.name}
                onMouseEnter={(e) => {
                  setHoverCard(c.sampleCard)
                  setHoverRect(e.currentTarget.getBoundingClientRect())
                }}
                onMouseLeave={() => setHoverCard(null)}
              >
                {/* Visual depletion progress fill */}
                <div className="tracker-row-fill" style={{ width: `${fillPct}%` }} />

                {/* Left color bar */}
                <div className={`tracker-color-bar ${colorClass}`} />

                {/* Fixed-width mana/land slot for uniform vertical alignment */}
                <div className="tracker-mana-slot">
                  {c.manaCost ? (
                    <ManaCost manaCost={c.manaCost} size={13} className="tracker-row-mana" />
                  ) : c.isLand ? (
                    <Icon name="mountain" size={12} className="tracker-land-icon" aria-hidden="true" />
                  ) : (
                    <span className="tracker-zero-pip">0</span>
                  )}
                </div>

                {/* Card name & top indicator */}
                <div className="tracker-name-col">
                  <span className="tracker-row-name" title={c.name}>
                    {c.name}
                  </span>
                  {c.isTopCard && (
                    <span className="tracker-top-badge" title={t('game', 'tracker_top_revealed')}>
                      <Icon name="eye" size={10} /> TOP
                    </span>
                  )}
                </div>

                {/* Counts and Probability */}
                <div className="tracker-data-col">
                  <span className={`tracker-row-count ${isEmpty ? 'count-zero' : ''}`}>
                    {c.remainingCount} / {c.initialAmount}
                  </span>
                  <span className="tracker-row-prob">
                    {c.drawProbability > 0 ? `${c.drawProbability}%` : '0%'}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Card Preview Portal / Hover */}
      <FloatingCardPreview card={hoverCard} anchorRect={hoverRect} fixedSide="left" />
    </div>
  )
}
