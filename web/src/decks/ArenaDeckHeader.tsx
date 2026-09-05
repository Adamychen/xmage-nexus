import type { DeckCard } from '../lobby/decks'
import type { DeckV2 } from './types'
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
  const config = FORMAT_CONFIGS[format] ?? FORMAT_CONFIGS.Freeform
  const requiredCount = config.minMain
  const hasErrors = issues.some((i) => i.severity === 'error')
  const isValid = !hasErrors && mainCount >= requiredCount

  const errorTooltip = issues.length > 0
    ? issues.map((i) => `• ${i.message}`).join('\n')
    : undefined

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
            {name.slice(0, 2).toUpperCase() || 'MTG'}
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
            placeholder={t('decks', 'import_placeholder')}
            title={t('decks', 'builder_editor')}
          />
        </div>
        <div className="deck-header-meta-row">
          <span
            className={`deck-header-count ${isValid ? 'valid' : 'invalid'}`}
            title={errorTooltip}
          >
            {mainCount}/{requiredCount} {t('decks', 'total_cards')} {sideCount > 0 && `(SB: ${sideCount})`}
            {issues.length > 0 && (
              <span style={{ marginLeft: '4px', cursor: 'help' }}><Icon name="alert" size={12} /></span>
            )}
          </span>
          <select
            value={format}
            onChange={(e) => onFormatChange(e.target.value as DeckV2['format'])}
            className="deck-header-format-select builder-format"
            title={config.description}
          >
            {ALL_FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
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
            title={`${t('decks', 'builder_mana_curve')}${onOpenInspector ? ' (' + t('decks', 'inspect_double_click') + ')' : ''}`}
            onDoubleClick={onOpenInspector}
          >
            <Icon name="chart" size={15} />
          </button>
        )}

        {/* Change Deck Layout Toggle Button */}
        <button
          type="button"
          className={`deck-header-layout-btn ${layout === 'horizontal' ? 'active' : ''}`}
          onClick={onToggleLayout}
          title={t('decks', 'builder_editor')}
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
