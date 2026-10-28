import { useState, useMemo, type ReactNode } from 'react'
import CloseButton from '../ui/CloseButton'
import Button from '../ui/Button'
import ChipButton from '../ui/ChipButton'
import Chip from '../ui/Chip'
import Checkbox from '../ui/Checkbox'
import type { TableView } from '../net/types'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import { isMyTable, tableOwnerName } from './lobbyUtils'
import { knownDeckType, type FormatFamily } from './formatFamily'
import './TableFilterBar.css'

export interface TableFilters {
  searchQuery: string
  format: string
  availability: 'all' | 'open' | 'dueling'
  mode: 'all' | '1v1' | 'multi' | 'tourney'
  tourneyKind: 'all' | 'constructed' | 'limited'
  skill: 'all' | 'BEGINNER' | 'CASUAL' | 'SERIOUS'
  hidePassworded: boolean
  passwordedOnly: boolean
  ratedOnly: boolean
  unratedOnly: boolean
  spectatorsOnly: boolean
  aiSeatsOnly: boolean
  hideIgnored: boolean
  sort: 'desktop' | 'newest' | 'oldest'
}

export const INITIAL_TABLE_FILTERS: TableFilters = {
  searchQuery: '',
  format: 'ALL',
  availability: 'all',
  mode: 'all',
  tourneyKind: 'all',
  skill: 'all',
  hidePassworded: false,
  passwordedOnly: false,
  ratedOnly: false,
  unratedOnly: false,
  spectatorsOnly: false,
  aiSeatsOnly: false,
  hideIgnored: false,
  sort: 'desktop',
}

/**
 * Normalizes mutually exclusive pairs (filters saved by earlier versions could
 * carry both flags set to true, which guaranteed an empty list).
 * On conflict the "Only" filter wins, since it is the more specific one.
 */
export function sanitizeTableFilters(f: TableFilters): TableFilters {
  const next = { ...f }
  if (next.hidePassworded && next.passwordedOnly) next.hidePassworded = false
  if (next.ratedOnly && next.unratedOnly) next.unratedOnly = false
  return next
}

function hasFreeSeat(t: TableView): boolean {
  return t.seats?.some((s) => !s.playerName) ?? false
}

export const POPULAR_FORMATS: Array<{ id: string; label: string; family?: FormatFamily; labelKey?: 'filter_format_limited' }> = [
  { id: 'ALL', label: 'Todos' },
  { id: 'Commander', label: 'Commander', family: 'commander' },
  { id: 'Modern', label: 'Modern', family: 'modern' },
  { id: 'Pioneer', label: 'Pioneer', family: 'pioneer' },
  { id: 'Standard', label: 'Standard', family: 'standard' },
  { id: 'Pauper', label: 'Pauper', family: 'pauper' },
  { id: 'Limited', label: 'Limitado', family: 'limited', labelKey: 'filter_format_limited' },
]

export type TableMode = '1v1' | 'multi' | 'tourney'

/** The mode bucket of a table (LBY-14): the filter and the card's mode icon read it. */
export function tableMode(t: Pick<TableView, 'isTournament' | 'gameType' | 'seats'>): TableMode {
  if (t.isTournament) return 'tourney'
  if (t.gameType?.toLowerCase().includes('duel') || t.seats?.length === 2) return '1v1'
  return 'multi'
}

export const OTHER_COMMON_FORMATS = [
  'Constructed - Legacy',
  'Constructed - Vintage',
  'Constructed - Brawl',
  'Constructed - Historic',
  'Constructed - Canadian Highlander',
  'Constructed - Penny Dreadful',
  'Constructed - Freeform',
  'Constructed - Premodern',
  'Constructed - Tiny Leaders',
]

type FormatFields = { deckType?: string; gameType?: string; limited?: boolean }

const FORMAT_CHIP_PATTERNS: Record<string, RegExp> = {
  Commander: /\b(?:commander|brawl)\b/i,
  Modern: /\bmodern\b/i,
  Pioneer: /\b(?:pioneer|explorer)\b/i,
  Standard: /\bstandard\b/i,
  Pauper: /\bpauper\b/i,
  Limited: /\b(?:limited|draft|sealed|cube)\b/i,
}

