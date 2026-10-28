import type { DeckEditorView, DeckStacksCopies, DeckStacksGroup, DeckStacksSort } from '../state/persistence'
import Button from '../ui/Button'
import { useTranslation } from '../i18n'
import { CardSizeSlider } from './CardSizeSlider'
import { canSeparateCreatures } from './stackColumns'
import { DECK_STACKS_SCALE_MAX, DECK_STACKS_SCALE_MIN, DECK_STACKS_SCALE_STEP } from './stacksScale'
import './DeckEditorToolbar.css'

export interface DeckEditorToolbarProps {
  drawerOpen: boolean
  onToggleDrawer: () => void
  view: DeckEditorView
  onViewChange: (view: DeckEditorView) => void
  group: DeckStacksGroup
  onGroupChange: (group: DeckStacksGroup) => void
  copies: DeckStacksCopies
  onCopiesChange: (copies: DeckStacksCopies) => void
  sort: DeckStacksSort
  onSortChange: (sort: DeckStacksSort) => void
  separateCreatures: boolean
  onSeparateCreaturesChange: (separate: boolean) => void
  scale: number
  onScaleChange: (scale: number) => void
  layout?: 'vertical' | 'horizontal'
  onToggleLayout?: () => void
}

interface SegmentOption<T extends string> {
  value: T
  label: string
}

function Segmented<T extends string>({
  control,
  label,
  options,
  value,
  onChange,
}: {
  control: string
  label: string
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="deck-editor-group" data-control={control}>
      <span className="deck-editor-group-label" aria-hidden="true">
        {label}
      </span>
      <div className="deck-editor-seg">
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              className={`deck-editor-seg-btn${selected ? ' is-selected' : ''}`}
              aria-pressed={selected}
              data-value={option.value}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function DeckEditorToolbar({
  drawerOpen,
  onToggleDrawer,
  view,
  onViewChange,
  group,
  onGroupChange,
  copies,
  onCopiesChange,
  sort,
  onSortChange,
  separateCreatures,
  onSeparateCreaturesChange,
  scale,
  onScaleChange,
  layout = 'vertical',
  onToggleLayout,
}: DeckEditorToolbarProps) {
  const { t } = useTranslation()
  const piles = view === 'piles'

  return (
    <div className="deck-editor-toolbar">
      <Button
        variant="subtle"
        size="sm"
        icon="search"
        className="deck-editor-drawer-toggle"
        aria-pressed={drawerOpen}
        onClick={onToggleDrawer}
      >
        {t('decks', 'editor_add_cards')}
      </Button>

      <Segmented<DeckEditorView>
        control="view"
        label={t('decks', 'editor_view')}
        value={view}
        onChange={onViewChange}
        options={[
          { value: 'piles', label: t('decks', 'editor_view_piles') },
          { value: 'list', label: t('decks', 'editor_view_list') },
        ]}
      />

      {!piles && onToggleLayout && (
        <Button
          variant="subtle"
          size="sm"
          className="deck-editor-layout"
          aria-pressed={layout === 'horizontal'}
          title={layout === 'vertical' ? t('decks', 'builder_layout_horizontal') : t('decks', 'builder_layout_vertical')}
          onClick={onToggleLayout}
        >
          {layout === 'vertical' ? t('decks', 'builder_layout_horizontal') : t('decks', 'builder_layout_vertical')}
        </Button>
      )}

      {piles && (
        <>
          <Segmented<DeckStacksGroup>
            control="group"
            label={t('decks', 'editor_group')}
            value={group}
            onChange={onGroupChange}
            options={[
              { value: 'type', label: t('decks', 'group_type') },
              { value: 'cmc', label: t('decks', 'group_cmc') },
              { value: 'color', label: t('decks', 'group_color') },
              { value: 'rarity', label: t('decks', 'group_rarity') },
              { value: 'identity', label: t('decks', 'group_identity') },
              { value: 'edh', label: t('decks', 'group_edh') },
              { value: 'free', label: t('decks', 'group_free') },
            ]}
          />

          <Segmented<DeckStacksCopies>
            control="copies"
            label={t('decks', 'editor_copies')}
            value={copies}
            onChange={onCopiesChange}
            options={[
              { value: 'separate', label: t('decks', 'copies_separate') },
              { value: 'together', label: t('decks', 'copies_together') },
            ]}
          />

          {canSeparateCreatures(group) && (
            <Button
              variant="subtle"
              size="sm"
              className="deck-editor-separate"
              data-control="separate-creatures"
              aria-pressed={separateCreatures}
              onClick={() => onSeparateCreaturesChange(!separateCreatures)}
            >
              {t('decks', 'toggle_separate_creatures')}
            </Button>
          )}

          <Segmented<DeckStacksSort>
            control="sort"
            label={t('decks', 'editor_sort')}
            value={sort}
            onChange={onSortChange}
            options={[
              { value: 'cmc', label: t('decks', 'sort_cmc') },
              { value: 'name', label: t('decks', 'sort_name') },
            ]}
          />

          <CardSizeSlider
            className="deck-editor-scale"
            value={scale}
            min={DECK_STACKS_SCALE_MIN}
            max={DECK_STACKS_SCALE_MAX}
            step={DECK_STACKS_SCALE_STEP}
            onChange={onScaleChange}
          />
        </>
      )}
    </div>
  )
}
