import { useRef, useState } from 'react'
import type { DeckCard } from '../lobby/decks'
import type { DeckV2 } from './types'
import { deckInitials } from './types'
import { ALL_FORMATS, FORMAT_CONFIGS } from './formatRules'
import type { ValidationIssue } from './formatRules'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import './ArenaDeckHeader.css'

export function ArenaDeckHeader({
  name,
  onNameChange,
  format,
  onFormatChange,
  coverArtUrl,
  mainCount,
  sideCount,
  issues = [],
  layout,
  onToggleLayout,
  isCurveOpen,
  onToggleCurve,
  onOpenInspector,
}: {
  name: string
  onNameChange: (name: string) => void
  format: DeckV2['format']
  onFormatChange: (format: DeckV2['format']) => void
  coverArtUrl?: string | null
  mainCount: number
  sideCount: number
  cards?: DeckCard[]
  metaMap?: Map<string, number>
  issues?: ValidationIssue[]
  layout: 'vertical' | 'horizontal'
  onToggleLayout: () => void
  isCurveOpen?: boolean
  onToggleCurve?: () => void
  onOpenInspector?: () => void
}) {
  const { t } = useTranslation()
  const [showIssues, setShowIssues] = useState(false)
  const [issuesPos, setIssuesPos] = useState<{ x: number; y: number } | null>(null)
  const countRef = useRef<HTMLButtonElement>(null)
  const config = FORMAT_CONFIGS[format] ?? FORMAT_CONFIGS.Freeform
  const requiredCount = config.minMain
  const hasErrors = issues.some((i) => i.severity === 'error')
  const isValid = !hasErrors && mainCount >= requiredCount

  const errorTooltip = issues.length > 0
    ? issues.map((i) => `• ${i.message}`).join('\n')
    : undefined

  const toggleIssues = () => {
    if (showIssues) {
      setShowIssues(false)
      return
    }
    const rect = countRef.current?.getBoundingClientRect()
    if (rect) {
      setIssuesPos({
        x: Math.max(8, Math.min(rect.left, window.innerWidth - 360)),
        y: rect.bottom + 6,
      })
    }
    setShowIssues(true)
  }

  return (
    <div
      className="arena-deck-header"
      onDoubleClick={onOpenInspector}
      title={onOpenInspector ? t('decks', 'inspect_double_click') : undefined}
    >
      {/* Background artwork */}
      {coverArtUrl && (
        <div
          className="deck-header-bg-art"
          style={{ backgroundImage: `url(${coverArtUrl})` }}
        />
      )}
      <div className="deck-header-gradient" />

      {/* Cover Card Art Thumbnail */}
      <div className="deck-header-cover-box">
        {coverArtUrl ? (
          <img src={coverArtUrl} alt={name} className="deck-header-cover-img" />
        ) : (
          <div className="deck-header-cover-fallback">
            {name.trim() ? deckInitials(name) : 'MTG'}
          </div>
        )}
      </div>

      {/* Deck Info & Name */}
      <div className="deck-header-info">
        <div className="deck-header-name-row">
          <input
            className="deck-header-name-input builder-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t('decks', 'builder_deck_name_placeholder')}
            aria-label={t('decks', 'builder_deck_name_placeholder')}
            title={t('decks', 'builder_deck_name_placeholder')}
            onDoubleClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="deck-header-meta-row">
          {issues.length > 0 ? (
            <button
              type="button"
              ref={countRef}
              className={`deck-header-count has-issues ${isValid ? 'valid' : 'invalid'}`}
              onClick={toggleIssues}
              aria-expanded={showIssues}
              aria-describedby={showIssues ? 'deck-header-issues' : undefined}
              title={errorTooltip}
            >
              {mainCount}/{requiredCount} {t('decks', 'total_cards')}{' '}
              {sideCount > 0 && t('lobby', 'join_sb_suffix', { count: sideCount })}
              <span className="deck-header-count-alert"><Icon name="alert" size={12} /></span>
            </button>
          ) : (
            <span className={`deck-header-count ${isValid ? 'valid' : 'invalid'}`}>
              {mainCount}/{requiredCount} {t('decks', 'total_cards')}{' '}
              {sideCount > 0 && t('lobby', 'join_sb_suffix', { count: sideCount })}
            </span>
          )}
          <select
            value={format}
            onChange={(e) => onFormatChange(e.target.value as DeckV2['format'])}
            className="deck-header-format-select builder-format"
            onDoubleClick={(e) => e.stopPropagation()}
          >
            {ALL_FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          {showIssues && issues.length > 0 && issuesPos && (
            <div
              className="deck-header-issues"
              id="deck-header-issues"
              role="region"
              aria-label={t('decks', 'builder_legality_issues')}
              style={{ left: `${issuesPos.x}px`, top: `${issuesPos.y}px` }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setShowIssues(false)
              }}
            >
              <div className="deck-header-issues-title">
                <Icon name="alert" size={12} /> {t('decks', 'builder_legality_issues')}
              </div>
              <ul>
                {issues.map((issue, idx) => (
                  <li key={`${issue.type}-${idx}`} className={`is-${issue.severity}`}>
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Right Controls: Stats/Curve Toggle + Layout Switch */}
      <div className="deck-header-right">
        {/* Toggle Mana Curve Panel Button */}
        {(onToggleCurve || onOpenInspector) && (
          <button
            type="button"
            className={`deck-header-stats-btn ${isCurveOpen ? 'active' : ''}`}
            onClick={onToggleCurve ?? onOpenInspector}
            aria-pressed={!!isCurveOpen}
            title={isCurveOpen ? t('decks', 'builder_hide_curve') : t('decks', 'builder_show_curve')}
          >
            <Icon name="chart" size={15} />
          </button>
        )}

        {/* Change Deck Layout Toggle Button */}
        <button
          type="button"
          className={`deck-header-layout-btn ${layout === 'horizontal' ? 'active' : ''}`}
          onClick={onToggleLayout}
          aria-pressed={layout === 'horizontal'}
          title={layout === 'vertical' ? t('decks', 'builder_layout_horizontal') : t('decks', 'builder_layout_vertical')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            {layout === 'vertical' ? (
              <path d="M3 4h8v16H3V4zm10 0h8v16h-8V4z" />
            ) : (
              <path d="M3 4h18v7H3V4zm0 9h18v7H3v-7z" />
            )}
          </svg>
        </button>
      </div>
    </div>
  )
}
