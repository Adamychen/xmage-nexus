import { useId, useRef, useState } from 'react'
import type { DeckV2 } from './types'
import { deckInitials } from './types'
import { ALL_FORMATS, FORMAT_CONFIGS } from './formatRules'
import type { ValidationIssue } from './formatRules'
import type { DeckExportKind } from './exportDeckFile'
import { DeckExportDialog } from './DeckExportDialog'
import Button from '../ui/Button'
import DropdownMenu from '../ui/DropdownMenu'
import MenuItem from '../ui/MenuItem'
import LanguageSelector from '../i18n/LanguageSelector'
import { useTranslation } from '../i18n'
import './DeckEditorTopBar.css'

export interface DeckEditorTopBarProps {
  name: string
  onNameChange: (name: string) => void
  format: DeckV2['format']
  onFormatChange: (format: DeckV2['format']) => void
  coverArtUrl?: string | null
  mainCount: number
  sideCount: number
  issues: ValidationIssue[]
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  onRetrySave: () => void
  onBack: () => void
  deck: DeckV2
  isEquipped: boolean
  onImport: () => void
  onSample: () => void
  onEquip: () => void
  onDone: () => void
}

export const EXPORT_KINDS: { kind: DeckExportKind; label: string; icon: 'save' | 'clipboard' | 'file' }[] = [
  { kind: 'dck', label: '.dck', icon: 'save' },
  { kind: 'arena', label: 'Arena', icon: 'clipboard' },
  { kind: 'txt', label: 'Plain', icon: 'file' },
  { kind: 'dek', label: '.dek', icon: 'file' },
]

export function legalityOf(format: DeckV2['format'], mainCount: number, issues: ValidationIssue[]): { isValid: boolean; shortBy: number; message: string | undefined } {
  const config = FORMAT_CONFIGS[format] ?? FORMAT_CONFIGS.Freeform
  const shortBy = config.minMain - mainCount
  const firstError = issues.find((i) => i.severity === 'error')
  const isValid = !firstError && shortBy <= 0
  return { isValid, shortBy, message: (firstError ?? issues[0])?.message }
}