function matchesFormatChip(t: FormatFields, chip: string): boolean {
  if (chip === 'Commander' && /\bcommander\b/i.test(t.gameType ?? '')) return true
  if (chip === 'Limited' && t.limited === true) return true
  return FORMAT_CHIP_PATTERNS[chip].test(t.deckType ?? '')
}

function matchesFormat(t: FormatFields, format: string): boolean {
  if (Object.hasOwn(FORMAT_CHIP_PATTERNS, format)) return matchesFormatChip(t, format)
  const f = format.toLowerCase()
  return Boolean(t.deckType?.toLowerCase().includes(f) || t.gameType?.toLowerCase().includes(f))
}

export function dropdownFormats(deckTypes: string[]): string[] {
  const names = new Set<string>([...OTHER_COMMON_FORMATS, ...deckTypes])
  return [...names]
    .filter((name) => !Object.keys(FORMAT_CHIP_PATTERNS).some((chip) => matchesFormatChip({ deckType: name }, chip)))
    .sort()
}

export function filterTables(
  tables: TableView[],
  filters: TableFilters,
  ignored: string[] = [],
  myUsername?: string,
  stagingTableId?: string | null,
): TableView[] {
  const ignoredSet = new Set(ignored.map((u) => u.toLowerCase()))
  const list = tables.filter((t) => {
    // 1. Search Query (matches name, controller, formats, seats)
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim()
      const matchName = t.tableName?.toLowerCase().includes(q)
      const matchController = t.controllerName?.toLowerCase().includes(q)
      const matchGameType = t.gameType?.toLowerCase().includes(q)
      const matchDeckType = t.deckType?.toLowerCase().includes(q)
      const matchShort = t.additionalInfoShort?.toLowerCase().includes(q)
      const matchFull = t.additionalInfoFull?.toLowerCase().includes(q)
      const matchSeats = t.seats?.some((s) => s.playerName?.toLowerCase().includes(q))
      if (!matchName && !matchController && !matchGameType && !matchDeckType && !matchShort && !matchFull && !matchSeats) {
        return false
      }
    }

    // 2. Format
    if (filters.format !== 'ALL' && !matchesFormat(t, filters.format)) return false

    // 3. Availability
    if (filters.availability === 'open') {
      const isPending = t.tableState === 'WAITING' || t.tableState === 'READY_TO_START'
      const hasEmptySeat = t.seats?.some((s) => !s.playerName)
      if (!isPending || !hasEmptySeat) return false
    } else if (filters.availability === 'dueling') {
      const isPlaying = t.tableState === 'DUELING' || t.tableState === 'SIDEBOARDING'
      if (!isPlaying) return false
    }

    // 4. Mode
    if (filters.mode !== 'all' && tableMode(t) !== filters.mode) return false
    if (filters.mode === 'tourney') {
      const gt = t.gameType?.toLowerCase() ?? ''
      if (filters.tourneyKind === 'constructed' && !gt.includes('constructed')) return false
      if (filters.tourneyKind === 'limited' && !/booster|sealed|jumpstart/.test(gt)) return false
    }

    // 5. Skill Level
    if (filters.skill !== 'all') {
      if (t.skillLevel?.toUpperCase() !== filters.skill.toUpperCase()) return false
    }

    // 6. Modifiers
    if (filters.hidePassworded && t.passworded) return false
    if (filters.passwordedOnly && !t.passworded) return false
    if (filters.ratedOnly && !t.rated) return false
    if (filters.unratedOnly && t.rated) return false
    if (filters.spectatorsOnly && !t.spectatorsAllowed) return false
    if (filters.hideIgnored && ignoredSet.has(tableOwnerName(t).toLowerCase())) return false
    if (filters.aiSeatsOnly) {
      const hasAiSeat =
        (t.tableState === 'WAITING' || t.tableState === 'READY_TO_START') &&
        t.seats?.some((s) => !s.playerName && s.playerType && /COMPUTER|AI/i.test(s.playerType))
      if (!hasAiSeat) return false
    }

    return true
  })

  const byCreatedDesc = (a: TableView, b: TableView) => (b.createTime ?? 0) - (a.createTime ?? 0)
  if (filters.sort === 'newest') return list.sort(byCreatedDesc)
  if (filters.sort === 'oldest') return list.sort((a, b) => -byCreatedDesc(a, b))

  // Desktop default sort: Pin user's active tables first, then open seats, then newest
  if (myUsername || stagingTableId) {
    return list.sort((a, b) => {
      const aMine = Number(isMyTable(a, myUsername, stagingTableId) && a.tableState !== 'FINISHED')
      const bMine = Number(isMyTable(b, myUsername, stagingTableId) && b.tableState !== 'FINISHED')
      if (aMine !== bMine) return bMine - aMine
      return Number(hasFreeSeat(b)) - Number(hasFreeSeat(a)) || byCreatedDesc(a, b)
    })
  }
  return list.sort((a, b) => Number(hasFreeSeat(b)) - Number(hasFreeSeat(a)) || byCreatedDesc(a, b))
}

