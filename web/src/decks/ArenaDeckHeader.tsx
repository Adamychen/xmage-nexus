import type { DeckCard } from '../lobby/decks'
import type { DeckV2 } from './types'
import { ALL_FORMATS, FORMAT_CONFIGS } from './formatRules'
import type { ValidationIssue } from './formatRules'
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
  cards,
  metaMap,
  issues = [],
  layout,
  onToggleLayout,
}: {
  name: string
  onNameChange: (name: string) => void
  format: DeckV2['format']
  onFormatChange: (format: DeckV2['format']) => void
  coverArtUrl?: string | null
  mainCount: number
  sideCount: number
  cards: DeckCard[]
  metaMap: Map<string, number>
  issues?: ValidationIssue[]
  layout: 'vertical' | 'horizontal'
  onToggleLayout: () => void
}) {
  // Compute mana curve buckets
  const buckets = Array(8).fill(0) as number[]
  let maxBucket = 0
  for (const c of cards) {
    const key = `${c.setCode}/${c.cardNumber}`
    const cmc = metaMap.get(key) ?? metaMap.get(c.cardName.toLowerCase()) ?? 0
    const idx = cmc >= 7 ? 7 : cmc
    buckets[idx] += c.amount
    maxBucket = Math.max(maxBucket, buckets[idx])
  }
  if (maxBucket === 0) maxBucket = 1

  const { t } = useTranslation()
  const config = FORMAT_CONFIGS[format] ?? FORMAT_CONFIGS.Freeform
  const requiredCount = config.minMain
  const hasErrors = issues.some((i) => i.severity === 'error')
  const isValid = !hasErrors && mainCount >= requiredCount

  const errorTooltip = issues.length > 0
    ? issues.map((i) => `• ${i.message}`).join('\n')
    : undefined

  return (
    <div className="arena-deck-header">
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
              <span style={{ marginLeft: '4px', cursor: 'help' }}>⚠️</span>
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

      {/* Mini Mana Curve Histogram */}
      <div className="deck-header-curve" title={t('decks', 'builder_mana_curve')}>
        {buckets.map((v, i) => {
          const heightPercent = Math.max(8, (v / maxBucket) * 100)
          return (
            <div key={i} className="mini-curve-bar-wrapper">
              <div
                className="mini-curve-bar"
                style={{ height: `${heightPercent}%` }}
                title={`CMC ${i === 7 ? '7+' : i}: ${v} ${t('decks', 'total_cards')}`}
              />
              <span className="mini-curve-label">{i === 7 ? '7+' : i}</span>
            </div>
          )
        })}
      </div>

      {/* Change Deck Layout Toggle Button */}
      <button
        type="button"
        className={`deck-header-layout-btn ${layout === 'horizontal' ? 'active' : ''}`}
        onClick={onToggleLayout}
        title={t('decks', 'builder_editor')}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          {layout === 'vertical' ? (
            <path d="M3 4h8v16H3V4zm10 0h8v16h-8V4z" />
          ) : (
            <path d="M3 4h18v7H3V4zm0 9h18v7H3v-7z" />
          )}
        </svg>
      </button>
    </div>
  )
}