export function DeckEditorTopBar({
  name,
  onNameChange,
  format,
  onFormatChange,
  coverArtUrl,
  mainCount,
  sideCount,
  issues,
  saveState,
  onRetrySave,
  onBack,
  deck,
  isEquipped,
  onImport,
  onSample,
  onEquip,
  onDone,
}: DeckEditorTopBarProps) {
  const { t } = useTranslation()
  const issuesId = useId()
  const chipRef = useRef<HTMLButtonElement>(null)
  const [issuesPos, setIssuesPos] = useState<{ x: number; y: number } | null>(null)

  const legality = legalityOf(format, mainCount, issues)
  const isValid = legality.isValid
  const chipText = isValid ? t('decks', 'legal_in', { format }) : legality.shortBy > 0 ? t('decks', 'cards_short', { n: legality.shortBy }) : legality.message
  const chipTitle = issues.length > 0 ? issues.map((i) => `• ${i.message}`).join('\n') : undefined
  const showIssues = issuesPos !== null && issues.length > 0

  const toggleIssues = () => {
    if (issuesPos) {
      setIssuesPos(null)
      return
    }
    const rect = chipRef.current?.getBoundingClientRect()
    if (!rect) return
    setIssuesPos({
      x: Math.max(8, Math.min(rect.left, window.innerWidth - 360)),
      y: rect.bottom + 6,
    })
  }

  const [exportKind, setExportKind] = useState<DeckExportKind | null>(null)

  const chipClass = `deck-editor-legality ${isValid ? 'is-valid' : 'is-invalid'}`

  return (
    <header className="deck-editor-topbar">
      <div className="deck-editor-identity">
        <Button variant="subtle" size="sm" icon="chevronLeft" className="deck-editor-back builder-back" onClick={onBack}>
          {t('decks', 'my_decks')}
        </Button>

        <div className="deck-editor-cover" aria-hidden="true">
          {coverArtUrl ? (
            <img src={coverArtUrl} alt="" className="deck-editor-cover-img" />
          ) : (
            <span className="deck-editor-cover-fallback">{name.trim() ? deckInitials(name) : 'MTG'}</span>
          )}
        </div>

        <div className="deck-editor-title">
          <input
            className="deck-editor-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t('decks', 'builder_deck_name_placeholder')}
            aria-label={t('decks', 'builder_deck_name_placeholder')}
            title={t('decks', 'builder_deck_name_placeholder')}
          />

          <div className="deck-editor-meta">
            <select
              value={format}
              onChange={(e) => onFormatChange(e.target.value as DeckV2['format'])}
              className="deck-editor-format"
              aria-label={t('lobby', 'filter_format_label')}
            >
              {ALL_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            {issues.length > 0 ? (
              <button
                type="button"
                ref={chipRef}
                className={chipClass}
                onClick={toggleIssues}
                aria-expanded={showIssues}
                aria-controls={showIssues ? issuesId : undefined}
                title={chipTitle}
              >
                {chipText}
              </button>
            ) : (
              <span className={chipClass}>{chipText}</span>
            )}

            <span className="deck-editor-counts">
              {mainCount} {t('decks', 'zone_main')} · {sideCount} {t('decks', 'sideboard')}
            </span>

            <div className="deck-editor-save" role="status" aria-live="polite">
              {saveState === 'error' && (
                <button type="button" className="deck-editor-save-retry" onClick={onRetrySave}>
                  {t('decks', 'save_failed_retry')}
                </button>
              )}
              {(saveState === 'saving' || saveState === 'saved') && (
                <span className="deck-editor-save-text">
                  {saveState === 'saving' ? t('decks', 'builder_saving') : t('decks', 'builder_saved')}
                </span>
              )}
            </div>
          </div>

          {showIssues && (
            <div
              className="deck-editor-issues"
              id={issuesId}
              role="region"
              aria-label={t('decks', 'builder_legality_issues')}
              style={{ left: `${issuesPos.x}px`, top: `${issuesPos.y}px` }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIssuesPos(null)
              }}
            >
              <div className="deck-editor-issues-title">{t('decks', 'builder_legality_issues')}</div>
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

      <div className="deck-editor-actions">
        <DropdownMenu
          label={t('decks', 'export_deck')}
          icon="download"
          direction="down"
          align="end"
          className="deck-editor-export"
          data-testid="deck-editor-export"
        >
          {EXPORT_KINDS.map((item) => (
            <MenuItem key={item.kind} role="menuitem" icon={item.icon} onClick={() => setExportKind(item.kind)}>
              {item.label}
            </MenuItem>
          ))}
        </DropdownMenu>
        <Button variant="subtle" size="sm" icon="download" onClick={onImport} title={t('decks', 'import_hint')}>
          {t('decks', 'import_deck')}
        </Button>
        <Button variant="subtle" size="sm" icon="hand" onClick={onSample} title={t('decks', 'sample_london')}>
          {t('decks', 'builder_sample')}
        </Button>
        <Button
          variant={isEquipped ? 'success' : 'secondary'}
          size="sm"
          className={`deck-editor-equip${isEquipped ? ' is-equipped' : ''}`}
          onClick={onEquip}
          disabled={isEquipped}
          title={isEquipped ? t('decks', 'builder_equipped') : t('decks', 'builder_equip')}
        >
          {isEquipped ? `✓ ${t('decks', 'builder_equipped')}` : t('decks', 'builder_equip')}
        </Button>
        <Button variant="primary" size="sm" className="deck-editor-done" data-testid="builder-done" onClick={onDone}>
          {t('common', 'done')}
        </Button>
        <LanguageSelector compact showCardLangToggle />
      </div>
      {exportKind && <DeckExportDialog deck={deck} kind={exportKind} onClose={() => setExportKind(null)} />}
    </header>
  )
}
