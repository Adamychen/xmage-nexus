import { useState, useMemo } from 'react'
import CloseButton from '../ui/CloseButton'
import Button from '../ui/Button'
import ChipButton from '../ui/ChipButton'
import Chip from '../ui/Chip'
import Checkbox from '../ui/Checkbox'
import type { TableView } from '../net/types'
import Icon, { type IconName } from '../ui/Icon'
import { useTranslation } from '../i18n'
import { isMyTable } from './lobbyUtils'
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

export function tableOwnerName(t: TableView): string {
  return (t.controllerName ?? '').split(',')[0].trim()
}

/**
 * Normaliza pares mutuamente excluyentes (filtros guardados de versiones
 * anteriores podían traer ambos a true y garantizaban lista vacía).
 * En conflicto gana el "Only", que es el más específico.
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

export const POPULAR_FORMATS: Array<{ id: string; label: string; icon: IconName; labelKey?: 'filter_format_limited' }> = [
  { id: 'ALL', label: 'Todos', icon: 'globe' },
  { id: 'Commander', label: 'Commander', icon: 'crown' },
  { id: 'Modern', label: 'Modern', icon: 'zap' },
  { id: 'Pioneer', label: 'Pioneer', icon: 'shield' },
  { id: 'Standard', label: 'Standard', icon: 'scrollText' },
  { id: 'Pauper', label: 'Pauper', icon: 'gem' },
  { id: 'Limited', label: 'Limitado', icon: 'package', labelKey: 'filter_format_limited' },
]

export const OTHER_COMMON_FORMATS = [
  'Constructed - Legacy',
  'Constructed - Vintage',
  'Constructed - Brawl',
  'Constructed - Historic',
  'Constructed - Canadian Highlander',
  'Constructed - Penny Dreadful',
  'Constructed - Freeform',
  'Constructed - Tiny Leaders',
]

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
    if (filters.format !== 'ALL') {
      const f = filters.format.toLowerCase()
      if (filters.format === 'Commander') {
        const isComm =
          t.deckType?.toLowerCase().includes('commander') ||
          t.gameType?.toLowerCase().includes('commander') ||
          t.deckType?.toLowerCase().includes('brawl')
        if (!isComm) return false
      } else if (filters.format === 'Modern') {
        if (!t.deckType?.toLowerCase().includes('modern')) return false
      } else if (filters.format === 'Pioneer') {
        if (!t.deckType?.toLowerCase().includes('pioneer') && !t.deckType?.toLowerCase().includes('explorer')) return false
      } else if (filters.format === 'Standard') {
        if (!t.deckType?.toLowerCase().includes('standard')) return false
      } else if (filters.format === 'Pauper') {
        if (!t.deckType?.toLowerCase().includes('pauper')) return false
      } else if (filters.format === 'Limited') {
        const isLim =
          t.limited === true ||
          t.deckType?.toLowerCase().includes('draft') ||
          t.deckType?.toLowerCase().includes('sealed') ||
          t.deckType?.toLowerCase().includes('cube')
        if (!isLim) return false
      } else {
        if (!t.deckType?.toLowerCase().includes(f) && !t.gameType?.toLowerCase().includes(f)) return false
      }
    }

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
    if (filters.mode === '1v1') {
      const is1v1 = !t.isTournament && (t.gameType?.toLowerCase().includes('duel') || (t.seats && t.seats.length === 2))
      if (!is1v1) return false
    } else if (filters.mode === 'multi') {
      const isMulti =
        !t.isTournament &&
        ((t.seats && t.seats.length > 2) ||
          t.gameType?.toLowerCase().includes('free for all') ||
          t.gameType?.toLowerCase().includes('giant'))
      if (!isMulti) return false
    } else if (filters.mode === 'tourney') {
      if (!t.isTournament) return false
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
}

export default function TableFilterBar({ tables, filters, onChange, onReset, className }: TableFilterBarProps) {
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

  // Extract all formats present in currently loaded tables
  const extraFormats = useMemo(() => {
    const list = new Set<string>(OTHER_COMMON_FORMATS)
    tables.forEach((t) => {
      if (t.deckType) list.add(t.deckType)
    })
    return Array.from(list)
      .filter((f) => {
        const lower = f.toLowerCase()
        return (
          !lower.includes('commander') &&
          !lower.includes('modern') &&
          !lower.includes('pioneer') &&
          !lower.includes('standard') &&
          !lower.includes('pauper') &&
          !lower.includes('draft') &&
          !lower.includes('sealed') &&
          !lower.includes('cube')
        )
      })
      .sort()
  }, [tables])

  // Count active filters (excluding defaults)
  const activeCount = useMemo(() => countActiveFilters(filters), [filters])

  const { t } = useTranslation()
  const isOtherFormatSelected = !POPULAR_FORMATS.some((p) => p.id === filters.format)

  return (
    <div className={`table-filter-bar-container${className ? ` ${className}` : ''}`}>
      {/* Row 1: Search & Quick Status Toggles */}
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

        <div className="tfb-quick-toggles">
          <ChipButton
            activeTone="ok"
            active={filters.availability === 'open'}
            onClick={() =>
              onChange({
                ...filters,
                availability: filters.availability === 'open' ? 'all' : 'open',
              })
            }
            title={t('lobby.filter_only_open')}
          >
            <span className="tfb-pill-dot open-dot" />
            <span>{t('lobby.filter_only_open')}</span>
          </ChipButton>

          <ChipButton
            activeTone="ok"
            active={filters.availability === 'dueling'}
            onClick={() =>
              onChange({
                ...filters,
                availability: filters.availability === 'dueling' ? 'all' : 'dueling',
              })
            }
            title={t('lobby.in_game')}
          >
            <span><Icon name="eye" size={13} /> {t('lobby.in_game')}</span>
          </ChipButton>

          <ChipButton
            active={showAdvanced || activeCount > 0}
            className="tfb-advanced-trigger"
            onClick={() => setShowAdvanced((v) => !v)}
            title={t('common', 'settings')}
          >
            <span><Icon name="settings" size={13} /> {t('common', 'settings')}</span>
            {activeCount > 0 && <span className="tfb-active-badge">{activeCount}</span>}
            <span className="tfb-arrow-icon">{showAdvanced ? '▴' : '▾'}</span>
          </ChipButton>

          {activeCount > 0 && (
            <Button variant="soft-danger" size="sm"
              onClick={onReset}
              title={t('lobby.filter_reset')}>
              <span>{t('lobby.filter_reset')}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Row 2: Format Pills Strip */}
      <div className="tfb-row tfb-formats-row">
        <div className="tfb-format-chips">
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
                <span className="tfb-chip-icon"><Icon name={pf.icon} size={13} /></span>
                <span className="tfb-chip-label">{pf.id === 'ALL' ? t('common.all') : pf.labelKey ? t('lobby', pf.labelKey) : pf.label}</span>
                <Chip size="xs">{count}</Chip>
              </ChipButton>
            )
          })}

          {/* More Formats Dropdown */}
          <div className="tfb-more-formats-wrap">
            <select
              className={`tfb-more-select ${isOtherFormatSelected ? 'active' : ''}`}
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

          {/* Mode group */}
          <div className="tfb-drawer-section">
            <span className="tfb-section-label">{t('game', 'combat')}:</span>
            <div className="tfb-button-group">
              <ChipButton active={filters.mode === 'all'} onClick={() => onChange({ ...filters, mode: 'all' })}>
                {t('common', 'all')}
              </ChipButton>
              <ChipButton active={filters.mode === '1v1'} onClick={() => onChange({ ...filters, mode: '1v1' })}>
                <Icon name="swords" size={13} /> 1v1
              </ChipButton>
              <ChipButton active={filters.mode === 'multi'} onClick={() => onChange({ ...filters, mode: 'multi' })}>
                <Icon name="users" size={13} /> {t('lobby', 'create_tab_multi')}
              </ChipButton>
              <ChipButton active={filters.mode === 'tourney'} onClick={() => onChange({ ...filters, mode: 'tourney' })}>
                <Icon name="trophy" size={13} /> {t('lobby', 'tournament_badge')}
              </ChipButton>
            </div>
            {filters.mode === 'tourney' && (
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
            )}
          </div>

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