export function countActiveFilters(filters: TableFilters): number {
  let c = 0
  if (filters.searchQuery.trim()) c++
  if (filters.format !== 'ALL') c++
  if (filters.availability !== 'all') c++
  if (filters.mode !== 'all') c++
  if (filters.mode === 'tourney' && filters.tourneyKind !== 'all') c++
  if (filters.skill !== 'all') c++
  if (filters.hidePassworded) c++
  if (filters.passwordedOnly) c++
  if (filters.ratedOnly) c++
  if (filters.unratedOnly) c++
  if (filters.spectatorsOnly) c++
  if (filters.aiSeatsOnly) c++
  if (filters.hideIgnored) c++
  if (filters.sort !== 'desktop') c++
  return c
}

interface TableFilterBarProps {
  tables: TableView[]
  filters: TableFilters
  onChange: (newFilters: TableFilters) => void
  onReset: () => void
  className?: string
  /** Controls at the end of the search row (the active deck, the create menu). */
  trailing?: ReactNode
  /** Controls at the end of the filter row (the density toggle). */
  controlsEnd?: ReactNode
}

/** Filters that live behind the "Filters" button, so its badge counts only what is hidden. */
function countAdvancedFilters(filters: TableFilters): number {
  return countActiveFilters({ ...filters, searchQuery: '', format: 'ALL', availability: 'all', mode: 'all' })
    + (filters.mode === 'tourney' && filters.tourneyKind !== 'all' ? 1 : 0)
}

