import { useId, useLayoutEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { DeckV2 } from './types'
import { ALL_FORMATS } from './formatRules'
import type { ValidationIssue } from './formatRules'
import type { DeckExportKind } from './exportDeckFile'
import { DeckExportDialog } from './DeckExportDialog'
import { EXPORT_KINDS, legalityOf } from './DeckEditorTopBar'
import { CardSizeSlider } from './CardSizeSlider'
import { canSeparateCreatures } from './stackColumns'
import { DECK_STACKS_SCALE_MAX, DECK_STACKS_SCALE_MIN, DECK_STACKS_SCALE_STEP } from './stacksScale'
import type { DeckEditorView, DeckStacksCopies, DeckStacksGroup, DeckStacksSort } from '../state/persistence'
import Button from '../ui/Button'
import ChipButton from '../ui/ChipButton'
import CloseButton from '../ui/CloseButton'
import DropdownMenu from '../ui/DropdownMenu'
import IconButton from '../ui/IconButton'
import MenuItem from '../ui/MenuItem'
import Modal from '../ui/Modal'
import Tabs from '../ui/Tabs'
import { useTranslation } from '../i18n'
import './DeckEditorPhone.css'

export type PhoneZone = 'main' | 'side'

const GROUPS: { value: DeckStacksGroup; key: 'group_type' | 'group_cmc' | 'group_color' | 'group_identity' | 'group_edh' | 'group_rarity' | 'group_free' }[] = [
  { value: 'type', key: 'group_type' },
  { value: 'cmc', key: 'group_cmc' },
  { value: 'color', key: 'group_color' },
  { value: 'rarity', key: 'group_rarity' },
  { value: 'identity', key: 'group_identity' },
  { value: 'edh', key: 'group_edh' },
  { value: 'free', key: 'group_free' },
]

export interface DeckEditorPhoneTopBarProps {
  name: string
  onNameChange: (name: string) => void
  format: DeckV2['format']
  onFormatChange: (format: DeckV2['format']) => void
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
  view: DeckEditorView
  onViewChange: (view: DeckEditorView) => void
  copies: DeckStacksCopies
  onCopiesChange: (copies: DeckStacksCopies) => void
  sort: DeckStacksSort
  onSortChange: (sort: DeckStacksSort) => void
  group: DeckStacksGroup
  separateCreatures: boolean
  onSeparateCreaturesChange: (separate: boolean) => void
  scale: number
  onScaleChange: (scale: number) => void
}

function MenuCaption({ children }: { children: ReactNode }) {
  return <div role="presentation" className="deck-phone-menu-caption">{children}</div>
}

export function DeckEditorPhoneTopBar({
  name,
  onNameChange,
  format,
  onFormatChange,
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
  view,
  onViewChange,
  copies,
  onCopiesChange,
  sort,
  onSortChange,
  group,
  separateCreatures,
  onSeparateCreaturesChange,
  scale,
  onScaleChange,
}: DeckEditorPhoneTopBarProps) {
  const { t, cardLang, setCardLanguage, cardLanguages } = useTranslation()
  const issuesId = useId()
  const [showIssues, setShowIssues] = useState(false)
  const legality = legalityOf(format, mainCount, issues)
  const piles = view === 'piles'
  const legalText = legality.isValid
    ? t('decks', 'legal_in', { format })
    : legality.shortBy > 0 ? t('decks', 'cards_short', { n: legality.shortBy }) : legality.message

  const [exportKind, setExportKind] = useState<DeckExportKind | null>(null)

  return (
    <header className="deck-phone-top">
      <div className="deck-phone-row">
        <IconButton className="builder-back" label={t('decks', 'my_decks')} icon="chevronLeft" size="md" onClick={onBack} />
        <input
          className="deck-phone-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t('decks', 'builder_deck_name_placeholder')}
          aria-label={t('decks', 'builder_deck_name_placeholder')}
        />
        <DropdownMenu
          label=""
          icon="ellipsis"
          hideChevron
          align="end"
          direction="down"
          aria-label={t('decks', 'editor_more')}
          className="deck-phone-more"
          data-testid="deck-editor-more"
        >
          <MenuItem role="menuitem" icon="download" onClick={onImport}>{t('decks', 'import_deck')}</MenuItem>
          <MenuCaption>{t('decks', 'export_deck')}</MenuCaption>
          {EXPORT_KINDS.map((item) => (
            <MenuItem key={item.kind} role="menuitem" icon={item.icon} onClick={() => setExportKind(item.kind)}>
              {item.label}
            </MenuItem>
          ))}
          <MenuItem role="menuitem" icon="hand" onClick={onSample}>{t('decks', 'builder_sample')}</MenuItem>
          <MenuItem role="menuitem" icon="crown" disabled={isEquipped} onClick={onEquip}>
            {isEquipped ? `✓ ${t('decks', 'builder_equipped')}` : t('decks', 'builder_equip')}
          </MenuItem>
          <MenuItem role="menuitem" icon="layers" onClick={() => onViewChange(piles ? 'list' : 'piles')}>
            {`${t('decks', 'editor_view')}: ${piles ? t('decks', 'editor_view_piles') : t('decks', 'editor_view_list')}`}
          </MenuItem>
          {piles && (
            <>
              <MenuItem role="menuitem" onClick={() => onCopiesChange(copies === 'separate' ? 'together' : 'separate')}>
                {`${t('decks', 'editor_copies')}: ${copies === 'separate' ? t('decks', 'copies_separate') : t('decks', 'copies_together')}`}
              </MenuItem>
              <MenuItem role="menuitem" onClick={() => onSortChange(sort === 'cmc' ? 'name' : 'cmc')}>
                {`${t('decks', 'editor_sort')}: ${sort === 'cmc' ? t('decks', 'sort_cmc') : t('decks', 'sort_name')}`}
              </MenuItem>
              {canSeparateCreatures(group) && (
                <MenuItem
                  role="menuitemcheckbox"
                  aria-checked={separateCreatures}
                  selected={separateCreatures}
                  onClick={() => onSeparateCreaturesChange(!separateCreatures)}
                >
                  {t('decks', 'toggle_separate_creatures')}
                </MenuItem>
              )}
              <div className="deck-phone-menu-size" onClick={(e) => e.stopPropagation()}>
                <CardSizeSlider
                  value={scale}
                  min={DECK_STACKS_SCALE_MIN}
                  max={DECK_STACKS_SCALE_MAX}
                  step={DECK_STACKS_SCALE_STEP}
                  onChange={onScaleChange}
                />
              </div>
            </>
          )}
          <MenuCaption>{t('common', 'card_language')}</MenuCaption>
          {cardLanguages.map((cl) => (
            <MenuItem
              key={cl.code}
              role="menuitem"
              selected={cl.code === cardLang}
              onClick={() => setCardLanguage(cl.code)}
            >
              {`${cl.flag} ${cl.name}`}
            </MenuItem>
          ))}
        </DropdownMenu>
      </div>

      <div className="deck-phone-status">
        <select
          value={format}
          onChange={(e) => onFormatChange(e.target.value as DeckV2['format'])}
          className="deck-phone-format"
          aria-label={t('lobby', 'filter_format_label')}
        >
          {ALL_FORMATS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <span className="deck-phone-counts">{`${mainCount} ${t('decks', 'zone_main')} · ${sideCount} ${t('decks', 'sideboard')}`}</span>
        <span className={`deck-phone-legal ${legality.isValid ? 'is-valid' : 'is-invalid'}`}>{legalText}</span>
        {issues.length > 0 && (
          <IconButton
            label={t('decks', 'builder_legality_issues')}
            icon="alert"
            size="sm"
            aria-expanded={showIssues}
            aria-controls={showIssues ? issuesId : undefined}
            onClick={() => setShowIssues((open) => !open)}
          />
        )}
        <span className="deck-phone-save" role="status" aria-live="polite">
          {saveState === 'error' ? (
            <Button size="sm" variant="danger" onClick={onRetrySave}>{t('decks', 'save_failed_retry')}</Button>
          ) : saveState === 'saving' ? t('decks', 'builder_saving') : saveState === 'saved' ? t('decks', 'builder_saved') : null}
        </span>
      </div>

      {showIssues && issues.length > 0 && (
        <ul id={issuesId} className="deck-phone-issues" aria-label={t('decks', 'builder_legality_issues')}>
          {issues.map((issue, idx) => (
            <li key={`${issue.type}-${idx}`} className={`is-${issue.severity}`}>{issue.message}</li>
          ))}
        </ul>
      )}
      {exportKind && <DeckExportDialog deck={deck} kind={exportKind} onClose={() => setExportKind(null)} />}
    </header>
  )
}

export function DeckEditorPhoneControls({
  zone,
  onZoneChange,
  group,
  onGroupChange,
}: {
  zone: PhoneZone
  onZoneChange: (zone: PhoneZone) => void
  group: DeckStacksGroup
  onGroupChange: (group: DeckStacksGroup) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="deck-phone-controls">
      <Tabs<PhoneZone>
        className="deck-phone-zone"
        variant="segmented"
        size="sm"
        value={zone}
        onChange={onZoneChange}
        items={[
          { id: 'main', label: t('decks', 'zone_main') },
          { id: 'side', label: t('decks', 'sideboard') },
        ]}
      />
      <div className="deck-phone-groups" role="group" aria-label={t('decks', 'editor_group')}>
        {GROUPS.map((g) => (
          <ChipButton
            key={g.value}
            size="sm"
            pill
            active={group === g.value}
            className="deck-phone-chip"
            onClick={() => onGroupChange(g.value)}
          >
            {t('decks', g.key)}
          </ChipButton>
        ))}
      </div>
    </div>
  )
}

export function useCreditsClearance(): number {
  const [clearance, setClearance] = useState(0)
  useLayoutEffect(() => {
    const footer = document.querySelector<HTMLElement>('.app-attribution')
    if (!footer) return
    const measure = () => setClearance(Math.ceil(footer.getBoundingClientRect().height))
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(footer)
    return () => observer.disconnect()
  }, [])
  return clearance
}

export function DeckEditorPhoneBottomBar({ onAddCards, onCurve, creditsClearance }: { onAddCards: () => void; onCurve: () => void; creditsClearance: number }) {
  const { t } = useTranslation()
  const style = { '--credits-clearance': `${creditsClearance}px` } as CSSProperties
  return (
    <div className="deck-phone-bar" style={style}>
      <Button variant="primary" icon="plus" className="deck-phone-add" onClick={onAddCards}>
        {t('decks', 'editor_add_cards')}
      </Button>
      <Button variant="secondary" icon="chart" className="deck-phone-curve" onClick={onCurve}>
        {t('decks', 'phone_curve')}
      </Button>
    </div>
  )
}

export function DeckEditorSheet({
  title,
  variant,
  testId,
  onClose,
  children,
}: {
  title: string
  variant: 'full' | 'bottom'
  testId: string
  onClose: () => void
  children: ReactNode
}) {
  const titleId = useId()
  return (
    <Modal
      backdropClassName={`deck-sheet-backdrop deck-sheet-backdrop--${variant}`}
      dialogClassName={`deck-sheet deck-sheet--${variant}`}
      labelledBy={titleId}
      testId={testId}
      onEscape={onClose}
      onBackdropClick={variant === 'bottom' ? onClose : undefined}
    >
      <header className="deck-sheet-head">
        <h2 id={titleId} className="deck-sheet-title">{title}</h2>
        <CloseButton size="md" className="deck-sheet-close" onClick={onClose} />
      </header>
      <div className="deck-sheet-body">{children}</div>
    </Modal>
  )
}