export default function TableFilterBar({ tables, filters, onChange, onReset, className, trailing, controlsEnd }: TableFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Count active tables per popular format
  const formatCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: tables.length }
    POPULAR_FORMATS.forEach((pf) => {
      if (pf.id === 'ALL') return
      counts[pf.id] = filterTables(tables, { ...INITIAL_TABLE_FILTERS, format: pf.id }).length
    })
    return counts
  }, [tables])

  const extraFormats = useMemo(
    () => dropdownFormats(tables.flatMap((t) => { const known = knownDeckType(t.deckType); return known ? [known] : [] })),
    [tables],
  )

  // Count active filters (excluding defaults)
  const activeCount = useMemo(() => countActiveFilters(filters), [filters])
  const advancedCount = useMemo(() => countAdvancedFilters(filters), [filters])

  const { t } = useTranslation()
  const isOtherFormatSelected = !POPULAR_FORMATS.some((p) => p.id === filters.format)

  return (
    <div className={`table-filter-bar-container${className ? ` ${className}` : ''}`}>
      <div className="tfb-row tfb-top-row">
        <div className="tfb-search-box">
          <span className="tfb-search-icon"><Icon name="search" size={14} /></span>
          <input
            type="text"
            className="tfb-search-input"
            placeholder={t('lobby.filter_search_placeholder')}
            value={filters.searchQuery}
            onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onChange({ ...filters, searchQuery: '' })
            }}
          />
          {filters.searchQuery && (
            <CloseButton
              variant="plain"
              size="sm"
              className="tfb-clear-search-btn"
              label={t('common.clear')}
              onClick={() => onChange({ ...filters, searchQuery: '' })}
            />
          )}
        </div>
        {trailing}
      </div>

      <div className="tfb-row tfb-controls-row">
        <div className="tfb-segment" role="group" aria-label={t('lobby', 'filter_status_label')}>
          <ChipButton active={filters.availability === 'all'} onClick={() => onChange({ ...filters, availability: 'all' })}>
            {t('common', 'all')}
          </ChipButton>
          <ChipButton activeTone="ok" active={filters.availability === 'open'} onClick={() => onChange({ ...filters, availability: 'open' })}>
            <span className="tfb-pill-dot open-dot" />
            {t('lobby', 'filter_status_open')}
          </ChipButton>
          <ChipButton active={filters.availability === 'dueling'} onClick={() => onChange({ ...filters, availability: 'dueling' })}>
            <Icon name="eye" size={13} /> {t('lobby.in_game')}
          </ChipButton>
        </div>

        <div className="tfb-segment" role="group" aria-label={t('lobby', 'filter_mode_label')}>
          <ChipButton active={filters.mode === 'all'} onClick={() => onChange({ ...filters, mode: 'all' })}>
            {t('lobby', 'filter_mode_all')}
          </ChipButton>
          <ChipButton active={filters.mode === '1v1'} onClick={() => onChange({ ...filters, mode: '1v1' })}>
            <Icon name="swords" size={13} /> {t('lobby', 'mode_1v1')}
          </ChipButton>
          <ChipButton active={filters.mode === 'multi'} onClick={() => onChange({ ...filters, mode: 'multi' })}>
            <Icon name="users" size={13} /> {t('lobby', 'create_tab_multi')}
          </ChipButton>
          <ChipButton active={filters.mode === 'tourney'} onClick={() => onChange({ ...filters, mode: 'tourney' })}>
            <Icon name="trophy" size={13} /> {t('lobby', 'tournament_badge')}
          </ChipButton>
        </div>

        <div className="tfb-format-chips" role="group" aria-label={t('lobby', 'filter_format_label')}>
          {POPULAR_FORMATS.map((pf) => {
            const count = formatCounts[pf.id] ?? 0
            const isActive = filters.format === pf.id
            return (
              <ChipButton
                activeTone="gold"
                active={isActive}
                key={pf.id}
                onClick={() => onChange({ ...filters, format: pf.id })}
              >
                {pf.family && <span className={`tfb-format-dot fmt-${pf.family}`} aria-hidden="true" />}
                <span className="tfb-chip-label">{pf.id === 'ALL' ? t('common.all') : pf.labelKey ? t('lobby', pf.labelKey) : pf.label}</span>
                <Chip size="xs">{count}</Chip>
              </ChipButton>
            )
          })}

          <div className="tfb-more-formats-wrap">
            <select
              className={`tfb-more-select ${isOtherFormatSelected ? 'active' : ''}`}
              aria-label={t('lobby', 'filter_more_formats')}
              value={isOtherFormatSelected ? filters.format : ''}
              onChange={(e) => {
                if (e.target.value) {
                  onChange({ ...filters, format: e.target.value })
                }
              }}
            >
              <option value="" disabled>
                {isOtherFormatSelected ? t('lobby', 'filter_selected_format', { format: filters.format }) : t('lobby', 'filter_more_formats')}
              </option>
              {extraFormats.map((fmt) => (
                <option key={fmt} value={fmt}>
                  {fmt.replace(/^Constructed - /, '')}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="tfb-segment-tail">
          <ChipButton
            active={showAdvanced}
            className="tfb-advanced-trigger"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
          >
            <Icon name="filter" size={13} /> {t('lobby', 'filters_more')}
            {advancedCount > 0 && <span className="tfb-active-badge">{advancedCount}</span>}
            <Icon name={showAdvanced ? 'chevronUp' : 'chevronDown'} size={12} />
          </ChipButton>
          {activeCount > 0 && (
            <Button variant="soft-danger" size="sm" onClick={onReset} title={t('lobby.filter_reset')}>
              {t('lobby.filter_reset')}
            </Button>
          )}
          {controlsEnd}
        </div>
      </div>

      {/* Row 3: Advanced Collapsible Drawer */}
      {showAdvanced && (
        <div className="tfb-advanced-drawer">
          {/* Sort group */}
          <div className="tfb-drawer-section">
            <span className="tfb-section-label">{t('lobby', 'filter_sort_label')}:</span>
            <div className="tfb-button-group">
              <ChipButton active={filters.sort === 'desktop'} onClick={() => onChange({ ...filters, sort: 'desktop' })}>
                {t('lobby', 'filter_sort_desktop')}
              </ChipButton>
              <ChipButton active={filters.sort === 'newest'} onClick={() => onChange({ ...filters, sort: 'newest' })}>
                {t('lobby', 'filter_sort_newest')}
              </ChipButton>
              <ChipButton active={filters.sort === 'oldest'} onClick={() => onChange({ ...filters, sort: 'oldest' })}>
                {t('lobby', 'filter_sort_oldest')}
              </ChipButton>
            </div>
          </div>

          {filters.mode === 'tourney' && (
            <div className="tfb-drawer-section">
              <span className="tfb-section-label">{t('lobby', 'tournament_badge')}:</span>
              <div className="tfb-button-group">
                <ChipButton active={filters.tourneyKind === 'all'} onClick={() => onChange({ ...filters, tourneyKind: 'all' })}>
                  {t('common', 'all')}
                </ChipButton>
                <ChipButton active={filters.tourneyKind === 'constructed'} onClick={() => onChange({ ...filters, tourneyKind: 'constructed' })}>
                  {t('lobby', 'filter_tourney_constructed')}
                </ChipButton>
                <ChipButton active={filters.tourneyKind === 'limited'} onClick={() => onChange({ ...filters, tourneyKind: 'limited' })}>
                  {t('lobby', 'filter_tourney_limited')}
                </ChipButton>
              </div>
            </div>
          )}

          {/* Skill group */}
          <div className="tfb-drawer-section">
            <span className="tfb-section-label">{t('lobby', 'create_field_skill')}:</span>
            <div className="tfb-button-group">
              <ChipButton active={filters.skill === 'all'} onClick={() => onChange({ ...filters, skill: 'all' })}>
                {t('common', 'all')}
              </ChipButton>
              <ChipButton active={filters.skill === 'BEGINNER'} onClick={() => onChange({ ...filters, skill: 'BEGINNER' })}>
                <Icon name="star" size={12} /> {t('lobby', 'create_skill_beginner')}
              </ChipButton>
              <ChipButton active={filters.skill === 'CASUAL'} onClick={() => onChange({ ...filters, skill: 'CASUAL' })}>
                <Icon name="star" size={12} /><Icon name="star" size={12} /> {t('lobby', 'create_skill_casual')}
              </ChipButton>
              <ChipButton active={filters.skill === 'SERIOUS'} onClick={() => onChange({ ...filters, skill: 'SERIOUS' })}>
                <Icon name="star" size={12} /><Icon name="star" size={12} /><Icon name="star" size={12} /> {t('lobby', 'create_skill_competitive')}
              </ChipButton>
            </div>
          </div>

          {/* Options & Access Checkboxes */}
          <div className="tfb-drawer-section tfb-switches-section">
            <span className="tfb-section-label">{t('lobby','create_tab_restrictions')}:</span>
            <div className="tfb-switches-grid">
              <Checkbox
               
                checked={filters.hidePassworded}
                onChange={(next) => onChange({ ...filters, hidePassworded: next, passwordedOnly: next ? false : filters.passwordedOnly })}
                icon="unlock"
                label={t('lobby','tag_private')}
              />

              <Checkbox
               
                checked={filters.passwordedOnly}
                onChange={(next) => onChange({ ...filters, passwordedOnly: next, hidePassworded: next ? false : filters.hidePassworded })}
                icon="lock"
                label={t('lobby', 'filter_passworded_only')}
              />

              <Checkbox
               
                checked={filters.ratedOnly}
                onChange={(next) => onChange({ ...filters, ratedOnly: next, unratedOnly: next ? false : filters.unratedOnly })}
                icon="medal"
                label={t('lobby', 'tag_rated')}
              />

              <Checkbox
               
                checked={filters.unratedOnly}
                onChange={(next) => onChange({ ...filters, unratedOnly: next, ratedOnly: next ? false : filters.ratedOnly })}
                icon="medal"
                label={t('lobby', 'filter_unrated_only')}
              />

              <Checkbox
               
                checked={filters.spectatorsOnly}
                onChange={(next) => onChange({ ...filters, spectatorsOnly: next })}
                icon="eye"
                label={t('lobby','create_field_spectators')}
              />

              <Checkbox
               
                checked={filters.aiSeatsOnly}
                onChange={(next) => onChange({ ...filters, aiSeatsOnly: next })}
                icon="bot"
                label={t('lobby', 'ai')}
              />

              <Checkbox
               
                checked={filters.hideIgnored}
                onChange={(next) => onChange({ ...filters, hideIgnored: next })}
                icon="ban"
                label={t('lobby', 'filter_hide_ignored')}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
